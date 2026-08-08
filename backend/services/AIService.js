const Anthropic = require('@anthropic-ai/sdk');
const Booking = require('../models/Booking');
const ParkingSlot = require('../models/ParkingSlot');
const User = require('../models/User');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const MAX_TOOL_ROUNDS = 4;

function client() {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error('AI assistant is not configured on this server (missing ANTHROPIC_API_KEY).');
    err.statusCode = 503;
    throw err;
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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
    input_schema: {
      type: 'object',
      properties: {
        slotType: { type: 'string', enum: ['standard', 'faculty', 'disabled', 'ev'], description: 'Filter by slot type' },
        location: { type: 'string', description: 'Filter by location text, e.g. "Block A"' },
      },
    },
  },
  {
    name: 'get_occupancy_insights',
    description: 'Get historical parking patterns: peak/quiet hours, busiest days of the week, average session length, and the most-used slots.',
    input_schema: { type: 'object', properties: {} },
  },
];

const USER_TOOLS = [
  {
    name: 'get_my_bookings',
    description: "Get the current user's booking history, including status (Booked/Active/Completed/Cancelled/Expired), slot, and vehicle used.",
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'integer', description: 'Max bookings to return, default 10' } },
    },
  },
  {
    name: 'get_my_vehicles',
    description: "Get the current user's saved vehicles.",
    input_schema: { type: 'object', properties: {} },
  },
];

const ADMIN_TOOLS = [
  {
    name: 'get_revenue_report',
    description: 'Get total revenue, number of completed bookings, and average bill amount for a date range (defaults to all-time).',
    input_schema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'ISO date, optional' },
        endDate: { type: 'string', description: 'ISO date, optional' },
      },
    },
  },
  {
    name: 'get_user_registry_summary',
    description: 'Get counts of users by role (user/staff/admin) and active/inactive status.',
    input_schema: { type: 'object', properties: {} },
  },
];

function toolsForRole(role) {
  if (role === 'admin') return [...BASE_TOOLS, ...USER_TOOLS, ...ADMIN_TOOLS];
  return [...BASE_TOOLS, ...USER_TOOLS];
}

// ─── Tool execution ─────────────────────────────────────────────────────────
async function runTool(name, input, ctx) {
  switch (name) {
    case 'get_slot_availability': {
      const query = { isActive: true };
      if (input.slotType) query.slotType = input.slotType;
      if (input.location) query.location = { $regex: input.location, $options: 'i' };
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
      const limit = Math.min(input.limit || 10, 25);
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
      return Booking.getRevenue(input.startDate, input.endDate);
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

async function chat({ user, message, history = [] }) {
  const anthropic = client();
  const tools = toolsForRole(user.role);

  const messages = [
    ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPromptFor(user),
      messages,
      tools,
    });

    const toolUses = response.content.filter((b) => b.type === 'tool_use');

    if (toolUses.length === 0 || response.stop_reason !== 'tool_use') {
      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      return { reply: text || "I couldn't come up with an answer for that — try rephrasing?" };
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults = await Promise.all(
      toolUses.map(async (tu) => {
        let result;
        try {
          result = await runTool(tu.name, tu.input || {}, { userId: user.id });
        } catch (err) {
          result = { error: err.message };
        }
        return {
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        };
      })
    );

    messages.push({ role: 'user', content: toolResults });
  }

  return { reply: "I'm having trouble pulling that together right now — try asking again in a moment." };
}

// ─── Vision: license plate scanning ────────────────────────────────────────
async function scanPlate({ imageBase64, mediaType = 'image/jpeg' }) {
  const anthropic = client();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          {
            type: 'text',
            text: `Look at this photo of a vehicle license/registration plate. Respond with ONLY a JSON object, no other text, no markdown fences:
{"plateNumber": "<the plate text, uppercase, spaces where visually separated, or null if unreadable>", "confidence": "<high|medium|low>", "vehicleCategoryGuess": "<2 Wheeler|3 Wheeler|4 Wheeler|null>"}`,
          },
        ],
      },
    ],
  });

  const text = response.content.find((b) => b.type === 'text')?.text || '{}';
  const clean = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    return { plateNumber: null, confidence: 'low', vehicleCategoryGuess: null };
  }
}

module.exports = { chat, scanPlate };
