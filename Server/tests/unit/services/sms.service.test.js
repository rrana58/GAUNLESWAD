jest.mock("axios");
jest.mock("../../../utils/logger", () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));
const axios = require("axios");
const { sendSMS, sendOTP, sendOrderStatusSMS } = require("../../../services/sms.service");

describe("sendSMS", () => {
  afterEach(() => jest.clearAllMocks());

  test("returns success when Sparrow responds with response_code 200", async () => {
    axios.get.mockResolvedValue({ data: { response_code: 200 } });
    const result = await sendSMS("9812345678", "Hello");
    expect(result).toEqual({ success: true });
    expect(axios.get).toHaveBeenCalledWith(
      "https://api.sparrowsms.com/v2/sms",
      expect.objectContaining({
        params: expect.objectContaining({ to: "9812345678", text: "Hello" }),
      })
    );
  });

  test("returns failure when Sparrow responds with a non-200 response_code", async () => {
    axios.get.mockResolvedValue({ data: { response_code: 400, response: "Invalid" } });
    const result = await sendSMS("9812345678", "Hello");
    expect(result.success).toBe(false);
    expect(result.error).toEqual({ response_code: 400, response: "Invalid" });
  });

  test("returns failure and does not throw on a network error", async () => {
    axios.get.mockRejectedValue(new Error("Network timeout"));
    const result = await sendSMS("9812345678", "Hello");
    expect(result).toEqual({ success: false, error: "Network timeout" });
  });

  test("uses the HTTPS Sparrow endpoint (not HTTP)", async () => {
    axios.get.mockResolvedValue({ data: { response_code: 200 } });
    await sendSMS("9812345678", "Hello");
    expect(axios.get.mock.calls[0][0]).toMatch(/^https:\/\//);
  });
});

describe("sendOTP", () => {
  afterEach(() => jest.clearAllMocks());

  test("formats an OTP message containing the code and validity window", async () => {
    axios.get.mockResolvedValue({ data: { response_code: 200 } });
    await sendOTP("9812345678", "123456");
    const params = axios.get.mock.calls[0][1].params;
    expect(params.text).toContain("123456");
    expect(params.text).toContain("10 minutes");
  });
});

describe("sendOrderStatusSMS", () => {
  afterEach(() => jest.clearAllMocks());

  test.each([
    ["confirmed", /confirmed/i],
    ["preparing", /prepared/i],
    ["ready", /way/i],
    ["out_for_delivery", /delivery/i],
    ["delivered", /delivered/i],
    ["cancelled", /cancelled/i],
  ])("sends an appropriate message for status '%s'", async (status, pattern) => {
    axios.get.mockResolvedValue({ data: { response_code: 200 } });
    await sendOrderStatusSMS("9812345678", "GS-20260626-1234", status);
    const text = axios.get.mock.calls[0][1].params.text;
    expect(text).toMatch(pattern);
    expect(text).toContain("GS-20260626-1234");
  });

  test("falls back to a generic status message for an unrecognized status", async () => {
    axios.get.mockResolvedValue({ data: { response_code: 200 } });
    await sendOrderStatusSMS("9812345678", "GS-1", "some_unknown_status");
    const text = axios.get.mock.calls[0][1].params.text;
    expect(text).toBe("Your order GS-1 status: some_unknown_status");
  });
});
