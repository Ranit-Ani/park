const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const Booking = require('../models/Booking');
const ParkingSlot = require('../models/ParkingSlot');
const User = require('../models/User');

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_TOOL_ROUNDS = 4;

function client() {
  if (!process.env.GEMINI_API_KEY) {
    const err = new Error('AI assistant is not configured on this server (missing GEMINI_API_KEY).');
    err.statusCode = 503;
    throw err;
  }
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// ─── Tool definitions ──────────────────────────────────────────────────────
// Every role gets slot-availability + occupancy-insight tools. "user" also
// gets their own bookings/vehicles; "admin" additionally gets revenue and
// user-registry tools. Staff behaves like a user for chat purposes (no
// financial data).
const BASE_TOOLS = [
  {
    name: 'get_slot_availability',
    description: 'Get current parking slot counts (Available/Booked/Occupied/total), optionally filtered by slot type or location.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        slotType: { type: SchemaType.STRING, enum: ['standard', 'faculty', 'disabled', 'ev'], description: 'Filter by slot type' },
        location: { type: SchemaType.STRING, description: 'Filter by location text, e.g. "Block A"' },
      },
    },
  },
  {
    name: 'get_occupancy_insights',
    description: 'Get historical parking patterns: peak/quiet hours, busiest days of the week, average session length, and the most-used slots.',
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
];

const USER_TOOLS = [
  {
    name: 'get_my_bookings',
    description: "Get the current user's booking history, including status (Booked/Active/Completed/Cancelled/Expired), slot, and vehicle used.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { limit: { type: SchemaType.INTEGER, description: 'Max bookings to return, default 10' } },
    },
  },
  {
    name: 'get_my_vehicles',
    description: "Get the current user's saved vehicles.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
];

const ADMIN_TOOLS = [
  {
    name: 'get_revenue_report',
    description: 'Get total revenue, number of completed bookings, and average bill amount for a date range (defaults to all-time).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        startDate: { type: SchemaType.STRING, description: 'ISO date, optional' },
        endDate: { type: SchemaType.STRING, description: 'ISO date, optional' },
      },
    },
  },
  {
    name: 'get_user_registry_summary',
    description: 'Get counts of users by role (user/staff/admin) and active/inactive status.',
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
];

function toolsForRole(role) {
  if (role === 'admin') return [...BASE_TOOLS, ...USER_TOOLS, ...ADMIN_TOOLS];
  return [...BASE_TOOLS, ...USER_TOOLS];
}

// ─── Tool execution ─────────────────────────────────────────────────────────
async function runTool(name, args, ctx) {
  switch (name) {
    case 'get_slot_availability': {
      const query = { isActive: true };
      if (args.slotType) query.slotType = args.slotType;
      if (args.location) query.location = { $regex: args.location, $options: 'i' };
      const slots = await ParkingSlot.find(query).select('slotNumber status slotType location hourlyRate');
      const summary = slots.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {});
      return { total: slots.length, byStatus: summary, availableSlots: slots.filter((s) => s.status === 'Available').slice(0, 15) };
    }
    case 'get_occupancy_insights':
      return Booking.getOccupancyInsights();
    case 'get_my_bookings': {
      const limit = Math.min(args.limit || 10, 25);
      return Booking.find({ userId: ctx.userId })
        .populate('slotId', 'slotNumber location')
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('status vehicleCategory vehicleNumber bookingTime checkInTime checkOutTime totalAmount slotId');
    }
    case 'get_my_vehicles': {
      const user = await User.findById(ctx.userId).select('vehicles');
      return user ? user.vehicles : [];
    }
    case 'get_revenue_report':
      return Booking.getRevenue(args.startDate, args.endDate);
    case 'get_user_registry_summary': {
      const [byRole, activeCounts] = await Promise.all([
        User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
        User.aggregate([{ $group: { _id: '$isActive', count: { $sum: 1 } } }]),
      ]);
      return { byRole, activeCounts };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function systemPromptFor(user) {
  return `You are the AI assistant embedded in the Smart Campus Car-Parking System, talking to a logged-in ${user.role} named ${user.name}.

Rules the platform enforces that you should know:
- Bookings are always for right now — there is no advance/scheduled booking.
- A new booking stays "Booked" for 1 hour; if the user doesn't check in within that hour it auto-expires and the slot is released.
- A user can only have one "Booked" booking at a time, but once it becomes "Active" (checked in) they can book again for another vehicle.
- Billing is minimum 1 hour, rounded up, charged at the slot's hourly rate.
- Slot statuses: Available, Booked, Occupied, Maintenance. Booking statuses: Booked, Active, Completed, Cancelled, Expired.

Use the available tools to fetch real, current data before answering questions about slots, bookings, revenue, or usage patterns — never guess numbers. Keep answers short and to the point (this is a small chat widget, not a report). If asked to do something outside this app's scope, say so plainly.`;
}

// Frontend sends history as [{ role: 'user'|'assistant', content: string }].
// Gemini's Content objects use role 'user'|'model' and a parts[] array.
function toGeminiHistory(history) {
  return history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

async function chat({ user, message, history = [] }) {
  const genAI = client();
  const tools = [{ functionDeclarations: toolsForRole(user.role) }];

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: systemPromptFor(user),
    tools,
  });

  const chatSession = model.startChat({ history: toGeminiHistory(history.slice(-12)) });

  let result = await chatSession.sendMessage(message);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const calls = result.response.functionCalls();
    if (!calls || calls.length === 0) break;

    const responseParts = await Promise.all(
      calls.map(async (call) => {
        let output;
        try {
          output = await runTool(call.name, call.args || {}, { userId: user.id });
        } catch (err) {
          output = { error: err.message };
        }
        return { functionResponse: { name: call.name, response: { result: output } } };
      })
    );

    result = await chatSession.sendMessage(responseParts);
  }

  const text = (result.response.text() || '').trim();
  return { reply: text || "I couldn't come up with an answer for that — try rephrasing?" };
}

// ─── Vision: license plate scanning ────────────────────────────────────────
async function scanPlate({ imageBase64, mediaType = 'image/jpeg' }) {
  const genAI = client();
  const model = genAI.getGenerativeModel({ model: MODEL });

  const result = await model.generateContent([
    { inlineData: { mimeType: mediaType, data: imageBase64 } },
    {
      text: `Look at this photo of a vehicle license/registration plate. Respond with ONLY a JSON object, no other text, no markdown fences:
{"plateNumber": "<the plate text, uppercase, spaces where visually separated, or null if unreadable>", "confidence": "<high|medium|low>", "vehicleCategoryGuess": "<2 Wheeler|3 Wheeler|4 Wheeler|null>"}`,
    },
  ]);

  const text = result.response.text() || '{}';
  const clean = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    return { plateNumber: null, confidence: 'low', vehicleCategoryGuess: null };
  }
}

module.exports = { chat, scanPlate };