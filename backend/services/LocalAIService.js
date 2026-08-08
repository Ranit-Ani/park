const path = require('path');
const fs = require('fs');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
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
    workerPromise = Tesseract.createWorker('eng', 1, workerOptions)
      .then(async (worker) => {
        // Tune the engine for short, single-line, plate-style text instead
        // of its "full page of text" default — this is what actually lets
        // it lock onto a plate surrounded by car/road background.
        await worker.setParameters({
          tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -',
        });
        return worker;
      })
      .catch((err) => {
        workerPromise = null; // allow the next call to retry creating it
        throw err;
      });
  }
  return workerPromise;
}

let ocrQueue = Promise.resolve();
function runOcr(buffer, psm) {
  const job = ocrQueue.then(async () => {
    const worker = await getWorker();
    if (psm) await worker.setParameters({ tessedit_pageseg_mode: psm });
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

// OCR frequently confuses visually-similar letter/digit pairs — especially
// at the lower resolution a plate ends up at when it's a small part of a
// wider shot (not a close-up). Rather than just rejecting those reads, try
// swapping the ambiguous characters and re-testing against the plate shape.
const LETTER_TO_DIGIT = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6' };
const DIGIT_TO_LETTER = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B', '6': 'G' };
const swapLettersForDigits = (t) => t.replace(/[A-Z]/g, (c) => LETTER_TO_DIGIT[c] || c);
const swapDigitsForLetters = (t) => t.replace(/[0-9]/g, (c) => DIGIT_TO_LETTER[c] || c);

function extractPlate(rawText) {
  const text = (rawText || '').toUpperCase();

  // Try the raw text first, then two "corrected" variants that assume the
  // ambiguous characters were misread the other way — this recovers plates
  // OCR almost got right instead of only accepting a perfect first read.
  const variants = [text, swapLettersForDigits(text), swapDigitsForLetters(text)];

  // 1) Prefer a strict Indian-plate-shaped match, checking each variant.
  for (const v of variants) {
    const strict = v.match(PLATE_REGEX);
    if (strict) return cleanToken(strict[1]);
  }

  // 2) Fallback: the longest token that mixes letters and digits and is a
  //    plausible plate length — catches plates OCR read with odd spacing
  //    or a non-Indian format. Checked across the same variants.
  for (const v of variants) {
    const tokens = v.split(/\s+/).map(cleanToken).filter(Boolean);
    const candidate = tokens
      .filter((t) => t.length >= 6 && t.length <= 11 && /[A-Z]/.test(t) && /[0-9]/.test(t))
      .sort((a, b) => b.length - a.length)[0];
    if (candidate) return candidate;
  }

  return null;
}

// Phone camera photos arrive at full resolution (often 3000-4000px wide,
// several MB) and in color. Feeding that straight into Tesseract is what
// made scans slow AND inaccurate: the engine spends most of its time on
// pixels that aren't the plate, and color/noise/background text confuses
// recognition even when the plate itself is perfectly sharp. Downscaling to
// a sane width and boosting contrast in grayscale fixes both at once.
//
// `width` controls how much detail survives the downscale — a close-up
// photo where the plate fills the frame reads fine even at a smaller width,
// but a normal photo where the plate is a small part of the frame needs
// more pixels kept so individual plate characters don't blur together.
// `strongContrast` applies a harder contrast stretch for a second pass,
// which helps on photos with glare, shadow, or a dim plate.
async function preprocessForOcr(buffer, { width = 1600, strongContrast = false } = {}) {
  let pipeline = sharp(buffer)
    .rotate() // respect EXIF orientation instead of reading a sideways photo
    .resize({ width, withoutEnlargement: true })
    .grayscale();

  pipeline = strongContrast
    ? pipeline.linear(1.6, -40).sharpen({ sigma: 1.5 }) // harder contrast stretch for a tough second pass
    : pipeline.normalize().sharpen(); // gentle contrast stretch for the fast first pass

  return pipeline.toBuffer();
}

// Runs one OCR attempt (preprocess at a given size/contrast + a given page
// segmentation mode) and returns the extracted plate plus Tesseract's own
// confidence score, or null if nothing plate-shaped was found.
async function attemptScan(buffer, { width, strongContrast, psm }) {
  let processedBuffer;
  try {
    processedBuffer = await preprocessForOcr(buffer, { width, strongContrast });
  } catch (err) {
    // If preprocessing itself fails (e.g. corrupt/unsupported image data),
    // fall back to the original buffer rather than failing the whole scan.
    processedBuffer = buffer;
  }

  const ocrResult = await runOcr(processedBuffer, psm);
  const rawText = ocrResult?.data?.text || '';
  const meanConfidence = ocrResult?.data?.confidence ?? 0; // 0–100, Tesseract's own estimate
  const plateNumber = extractPlate(rawText);

  return { plateNumber, meanConfidence };
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

  // Multi-pass OCR: try a fast pass tuned for a close-up shot first, and
  // only spend extra time on higher-resolution/harder-contrast passes if
  // that didn't turn up a plate. This keeps close-up scans fast while still
  // giving normal (non close-up) shots — where the plate is a smaller part
  // of the frame — a real chance instead of failing after one attempt.
  const attempts = [
    { width: 1600, strongContrast: false, psm: Tesseract.PSM.SPARSE_TEXT },
    { width: 2400, strongContrast: false, psm: Tesseract.PSM.SPARSE_TEXT },
    { width: 2400, strongContrast: true, psm: Tesseract.PSM.SINGLE_BLOCK },
  ];

  let best = { plateNumber: null, meanConfidence: 0 };
  try {
    for (const attempt of attempts) {
      const result = await attemptScan(buffer, attempt);
      if (result.meanConfidence > best.meanConfidence) best = result;
      if (result.plateNumber) {
        best = result;
        break; // good match found — no need to burn time on further passes
      }
    }
  } catch (err) {
    const e = new Error('The OCR engine failed to process that photo. Please try again.');
    e.statusCode = 502;
    throw e;
  }

  if (!best.plateNumber) {
    return {
      plateNumber: null,
      confidence: 'low',
      vehicleCategoryGuess: null,
      note: "Couldn't find a number plate in that photo. Fill the frame with just the plate, use good lighting, and hold the camera straight-on.",
    };
  }

  const confidence = best.meanConfidence >= 70 ? 'high' : best.meanConfidence >= 40 ? 'medium' : 'low';

  return {
    plateNumber: best.plateNumber,
    confidence,
    // Vehicle category (car/bike/etc.) can't be reliably inferred from a
    // plate crop alone, so this stays unset — the user picks it manually.
    vehicleCategoryGuess: null,
    note: null,
  };
}

module.exports = { chat, scanPlate };