/**
 * controllers/closedDate.controller.js
 *
 * Admin manages specific dates when the kitchen is closed
 * (festivals, holidays, etc.)
 *
 * Endpoints:
 *   POST   /admin/closed-dates          — mark a date as closed
 *   GET    /admin/closed-dates          — list upcoming closed dates
 *   PATCH  /admin/closed-dates/:id      — update reason/note/notifyDaysBefore
 *   DELETE /admin/closed-dates/:id      — remove a closed date
 *
 * The checkout guard lives in order.controller.js (checkClosedDate helper).
 * The advance notification cron lives in jobs/queues.js.
 */

const ClosedDate = require("../models/ClosedDate");
const { sendSuccess } = require("../utils/response");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { getTodayNP } = require("../utils/nepaliTime");
const { validateObjectId } = require("../middleware/sanitize");

// ─── Admin: create a closed date ─────────────────────────────────────────────
exports.createClosedDate = catchAsync(async (req, res) => {
  const { date, reason, adminNote, notifyDaysBefore } = req.body;

  const today = getTodayNP();
  if (date < today) {
    throw new AppError("Cannot mark a past date as closed.", 400);
  }

  // Check if this date is already marked active
  const existing = await ClosedDate.findOne({ date, isActive: true });
  if (existing) {
    throw new AppError(
      `${date} is already marked as closed (${existing.reason}). Update or remove it first.`,
      409
    );
  }

  const closed = await ClosedDate.create({
    date,
    reason,
    adminNote,
    notifyDaysBefore: notifyDaysBefore ?? 1,
    createdBy: req.user._id,
  });

  sendSuccess(res, { closedDate: closed }, `Kitchen marked as closed on ${date} (${reason})`, 201);
});

// ─── Admin: list closed dates ─────────────────────────────────────────────────
exports.listClosedDates = catchAsync(async (req, res) => {
  const { from, to, includeInactive } = req.query;
  const today = getTodayNP();

  const filter = {};
  if (!includeInactive) filter.isActive = true;
  filter.date = { $gte: from || today }; // default: upcoming only
  if (to) filter.date.$lte = to;

  const closedDates = await ClosedDate.find(filter)
    .populate("createdBy", "name phone")
    .sort({ date: 1 });

  sendSuccess(res, { closedDates, count: closedDates.length });
});

// ─── Admin: update a closed date ─────────────────────────────────────────────
exports.updateClosedDate = catchAsync(async (req, res) => {
  const closed = await ClosedDate.findById(req.params.id);
  if (!closed) throw new AppError("Closed date not found.", 404);

  const { reason, adminNote, notifyDaysBefore } = req.body;
  if (reason !== undefined) closed.reason = reason;
  if (adminNote !== undefined) closed.adminNote = adminNote;
  if (notifyDaysBefore !== undefined) {
    closed.notifyDaysBefore = notifyDaysBefore;
    closed.notificationSentAt = null; // reset so notification fires again if needed
  }

  await closed.save();
  sendSuccess(res, { closedDate: closed }, "Closed date updated.");
});

// ─── Admin: remove a closed date ─────────────────────────────────────────────
exports.deleteClosedDate = catchAsync(async (req, res) => {
  const closed = await ClosedDate.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  if (!closed) throw new AppError("Closed date not found.", 404);
  sendSuccess(res, {}, `Closed date for ${closed.date} removed. Kitchen is open again that day.`);
});