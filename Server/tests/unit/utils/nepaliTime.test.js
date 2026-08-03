const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

// Helper: given a desired Nepal local hour/minute (on a fixed reference date),
// compute the UTC system time that produces it once the module adds the offset.
const utcForNepaliTime = (hour, minute = 0) => {
  const nepaliUTCRepresentation = Date.UTC(2026, 5, 26, hour, minute, 0); // 2026-06-26
  return new Date(nepaliUTCRepresentation - NEPAL_OFFSET_MS);
};

describe("nepaliTime", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  const loadModuleAt = (hour, minute = 0) => {
    jest.useFakeTimers();
    jest.setSystemTime(utcForNepaliTime(hour, minute));
    jest.resetModules();
    return require("../../../utils/nepaliTime");
  };

  describe("getNepaliNow / getNepaliComponents", () => {
    test("adds the 5:45 NPT offset to current UTC time", () => {
      const nepaliTime = loadModuleAt(10, 30);
      const { hour, minute } = nepaliTime.getNepaliComponents();
      expect(hour).toBe(10);
      expect(minute).toBe(30);
    });

    test("dateStr is formatted as YYYY-MM-DD", () => {
      const nepaliTime = loadModuleAt(10, 0);
      const { dateStr } = nepaliTime.getNepaliComponents();
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("getTodayNP returns the same dateStr as getNepaliComponents", () => {
      const nepaliTime = loadModuleAt(10, 0);
      expect(nepaliTime.getTodayNP()).toBe(nepaliTime.getNepaliComponents().dateStr);
    });
  });

  describe("getActiveSessionType — khaja window (12:00–15:59 NPT)", () => {
    test("returns null just before noon (11:59)", () => {
      const nepaliTime = loadModuleAt(11, 59);
      expect(nepaliTime.getActiveSessionType()).toBeNull();
    });

    test("returns 'khaja' exactly at 12:00", () => {
      const nepaliTime = loadModuleAt(12, 0);
      expect(nepaliTime.getActiveSessionType()).toBe("khaja");
    });

    test("returns 'khaja' at 15:59 (last minute of window)", () => {
      const nepaliTime = loadModuleAt(15, 59);
      expect(nepaliTime.getActiveSessionType()).toBe("khaja");
    });

    test("returns null at 16:00 (window closed)", () => {
      const nepaliTime = loadModuleAt(16, 0);
      expect(nepaliTime.getActiveSessionType()).toBeNull();
    });
  });

  describe("getActiveSessionType — combo window (22:00–03:59 NPT, crosses midnight)", () => {
    test("returns null at 21:59 (just before window)", () => {
      const nepaliTime = loadModuleAt(21, 59);
      expect(nepaliTime.getActiveSessionType()).toBeNull();
    });

    test("returns 'combo' exactly at 22:00", () => {
      const nepaliTime = loadModuleAt(22, 0);
      expect(nepaliTime.getActiveSessionType()).toBe("combo");
    });

    test("returns 'combo' at 23:59", () => {
      const nepaliTime = loadModuleAt(23, 59);
      expect(nepaliTime.getActiveSessionType()).toBe("combo");
    });

    test("returns 'combo' just after midnight (00:00)", () => {
      const nepaliTime = loadModuleAt(0, 0);
      expect(nepaliTime.getActiveSessionType()).toBe("combo");
    });

    test("returns 'combo' at 03:59 (last minute of window)", () => {
      const nepaliTime = loadModuleAt(3, 59);
      expect(nepaliTime.getActiveSessionType()).toBe("combo");
    });

    test("returns null at 04:00 (window closed)", () => {
      const nepaliTime = loadModuleAt(4, 0);
      expect(nepaliTime.getActiveSessionType()).toBeNull();
    });
  });

  describe("getSessionActiveDate", () => {
    test("khaja session uses today's date", () => {
      const nepaliTime = loadModuleAt(13, 0);
      const today = nepaliTime.getTodayNP();
      expect(nepaliTime.getSessionActiveDate("khaja")).toBe(today);
    });

    test("combo session before midnight (e.g. 23:00) uses today's date", () => {
      const nepaliTime = loadModuleAt(23, 0);
      const today = nepaliTime.getTodayNP();
      expect(nepaliTime.getSessionActiveDate("combo")).toBe(today);
    });

    test("combo session after midnight (e.g. 02:00) uses YESTERDAY's date", () => {
      const nepaliTime = loadModuleAt(2, 0);
      const today = nepaliTime.getTodayNP();
      const activeDate = nepaliTime.getSessionActiveDate("combo");
      expect(activeDate).not.toBe(today);
      const todayDate = new Date(`${today}T00:00:00Z`);
      const expectedYesterday = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000);
      expect(activeDate).toBe(expectedYesterday.toISOString().slice(0, 10));
    });

    test("combo session at exactly 04:00 (boundary, technically outside window) still computed without throwing", () => {
      const nepaliTime = loadModuleAt(4, 0);
      expect(() => nepaliTime.getSessionActiveDate("combo")).not.toThrow();
    });

    test("non-combo type at 02:00 uses today's date (only combo shifts backward)", () => {
      const nepaliTime = loadModuleAt(2, 0);
      const today = nepaliTime.getTodayNP();
      expect(nepaliTime.getSessionActiveDate("khaja")).toBe(today);
    });
  });
});
