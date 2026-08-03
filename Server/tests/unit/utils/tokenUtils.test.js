const jwt = require("jsonwebtoken");
const { signAccessToken, signRefreshToken, sendTokens } = require("../../../utils/tokenUtils");

describe("signAccessToken", () => {
  test("produces a verifiable JWT with id, role, tv claims", () => {
    const token = signAccessToken("user123", "customer", 2);
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "gharko-swad",
      audience: "gharko-swad-client",
    });
    expect(decoded.id).toBe("user123");
    expect(decoded.role).toBe("customer");
    expect(decoded.tv).toBe(2);
  });

  test("defaults tokenVersion to 0 when omitted", () => {
    const token = signAccessToken("user123", "admin");
    const decoded = jwt.decode(token);
    expect(decoded.tv).toBe(0);
  });

  test("sets issuer and audience claims", () => {
    const token = signAccessToken("u1", "customer", 0);
    const decoded = jwt.decode(token);
    expect(decoded.iss).toBe("gharko-swad");
    expect(decoded.aud).toBe("gharko-swad-client");
  });

  test("uses HS256 algorithm explicitly", () => {
    const token = signAccessToken("u1", "customer", 0);
    const header = JSON.parse(Buffer.from(token.split(".")[0], "base64").toString());
    expect(header.alg).toBe("HS256");
  });

  test("rejects verification with the wrong secret", () => {
    const token = signAccessToken("u1", "customer", 0);
    expect(() => jwt.verify(token, "wrong-secret")).toThrow();
  });
});

describe("signRefreshToken", () => {
  test("produces a JWT signed with the refresh secret, containing id and a unique jti", () => {
    const token = signRefreshToken("user123");
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
      algorithms: ["HS256"],
      issuer: "gharko-swad",
      audience: "gharko-swad-client",
    });
    expect(decoded.id).toBe("user123");
    expect(decoded.jti).toBeDefined();
  });

  test("generates a different jti on each call (uniqueness)", () => {
    const t1 = jwt.decode(signRefreshToken("user123"));
    const t2 = jwt.decode(signRefreshToken("user123"));
    expect(t1.jti).not.toBe(t2.jti);
  });

  test("cannot be verified using the access-token secret", () => {
    const token = signRefreshToken("user123");
    expect(() => jwt.verify(token, process.env.JWT_SECRET)).toThrow();
  });
});

describe("sendTokens", () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  const mockUser = (overrides = {}) => ({
    _id: "u1",
    role: "customer",
    tokenVersion: 0,
    setRefreshToken: jest.fn(),
    save: jest.fn().mockResolvedValue(true),
    toJSON: jest.fn().mockReturnValue({ _id: "u1", name: "Rozina" }),
    ...overrides,
  });

  test("stores the refresh token hash on the user via setRefreshToken", async () => {
    const user = mockUser();
    await sendTokens(user, 200, mockRes());
    expect(user.setRefreshToken).toHaveBeenCalledTimes(1);
    expect(typeof user.setRefreshToken.mock.calls[0][0]).toBe("string");
  });

  test("saves the user without re-running full validation", async () => {
    const user = mockUser();
    await sendTokens(user, 200, mockRes());
    expect(user.save).toHaveBeenCalledWith({ validateBeforeSave: false });
  });

  test("responds with status code, accessToken, refreshToken, and sanitized user", async () => {
    const user = mockUser();
    const res = mockRes();
    await sendTokens(user, 201, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(typeof payload.accessToken).toBe("string");
    expect(typeof payload.refreshToken).toBe("string");
    expect(payload.user).toEqual({ _id: "u1", name: "Rozina" });
  });

  test("the issued accessToken carries the user's id, role, and tokenVersion", async () => {
    const user = mockUser({ tokenVersion: 5, role: "admin" });
    const res = mockRes();
    await sendTokens(user, 200, res);
    const { accessToken } = res.json.mock.calls[0][0];
    const decoded = jwt.decode(accessToken);
    expect(decoded.id).toBe("u1");
    expect(decoded.role).toBe("admin");
    expect(decoded.tv).toBe(5);
  });
});
