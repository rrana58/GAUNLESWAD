jest.mock("../../../models/User");
jest.mock("../../../utils/logger", () => ({
  securityLogger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const jwt = require("jsonwebtoken");
const User = require("../../../models/User");
const { protect, restrictTo, optionalAuth, requireOwnership } = require("../../../middleware/auth");
const AppError = require("../../../utils/AppError");

const signValidToken = (payload, secret = process.env.JWT_SECRET, opts = {}) =>
  jwt.sign(payload, secret, {
    algorithm: "HS256",
    issuer: "gharko-swad",
    audience: "gharko-swad-client",
    expiresIn: "15m",
    ...opts,
  });

const mockReq = (overrides = {}) => ({ headers: {}, ip: "1.2.3.4", ...overrides });
const mockRes = () => ({});
const flush = () => new Promise((r) => setImmediate(r));

describe("protect middleware", () => {
  beforeEach(() => jest.clearAllMocks());

  test("throws 401 when no Authorization header is present", async () => {
    const req = mockReq();
    const next = jest.fn();
    await protect(req, mockRes(), next);
    await flush();
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  test("throws 401 for a token longer than 2048 chars", async () => {
    const req = mockReq({ headers: { authorization: `Bearer ${"a".repeat(2049)}` } });
    const next = jest.fn();
    await protect(req, mockRes(), next);
    await flush();
    expect(next.mock.calls[0][0].statusCode).toBe(401);
    expect(next.mock.calls[0][0].message).toBe("Invalid token.");
  });

  test("throws 401 for an invalid/malformed JWT", async () => {
    const req = mockReq({ headers: { authorization: "Bearer not-a-real-token" } });
    const next = jest.fn();
    await protect(req, mockRes(), next);
    await flush();
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  test("throws 401 with 'Session expired' for an expired token", async () => {
    const token = signValidToken({ id: "u1", role: "customer", tv: 0 }, process.env.JWT_SECRET, { expiresIn: -10 });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const next = jest.fn();
    await protect(req, mockRes(), next);
    await flush();
    expect(next.mock.calls[0][0].message).toBe("Session expired. Please log in again.");
  });

  test("throws 401 when token uses the wrong secret", async () => {
    const token = jwt.sign({ id: "u1", role: "customer", tv: 0 }, "wrong-secret", {
      algorithm: "HS256", issuer: "gharko-swad", audience: "gharko-swad-client", expiresIn: "15m",
    });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const next = jest.fn();
    await protect(req, mockRes(), next);
    await flush();
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  test("throws 401 when claims are missing id or role", async () => {
    const token = signValidToken({ tv: 0 }); // missing id and role
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const next = jest.fn();
    await protect(req, mockRes(), next);
    await flush();
    expect(next.mock.calls[0][0].message).toBe("Invalid token.");
  });

  test("throws 401 when user is not found in DB", async () => {
    const token = signValidToken({ id: "u1", role: "customer", tv: 0 });
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const next = jest.fn();
    await protect(req, mockRes(), next);
    await flush();
    expect(next.mock.calls[0][0].message).toBe("Account not found.");
  });

  test("throws 401 when account is deactivated", async () => {
    const token = signValidToken({ id: "u1", role: "customer", tv: 0 });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: "u1", isActive: false, tokenVersion: 0 }),
    });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const next = jest.fn();
    await protect(req, mockRes(), next);
    await flush();
    expect(next.mock.calls[0][0].message).toBe("Account deactivated. Contact support.");
  });

  test("throws 401 when tokenVersion does not match (stale/invalidated token)", async () => {
    const token = signValidToken({ id: "u1", role: "customer", tv: 0 });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: "u1", isActive: true, tokenVersion: 5 }),
    });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const next = jest.fn();
    await protect(req, mockRes(), next);
    await flush();
    expect(next.mock.calls[0][0].message).toBe("Session invalidated. Please log in again.");
  });

  test("attaches req.user and req.token, then calls next() with no args on success", async () => {
    const token = signValidToken({ id: "u1", role: "customer", tv: 0 });
    const fakeUser = { _id: "u1", isActive: true, tokenVersion: 0, role: "customer" };
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const next = jest.fn();
    await protect(req, mockRes(), next);
    await flush();
    expect(req.user).toBe(fakeUser);
    expect(req.token).toBe(token);
    expect(next).toHaveBeenCalledWith();
  });
});

describe("restrictTo", () => {
  test("calls next(AppError 401) when req.user is missing", () => {
    const req = {};
    const next = jest.fn();
    restrictTo("admin")(req, mockRes(), next);
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  test("calls next(AppError 403) when user's role is not allowed", () => {
    const req = { user: { _id: "u1", role: "customer" }, originalUrl: "/api/admin" };
    const next = jest.fn();
    restrictTo("admin")(req, mockRes(), next);
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  test("calls next() with no error when role is permitted", () => {
    const req = { user: { _id: "u1", role: "admin" } };
    const next = jest.fn();
    restrictTo("admin", "delivery")(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  test("supports multiple allowed roles", () => {
    const req = { user: { _id: "u1", role: "delivery" } };
    const next = jest.fn();
    restrictTo("admin", "delivery")(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe("optionalAuth", () => {
  beforeEach(() => jest.clearAllMocks());

  test("proceeds without req.user when no token is provided", async () => {
    const req = mockReq();
    const next = jest.fn();
    await optionalAuth(req, mockRes(), next);
    await flush();
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  test("proceeds silently for an invalid token (does not throw)", async () => {
    const req = mockReq({ headers: { authorization: "Bearer garbage" } });
    const next = jest.fn();
    await optionalAuth(req, mockRes(), next);
    await flush();
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  test("proceeds silently for an oversized token", async () => {
    const req = mockReq({ headers: { authorization: `Bearer ${"a".repeat(2049)}` } });
    const next = jest.fn();
    await optionalAuth(req, mockRes(), next);
    await flush();
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  test("attaches req.user for a valid token with matching tokenVersion", async () => {
    const token = signValidToken({ id: "u1", role: "customer", tv: 0 });
    const fakeUser = { _id: "u1", isActive: true, tokenVersion: 0 };
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const next = jest.fn();
    await optionalAuth(req, mockRes(), next);
    await flush();
    expect(req.user).toBe(fakeUser);
    expect(next).toHaveBeenCalledWith();
  });

  test("does not attach req.user when tokenVersion mismatches", async () => {
    const token = signValidToken({ id: "u1", role: "customer", tv: 0 });
    User.findById.mockResolvedValue({ _id: "u1", isActive: true, tokenVersion: 9 });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const next = jest.fn();
    await optionalAuth(req, mockRes(), next);
    await flush();
    expect(req.user).toBeUndefined();
  });

  test("does not attach req.user for an inactive account", async () => {
    const token = signValidToken({ id: "u1", role: "customer", tv: 0 });
    User.findById.mockResolvedValue({ _id: "u1", isActive: false, tokenVersion: 0 });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const next = jest.fn();
    await optionalAuth(req, mockRes(), next);
    await flush();
    expect(req.user).toBeUndefined();
  });
});

describe("requireOwnership", () => {
  test("returns 404 AppError when resource is not found", async () => {
    const getResourceUserId = jest.fn().mockResolvedValue(null);
    const req = { user: { _id: "u1", role: "customer" } };
    const next = jest.fn();
    await requireOwnership(getResourceUserId)(req, mockRes(), next);
    await flush();
    expect(next.mock.calls[0][0].statusCode).toBe(404);
  });

  test("allows admins to bypass ownership checks", async () => {
    const getResourceUserId = jest.fn().mockResolvedValue("someOtherUser");
    const req = { user: { _id: "u1", role: "admin" } };
    const next = jest.fn();
    await requireOwnership(getResourceUserId)(req, mockRes(), next);
    await flush();
    expect(next).toHaveBeenCalledWith();
  });

  test("allows access when resource belongs to the requesting user", async () => {
    const getResourceUserId = jest.fn().mockResolvedValue("u1");
    const req = { user: { _id: { toString: () => "u1" }, role: "customer" } };
    const next = jest.fn();
    await requireOwnership(getResourceUserId)(req, mockRes(), next);
    await flush();
    expect(next).toHaveBeenCalledWith();
  });

  test("throws 403 when a non-admin tries to access another user's resource", async () => {
    const getResourceUserId = jest.fn().mockResolvedValue("otherUserId");
    const req = { user: { _id: { toString: () => "u1" }, role: "customer" } };
    const next = jest.fn();
    await requireOwnership(getResourceUserId)(req, mockRes(), next);
    await flush();
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });
});
