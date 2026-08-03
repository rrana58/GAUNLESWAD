jest.mock("express-validator");
const { validationResult } = require("express-validator");
const validate = require("../../../middleware/validate");
const AppError = require("../../../utils/AppError");

describe("validate middleware", () => {
  const mockReq = {};
  const mockRes = {};

  test("calls next() with no error when there are no validation errors", () => {
    validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });
    const next = jest.fn();
    validate(mockReq, mockRes, next);
    expect(next).toHaveBeenCalledWith();
  });

  test("calls next(AppError) with status 400 when errors exist", () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: "Phone is required" }],
    });
    const next = jest.fn();
    validate(mockReq, mockRes, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const errArg = next.mock.calls[0][0];
    expect(errArg.statusCode).toBe(400);
    expect(errArg.message).toBe("Phone is required");
  });

  test("joins multiple validation error messages with '. '", () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: "Phone is required" }, { msg: "Password too short" }],
    });
    const next = jest.fn();
    validate(mockReq, mockRes, next);
    const errArg = next.mock.calls[0][0];
    expect(errArg.message).toBe("Phone is required. Password too short");
  });
});
