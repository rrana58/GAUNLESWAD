const catchAsync = require("../../../utils/catchAsync");

describe("catchAsync", () => {
  test("calls the wrapped function with req, res, next", async () => {
    const fn = jest.fn().mockResolvedValue();
    const req = {}, res = {}, next = jest.fn();
    await catchAsync(fn)(req, res, next);
    expect(fn).toHaveBeenCalledWith(req, res, next);
  });

  test("forwards a rejected promise's error to next()", async () => {
    const error = new Error("boom");
    const fn = jest.fn().mockRejectedValue(error);
    const req = {}, res = {}, next = jest.fn();
    await catchAsync(fn)(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });

  test("does not call next() when the function resolves successfully", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    const req = {}, res = {}, next = jest.fn();
    await catchAsync(fn)(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  test("does NOT protect against a synchronous throw inside fn (known limitation: catchAsync only wraps the resolved promise, so a throw before any await escapes synchronously)", () => {
    const error = new Error("sync boom");
    const fn = jest.fn(() => { throw error; });
    const req = {}, res = {}, next = jest.fn();
    expect(() => catchAsync(fn)(req, res, next)).toThrow("sync boom");
  });

  test("returns a function (middleware signature)", () => {
    const wrapped = catchAsync(() => {});
    expect(typeof wrapped).toBe("function");
    expect(wrapped.length).toBe(3);
  });
});
