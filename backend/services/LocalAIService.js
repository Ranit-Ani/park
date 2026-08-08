const path = require('path');
const fs = require('fs');
const { runTool } = require('./aiTools');

// The ai/ directory sits at the project root, alongside backend/ and frontend/.
const AI_ROOT = path.resolve(__dirname, '..', '..', 'ai');
const INTENTS_CONFIG_PATH = path.join(AI_ROOT, 'config', 'intents.json');
const AI_API_URL = process.env.AI_API_URL || 'http://127.0.0.1:5001';

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

module.exports = { chat };
