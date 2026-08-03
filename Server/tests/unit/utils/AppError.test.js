const AppError = require("../../../utils/AppError");

describe("AppError", () => {
  test("sets message and statusCode", () => {
    const err = new AppError("Not found", 404);
    expect(err.message).toBe("Not found");
    expect(err.statusCode).toBe(404);
  });

  test("marks error as operational", () => {
    const err = new AppError("Bad request", 400);
    expect(err.isOperational).toBe(true);
  });

  test("is an instance of Error", () => {
    const err = new AppError("Oops", 500);
    expect(err).toBeInstanceOf(Error);
  });

  test("captures a stack trace", () => {
    const err = new AppError("Oops", 500);
    expect(err.stack).toBeDefined();
    expect(typeof err.stack).toBe("string");
  });

  test("different instances carry independent statusCodes", () => {
    const e1 = new AppError("A", 401);
    const e2 = new AppError("B", 403);
    expect(e1.statusCode).toBe(401);
    expect(e2.statusCode).toBe(403);
  });
});
