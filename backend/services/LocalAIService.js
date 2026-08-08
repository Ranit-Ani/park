const path = require('path');
const fs = require('fs');
const Tesseract = require('tesseract.js');
const { runTool } = require('./aiTools');

// The ai/ directory sits at the project root, alongside backend/ and frontend/.
const AI_ROOT = path.resolve(__dirname, '..', '..', 'ai');
const INTENTS_CONFIG_PATH = path.join(AI_ROOT, 'config', 'intents.json');
const AI_API_URL = process.env.AI_API_URL || 'http://127.0.0.1:5001';

// Indian vehicle registration plate shape, e.g. "MH12AB1234" or "MH 12 AB 1234".
// Matches after the OCR text has been uppercased; spacing/dashes are optional.
const PLATE_REGEX = /\b([A-Z]{2}\s?-?\s?[0-9]{1,2}\s?-?\s?[A-Z]{1,2}\s?-?\s?[0-9]{4})\b/;

// ─── Shared OCR worker ──────────────────────────────────────────────────
// Tesseract.recognize() on its own creates and tears down a worker (and
// re-fetches the English language data) on every call. Keep one worker
// alive instead, and queue jobs so concurrent scans don't collide on it.
let workerPromise = null;
function getWorker() {
  if (!workerPromise) {
    // langPath defaults to tesseract.js's own jsDelivr CDN. Some hosts/
    // networks block that CDN — set OCR_LANG_PATH to an alternate mirror
    // (e.g. a raw.githubusercontent.com/naptha/tessdata path) if so.
    const workerOptions = { logger: () => {} };
    if (process.env.OCR_LANG_PATH) workerOptions.langPath = process.env.OCR_LANG_PATH;
    workerPromise = Tesseract.createWorker('eng', 1, workerOptions).catch((err) => {
      workerPromise = null; // allow the next call to retry creating it
      throw err;
    });
  }
  return workerPromise;
}

let ocrQueue = Promise.resolve();
function runOcr(buffer) {
  const job = ocrQueue.then(async () => {
    const worker = await getWorker();
    return worker.recognize(buffer);
  });
  ocrQueue = job.catch(() => {}); // keep the queue alive even if this job fails
  return job;
}

let intentsConfig = null;
function loadIntentsConfig() {
  if (!intentsConfig) {
    const raw = fs.readFileSync(INTENTS_CONFIG_PATH, 'utf-8');
    intentsConfig = JSON.parse(raw);
  }
  return intentsConfig;
}

function intentByTag(tag) {
  const cfg = loadIntentsConfig();
  return cfg.intents.find((i) => i.tag === tag);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Call the self-hosted classifier (ai/api/app.py) ───────────────────────
async function classify(message) {
  let res;
  try {
    res = await fetch(`${AI_API_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
  } catch (err) {
    const e = new Error(
      'The AI model service is not reachable. Make sure the Python API is running (python ai/api/app.py).'
    );
    e.statusCode = 503;
    throw e;
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    const e = new Error(body.message || 'The AI model failed to classify that message.');
    e.statusCode = res.status === 503 ? 503 : 500;
    throw e;
  }
  return body.data; // { intent, confidence, raw_intent, below_threshold, alternatives }
}

// ─── Formatters: turn raw tool data into a short chat reply ────────────────
const HOUR_LABEL = (h) => {
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12} ${period}`;
};

function formatCheckAvailability(data) {
  if (!data.total) return "There aren't any active slots configured right now.";
  const status = data.byStatus || {};
  const lines = [
    `Right now: ${status.Available || 0} Available, ${status.Booked || 0} Booked, ${status.Occupied || 0} Occupied out of ${data.total} total slots.`,
  ];
  const rateEntries = Object.entries(data.ratesByType || {});
  if (rateEntries.length) {
    const rateText = rateEntries
      .map(([type, r]) => (r.min === r.max ? `${type}: ₹${r.min}/hr` : `${type}: ₹${r.min}-₹${r.max}/hr`))
      .join(', ');
    lines.push(`Rates — ${rateText}.`);
  }
  lines.push(data.billingNote);
  return lines.join('\n');
}

function formatOccupancyInsights(data) {
  const peak = (data.peakHours || []).map((h) => HOUR_LABEL(h.hour)).join(', ') || 'not enough data yet';
  const quiet = (data.quietHours || []).map((h) => HOUR_LABEL(h.hour)).join(', ') || 'not enough data yet';
  const days = (data.busiestDays || []).slice(0, 3).map((d) => d.day).join(', ') || 'not enough data yet';
  const lines = [
    `Peak hours: ${peak} (based on the last ${data.windowDays} days).`,
    `Quietest hours: ${quiet}.`,
    `Busiest days: ${days}.`,
  ];
  if (data.avgSessionMinutes != null) lines.push(`Average parking session: ${data.avgSessionMinutes} minutes.`);
  if (data.topSlots && data.topSlots.length) {
    const top = data.topSlots.slice(0, 3).map((s) => `${s.slotNumber || 'Unknown'} (${s.count})`).join(', ');
    lines.push(`Most-used slots: ${top}.`);
  }
  return lines.join('\n');
}

function formatMyBookings(data) {
  if (!data || !data.length) return "You don't have any bookings yet.";
  const lines = data.slice(0, 8).map((b) => {
    const slot = b.slotId ? `${b.slotId.slotNumber || ''} (${b.slotId.location || ''})`.trim() : 'slot deleted';
    const amount = b.totalAmount != null ? `₹${b.totalAmount}` : 'not billed yet';
    return `• ${b.status}: ${b.vehicleCategory || ''} ${b.vehicleNumber || ''} — ${slot} — ${amount}`;
  });
  return lines.join('\n');
}

function formatMyVehicles(data) {
  if (!data || !data.length) return "You don't have any saved vehicles yet — add one from Profile → My Vehicles.";
  return data
    .map((v) => `• ${v.category || 'Vehicle'}: ${v.registrationNumber || 'Registration Pending'}`)
    .join('\n');
}

function formatRevenueReport(data) {
  const total = data.totalRevenue || 0;
  const count = data.totalBookings || 0;
  const avg = data.avgAmount ? Math.round(data.avgAmount) : 0;
  return `Total revenue: ₹${total} from ${count} completed booking${count === 1 ? '' : 's'}. Average bill: ₹${avg}.`;
}

function formatUserRegistry(data) {
  const byRole = (data.byRole || []).map((r) => `${r._id}: ${r.count}`).join(', ') || 'no users found';
  const active = (data.activeCounts || []).map((a) => `${a._id ? 'active' : 'inactive'}: ${a.count}`).join(', ') || '—';
  return `Users by role — ${byRole}.\nAccount status — ${active}.`;
}

const TOOL_FORMATTERS = {
  get_slot_availability: formatCheckAvailability,
  get_occupancy_insights: formatOccupancyInsights,
  get_my_bookings: formatMyBookings,
  get_my_vehicles: formatMyVehicles,
  get_revenue_report: formatRevenueReport,
  get_user_registry_summary: formatUserRegistry,
};

// ─── Public: chat ────────────────────────────────────────────────────────
async function chat({ user, message }) {
  const prediction = await classify(message);
  let intentTag = prediction.intent;
  let def = intentByTag(intentTag);

  // Guard against a role trying to trigger an intent it isn't permitted to
  // use (e.g. a regular user's message happening to match "revenue_report").
  if (def && def.roles && !def.roles.includes(user.role)) {
    def = intentByTag('unknown');
    intentTag = 'unknown';
  }
  if (!def) {
    def = intentByTag('unknown');
    intentTag = 'unknown';
  }

  let reply;
  if (def.type === 'tool') {
    try {
      const data = await runTool(def.tool, {}, { userId: user.id });
      const formatter = TOOL_FORMATTERS[def.tool];
      reply = formatter ? formatter(data) : JSON.stringify(data);
    } catch (err) {
      reply = "I hit an error looking that up — please try again in a moment.";
    }
  } else {
    reply = pickRandom(def.responses);
  }

  return {
    reply,
    intent: intentTag,
    confidence: prediction.confidence,
  };
}

// ─── Public: scanPlate ───────────────────────────────────────────────────
// Runs real OCR (Tesseract.js — self-hosted, no external API key) on the
// uploaded photo, then extracts a plate-shaped token from the recognized
// text. This is separate from the text intent classifier above; OCR needs
// image input, not a category label.
function cleanToken(raw) {
  return raw.replace(/[^A-Z0-9]/g, '').toUpperCase();
}

function extractPlate(rawText) {
  const text = (rawText || '').toUpperCase();

  // 1) Prefer a strict Indian-plate-shaped match anywhere in the text.
  const strict = text.match(PLATE_REGEX);
  if (strict) return cleanToken(strict[1]);

  // 2) Fallback: the longest token that mixes letters and digits and is a
  //    plausible plate length — catches plates OCR read with odd spacing
  //    or a non-Indian format.
  const tokens = text.split(/\s+/).map(cleanToken).filter(Boolean);
  const candidate = tokens
    .filter((t) => t.length >= 6 && t.length <= 11 && /[A-Z]/.test(t) && /[0-9]/.test(t))
    .sort((a, b) => b.length - a.length)[0];

  return candidate || null;
}

async function scanPlate(imageBase64) {
  if (!imageBase64) {
    return { plateNumber: null, confidence: 'low', vehicleCategoryGuess: null, note: 'No image received.' };
  }

  let buffer;
  try {
    buffer = Buffer.from(imageBase64, 'base64');
    if (!buffer.length) throw new Error('empty buffer');
  } catch (err) {
    return { plateNumber: null, confidence: 'low', vehicleCategoryGuess: null, note: "That image couldn't be read — please try taking the photo again." };
  }

  let ocrResult;
  try {
    ocrResult = await runOcr(buffer);
  } catch (err) {
    const e = new Error('The OCR engine failed to process that photo. Please try again.');
    e.statusCode = 502;
    throw e;
  }

  const rawText = ocrResult?.data?.text || '';
  const meanConfidence = ocrResult?.data?.confidence ?? 0; // 0–100, Tesseract's own estimate
  const plateNumber = extractPlate(rawText);

  if (!plateNumber) {
    return {
      plateNumber: null,
      confidence: 'low',
      vehicleCategoryGuess: null,
      note: "Couldn't find a number plate in that photo. Fill the frame with just the plate, use good lighting, and hold the camera straight-on.",
    };
  }

  const confidence = meanConfidence >= 70 ? 'high' : meanConfidence >= 40 ? 'medium' : 'low';

  return {
    plateNumber,
    confidence,
    // Vehicle category (car/bike/etc.) can't be reliably inferred from a
    // plate crop alone, so this stays unset — the user picks it manually.
    vehicleCategoryGuess: null,
    note: null,
  };
}

module.exports = { chat, scanPlate };
