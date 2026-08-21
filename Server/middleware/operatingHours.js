
const AppError = require("../utils/AppError");

// Nepal Standard Time is UTC+5:45
const NEPAL_OFFSET_MINUTES = 5 * 60 + 45;

function getCurrentNPTHour() {
  const utcMs = Date.now();
  const nptMs = utcMs + NEPAL_OFFSET_MINUTES * 60 * 1000;
  return new Date(nptMs).getUTCHours();
}

const checkOperatingHours = (req, res, next) => {
  // Admins always bypass
  if (req.user?.role === "admin") return next();

  const open  = parseInt(process.env.KITCHEN_OPEN_HOUR  ?? "7",  10);
  const close = parseInt(process.env.KITCHEN_CLOSE_HOUR ?? "22", 10);
  const hour  = getCurrentNPTHour();

  if (hour < open || hour >= close) {
    return next(
      new AppError(
        `We are currently closed. Kitchen hours are ${open}:00–${close}:00 NPT. Please order again later.`,
        503
      )
    );
  }
  next();
};

module.exports = { checkOperatingHours };
