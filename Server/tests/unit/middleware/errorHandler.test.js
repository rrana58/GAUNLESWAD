jest.mock("../../../utils/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
  securityLogger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
const { logger, securityLogger } = require("../../../utils/logger");
const errorHandler = require("../../../middleware/errorHandler");
const AppError = require("../../../utils/AppError");

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (overrides = {}) => ({
  requestId: "req-1",
  method: "GET",
  originalUrl: "/api/test",
  ip: "127.0.0.1",
  body: {},
  ...overrides,
});

describe("errorHandler", () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.clearAllMocks();
  });

  test("uses err.statusCode and err.message for operational AppErrors", () => {
    const err = new AppError("Order not found", 404);
    const req = mockReq();
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Order not found", requestId: "req-1" })
    );
  });

  test("transforms a Mongoose CastError into a 400 'Invalid ID format.'", () => {
    const err = { name: "CastError", message: "Cast to ObjectId failed" };
    const req = mockReq();
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Invalid ID format." }));
  });

  test("transforms a duplicate key error (phone) into a 409 with a friendly label", () => {
    const err = { code: 11000, keyValue: { phone: "9812345678" } };
    const req = mockReq();
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Phone number is already registered." })
    );
  });

  test("transforms a duplicate key error (slug) into a meal-plan specific message", () => {
    const err = { code: 11000, keyValue: { slug: "family-thali-pack" } };
    const req = mockReq();
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'A meal plan with the name "family thali pack" already exists. Please use a different name.',
      })
    );
  });

  test("transforms a duplicate key error with an unknown field using a generic label", () => {
    const err = { code: 11000, keyValue: { someWeirdField: "x" } };
    const req = mockReq();
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "This value is already registered." })
    );
  });

  test("transforms a Mongoose ValidationError joining all messages", () => {
    const err = {
      name: "ValidationError",
      errors: {
        name: { message: "Name is required" },
        phone: { message: "Enter a valid Nepal mobile number" },
      },
    };
    const req = mockReq();
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Name is required. Enter a valid Nepal mobile number" })
    );
  });

  test("transforms JsonWebTokenError into 401 'Invalid token.'", () => {
    const err = { name: "JsonWebTokenError", message: "jwt malformed" };
    const req = mockReq();
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Invalid token." }));
  });

  test("transforms TokenExpiredError into 401 session-expired message", () => {
    const err = { name: "TokenExpiredError", message: "jwt expired" };
    const req = mockReq();
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Session expired. Please log in again." })
    );
  });

  test("transforms Multer LIMIT_FILE_SIZE into 400", () => {
    const err = { code: "LIMIT_FILE_SIZE", message: "File too large" };
    const req = mockReq();
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "File too large. Maximum 5MB allowed." })
    );
  });

  test("transforms Multer LIMIT_UNEXPECTED_FILE into 400", () => {
    const err = { code: "LIMIT_UNEXPECTED_FILE" };
    const req = mockReq();
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Unexpected file field." }));
  });

  test("defaults to 500 for unrecognized, non-operational errors", () => {
    const err = new Error("Something exploded");
    const req = mockReq();
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("hides internal error messages in production for non-operational errors", () => {
    process.env.NODE_ENV = "production";
    const err = new Error("Leaked DB connection string");
    const req = mockReq();
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Something went wrong. Please try again later." })
    );
  });

  test("shows the real error message in non-production for non-operational errors", () => {
    process.env.NODE_ENV = "test";
    const err = new Error("Detailed dev error");
    const req = mockReq();
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Detailed dev error" }));
  });

  test("includes stack and error name only in development for non-operational errors", () => {
    process.env.NODE_ENV = "development";
    const err = new Error("Boom");
    const req = mockReq();
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    const payload = res.json.mock.calls[0][0];
    expect(payload.stack).toBeDefined();
    expect(payload.error).toBe("Error");
  });

  test("does not include stack trace outside development", () => {
    process.env.NODE_ENV = "test";
    const err = new Error("Boom");
    const req = mockReq();
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    const payload = res.json.mock.calls[0][0];
    expect(payload.stack).toBeUndefined();
  });

  test("logs 5xx errors via logger.error", () => {
    const err = new Error("Server crash");
    const req = mockReq();
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    expect(logger.error).toHaveBeenCalled();
  });

  test("logs 401/403 errors via securityLogger.warn", () => {
    const err = new AppError("Forbidden", 403);
    const req = mockReq();
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    expect(securityLogger.warn).toHaveBeenCalled();
  });

  test("does not log request body in production (PII protection)", () => {
    process.env.NODE_ENV = "production";
    const err = new Error("Server crash");
    const req = mockReq({ body: { password: "secret123" } });
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    const logCallMeta = logger.error.mock.calls[0][1];
    expect(logCallMeta.body).toBeUndefined();
  });

  test("includes requestId in the response when present on req", () => {
    const err = new AppError("Not found", 404);
    const req = mockReq({ requestId: "abc-123" });
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ requestId: "abc-123" }));
  });

  test("omits requestId from the response when absent on req", () => {
    const err = new AppError("Not found", 404);
    const req = mockReq({ requestId: undefined });
    const res = mockRes();
    errorHandler(err, req, res, () => {});
    const payload = res.json.mock.calls[0][0];
    expect(payload.requestId).toBeUndefined();
  });
});
