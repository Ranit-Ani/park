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
  if (role === 'staff') return BASE_TOOLS; // staff have no personal bookings/vehicles to look up
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
      // Group hourly rates by slot type so rate questions ("what's the rate
      // for standard/EV/faculty slots?") can be answered directly without
      // dumping every single slot into the model's context.
      const ratesByType = {};
      for (const s of slots) {
        if (!ratesByType[s.slotType]) ratesByType[s.slotType] = { min: s.hourlyRate, max: s.hourlyRate };
        ratesByType[s.slotType].min = Math.min(ratesByType[s.slotType].min, s.hourlyRate);
        ratesByType[s.slotType].max = Math.max(ratesByType[s.slotType].max, s.hourlyRate);
      }
      return {
        total: slots.length,
        byStatus: summary,
        ratesByType,
        billingNote: 'Minimum 1 hour billed, rounded up to the next hour, at the slot\'s hourly rate.',
        availableSlots: slots.filter((s) => s.status === 'Available').slice(0, 15),
      };
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

// ─── Platform knowledge base ────────────────────────────────────────────────
// Procedural/policy questions ("how do I...", "can I...", "what happens
// if...") can't be answered by a data tool — they need to be baked into the
// prompt directly. Organized by topic so it's easy to extend later.

const COMMON_KNOWLEDGE = `
BOOKING
- Booking is always for right now — there is no advance/scheduled booking. You pick an available slot and book it immediately.
- To book, pick an available slot, then either choose one of your saved vehicles or enter a new vehicle's category and registration number.
- A new booking starts in "Booked" status and stays that way for 1 hour. If you don't check in within that hour, it auto-expires: the booking becomes "Expired" and the slot is released back to Available.
- You can only have ONE booking in "Booked" status at a time (i.e. one unclaimed reservation awaiting check-in). If you try to book again while you already have one, it will be rejected — check in or cancel the existing one first.
- Once a booking becomes "Active" (you've checked in), you're free to create a new booking right away — for the same or a different vehicle.

CANCELLATION
- You can cancel a booking any time while it is still "Booked" (i.e. before check-in) — from "My Bookings", tap Cancel. Staff/admin can also cancel it for you.
- Once a booking is "Active" (checked in), it can NOT be cancelled — the only way to end it is to check out normally at the slot.
- Bookings that are already "Completed", "Cancelled", or "Expired" can't be cancelled again (nothing to cancel).
- There's no separate cancellation fee — since payment only happens at checkout, cancelling before check-in means nothing was ever charged.

CHECK-IN
- Check-in is done by staff at the check-in console, using your booking ID or vehicle details — you don't do it yourself in the app.
- Check-in moves the booking from "Booked" to "Active" and the slot from "Booked" to "Occupied".
- If your 1-hour window passes before staff can check you in, the booking auto-expires and you'll need to book again.

CHECK-OUT & BILLING
- Check-out is done by staff at the check-out console when you're leaving.
- Billing is minimum 1 hour, rounded UP to the next hour, at the slot's hourly rate (rates vary by slot type — standard/faculty/disabled/ev). E.g. 1 hour 5 minutes of parking bills as 2 hours.
- Check-out moves the booking to "Completed", generates a bill/receipt, and frees the slot back to "Available".
- A downloadable receipt is available for completed bookings.

VEHICLES
- You can save multiple vehicles to your account (Profile → My Vehicles) and pick one instantly when booking, instead of retyping details each time.
- Supported vehicle categories: 2 Wheeler, 3 Wheeler, 4 Wheeler. Buses, trucks, and other heavy vehicles are not supported.
- If a vehicle is brand new and doesn't have a registration number yet, check "Registration Pending" instead of typing a number.
- A registration/plate photo can be scanned (camera button next to the registration field) to auto-fill the number instead of typing it.
- Saved vehicles can be edited or removed any time from Profile → My Vehicles.

ACCOUNT
- Profile (name, photo) can be updated from the Profile page.
- Password can be changed from Profile → Security.
- Email can be changed from Profile, which requires OTP verification of the new email before it takes effect.
- Accounts can be permanently deleted from Profile → Danger Zone, which requires re-entering your password to confirm. This is irreversible.
- New accounts register with an email OTP verification step.

SLOTS
- Slot types: standard, faculty, disabled, ev (EV charging). Slot statuses: Available, Booked, Occupied, Maintenance.
- Always use the slot-availability tool to answer questions about current counts, specific locations, or rates — never guess numbers.
- Peak/quiet hours and busiest slots come from the occupancy-insights tool, based on real historical booking data.`;

const ROLE_KNOWLEDGE = {
  user: `
YOUR ROLE (User)
- You can view live slot availability, book a slot for right now, check your own booking history, and manage your saved vehicles — all via tools when asked.
- You cannot check yourself in or out — that's done by staff — and you cannot see other users' data, revenue, or admin functions.`,

  staff: `
YOUR ROLE (Staff)
- You work the check-in and check-out consoles. Check-in: find the user's pending "Booked" booking, verify the vehicle, confirm check-in — this moves it to "Active" and the slot to "Occupied".
- Check-out: find the "Active" booking, confirm check-out — this calculates the bill (min 1 hour, rounded up), moves the booking to "Completed", and frees the slot.
- You do not have access to revenue reports or user-account management — those are admin-only.
- You don't have a personal "my bookings" history the way a regular user does — you manage everyone else's, not your own parking.`,

  admin: `
YOUR ROLE (Admin)
- You manage the slot inventory (add/edit/deactivate slots, set slot type, location, and hourly rate) and user accounts (change a user's role between user/staff/admin — this automatically moves them between the Users and Staff sections; activate/deactivate accounts).
- You have access to revenue reports (total revenue, completed-booking counts, average bill) and full occupancy/demand insights — use the relevant tools rather than guessing figures.
- You can see a summary of user counts by role and active status via a tool.`,
};

function systemPromptFor(user) {
  const roleBlock = ROLE_KNOWLEDGE[user.role] || ROLE_KNOWLEDGE.user;
  return `You are the AI assistant embedded in the Smart Campus Car-Parking System, talking to a logged-in ${user.role} named ${user.name}. Answer questions about how the platform works, current data, and this user's own account.
${COMMON_KNOWLEDGE}
${roleBlock}

CAPABILITIES AND BOUNDARIES
- You have LIVE, READ-ONLY tools for real slot data, rates, occupancy patterns, and (depending on role) this user's own bookings/vehicles or admin revenue/user data. ALWAYS call the relevant tool before answering a question about current rates, availability, bookings, revenue, or usage patterns — never say information "isn't available" or "isn't supported" if a tool or the knowledge above could answer it. Only say you don't know after actually checking.
- You CANNOT perform actions yourself (you cannot create, cancel, or modify a booking, slot, or account, and you cannot check anyone in or out). When someone asks you to *do* something, don't just refuse — explain the relevant rule and tell them exactly where in the app to do it themselves.
- If asked something entirely outside this parking system's scope, say so plainly and briefly instead of trying to answer it.

Keep answers short and to the point (this is a small chat widget, not a report).`;
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