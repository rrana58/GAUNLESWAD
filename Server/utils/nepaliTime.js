/**
 * nepaliTime.js — Nepal Standard Time (UTC+5:45, no DST)
 */

const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000; // 345 min = 20,700,000 ms

function getNepaliNow() {
  return new Date(Date.now() + NEPAL_OFFSET_MS);
}

function getNepaliComponents() {
  const np = getNepaliNow();
  return {
    hour: np.getUTCHours(),
    minute: np.getUTCMinutes(),
    dateStr: np.toISOString().slice(0, 10),
  };
}

/**
 * Returns active session type for current Nepal time:
 * "khaja"  → 12:00–15:59 NPT
 * "combo"  → 22:00–23:59 or 00:00–03:59 NPT
 * null     → normal menu time
 */
function getActiveSessionType() {
  const { hour } = getNepaliComponents();
  if (hour >= 12 && hour < 16) return "khaja";
  if (hour >= 22 || hour < 4) return "combo";
  return null;
}

/**
 * Active date for the session type.
 * Combo sessions that run past midnight use the PREVIOUS day's date
 * (admin configured it the previous evening).
 */
function getSessionActiveDate(type) {
  const np = getNepaliNow();
  const { hour } = getNepaliComponents();
  if (type === "combo" && hour < 4) {
    const yesterday = new Date(np.getTime() - 24 * 60 * 60 * 1000);
    return yesterday.toISOString().slice(0, 10);
  }
  return np.toISOString().slice(0, 10);
}

function getTodayNP() {
  return getNepaliComponents().dateStr;
}

module.exports = {
  getNepaliNow,
  getNepaliComponents,
  getActiveSessionType,
  getSessionActiveDate,
  getTodayNP,
};
