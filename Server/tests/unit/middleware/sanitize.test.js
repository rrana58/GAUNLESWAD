const mongoose = require("mongoose");
const { sanitizeInput, validateObjectId, allowFields } = require("../../../middleware/sanitize");

describe("sanitizeInput", () => {
  test("strips <script> tags from string body values", () => {
    const req = { body: { name: '<script>alert(1)</script>John' }, query: {} };
    const res = {};
    const next = jest.fn();
    sanitizeInput(req, res, next);
    expect(req.body.name).not.toContain("<script>");
    expect(next).toHaveBeenCalled();
  });

  test("trims whitespace from string values", () => {
    const req = { body: { name: "  John  " }, query: {} };
    const res = {};
    const next = jest.fn();
    sanitizeInput(req, res, next);
    expect(req.body.name).toBe("John");
  });

  test("recursively sanitizes nested objects", () => {
    const req = { body: { address: { street: '<img src=x onerror=alert(1)>Thamel' } }, query: {} };
    const res = {};
    const next = jest.fn();
    sanitizeInput(req, res, next);
    expect(req.body.address.street).not.toContain("onerror");
  });

  test("sanitizes arrays of strings", () => {
    const req = { body: { tags: ["<script>x</script>spicy", "veg"] }, query: {} };
    const res = {};
    const next = jest.fn();
    sanitizeInput(req, res, next);
    expect(req.body.tags[0]).not.toContain("<script>");
    expect(req.body.tags[1]).toBe("veg");
  });

  test("leaves non-string, non-object values untouched (numbers, booleans, null)", () => {
    const req = { body: { age: 25, isActive: true, note: null }, query: {} };
    const res = {};
    const next = jest.fn();
    sanitizeInput(req, res, next);
    expect(req.body.age).toBe(25);
    expect(req.body.isActive).toBe(true);
    expect(req.body.note).toBeNull();
  });

  test("does not attempt to sanitize Buffer instances", () => {
    const buf = Buffer.from("hello");
    const req = { body: { file: buf }, query: {} };
    const res = {};
    const next = jest.fn();
    sanitizeInput(req, res, next);
    expect(Buffer.isBuffer(req.body.file)).toBe(true);
  });

  test("sanitizes req.query as well as req.body", () => {
    const req = { body: {}, query: { search: '<script>bad</script>pizza' } };
    const res = {};
    const next = jest.fn();
    sanitizeInput(req, res, next);
    expect(req.query.search).not.toContain("<script>");
  });

  test("does not crash when body/query are absent", () => {
    const req = {};
    const res = {};
    const next = jest.fn();
    expect(() => sanitizeInput(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalled();
  });

  test("does NOT sanitize req.params (left to ObjectId validation)", () => {
    const req = { body: {}, query: {}, params: { id: '<script>x</script>' } };
    const res = {};
    const next = jest.fn();
    sanitizeInput(req, res, next);
    expect(req.params.id).toBe('<script>x</script>');
  });
});

describe("validateObjectId", () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  test("calls next() for a valid ObjectId", () => {
    const id = new mongoose.Types.ObjectId().toString();
    const req = { params: { id } };
    const res = mockRes();
    const next = jest.fn();
    validateObjectId("id")(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("returns 400 for an invalid ObjectId", () => {
    const req = { params: { id: "not-an-object-id" } };
    const res = mockRes();
    const next = jest.fn();
    validateObjectId("id")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Invalid id" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("validates multiple params and fails on the first invalid one", () => {
    const validId = new mongoose.Types.ObjectId().toString();
    const req = { params: { orderId: validId, userId: "bad-id" } };
    const res = mockRes();
    const next = jest.fn();
    validateObjectId("orderId", "userId")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid userId" })
    );
  });

  test("skips validation for params that are not present", () => {
    const req = { params: {} };
    const res = mockRes();
    const next = jest.fn();
    validateObjectId("id")(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe("allowFields", () => {
  test("keeps only the allowed fields in req.body", () => {
    const req = { body: { name: "Rozina", role: "admin", email: "r@test.com" } };
    const res = {};
    const next = jest.fn();
    allowFields("name", "email")(req, res, next);
    expect(req.body).toEqual({ name: "Rozina", email: "r@test.com" });
    expect(req.body.role).toBeUndefined();
  });

  test("prevents mass-assignment of unexpected fields like 'role'", () => {
    const req = { body: { role: "admin", isActive: true } };
    const res = {};
    const next = jest.fn();
    allowFields("name")(req, res, next);
    expect(req.body).toEqual({});
  });

  test("does not error when an allowed field is missing from the body", () => {
    const req = { body: { name: "Rozina" } };
    const res = {};
    const next = jest.fn();
    expect(() => allowFields("name", "email")(req, res, next)).not.toThrow();
    expect(req.body).toEqual({ name: "Rozina" });
  });

  test("leaves req.body untouched if it is not an object", () => {
    const req = { body: null };
    const res = {};
    const next = jest.fn();
    allowFields("name")(req, res, next);
    expect(req.body).toBeNull();
  });

  test("always calls next()", () => {
    const req = { body: {} };
    const res = {};
    const next = jest.fn();
    allowFields("name")(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
