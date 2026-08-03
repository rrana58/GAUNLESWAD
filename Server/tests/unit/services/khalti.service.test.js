jest.mock("../../../utils/logger", () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

// axios.create returns an instance used as khaltiClient — must mock before require
const mockPost = jest.fn();
jest.mock("axios", () => ({
  create: jest.fn(() => ({ post: mockPost })),
}));

const { initiateKhaltiPayment, verifyKhaltiPayment } = require("../../../services/khalti.service");

describe("initiateKhaltiPayment", () => {
  afterEach(() => jest.clearAllMocks());

  test("converts amount to paisa (multiplies by 100) and returns pidx + paymentUrl", async () => {
    mockPost.mockResolvedValue({ data: { pidx: "pidx123", payment_url: "https://khalti.com/pay/abc" } });

    const result = await initiateKhaltiPayment({
      orderId: "order1",
      orderNumber: "GS-1",
      amount: 500,
      customerName: "Rozina",
      customerPhone: "9812345678",
      customerEmail: "r@test.com",
      returnUrl: "http://localhost:3000/return",
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/epayment/initiate/",
      expect.objectContaining({ amount: 50000, purchase_order_id: "order1" })
    );
    expect(result).toEqual({ success: true, pidx: "pidx123", paymentUrl: "https://khalti.com/pay/abc" });
  });

  test("includes customer info in the request payload", async () => {
    mockPost.mockResolvedValue({ data: { pidx: "p1", payment_url: "url" } });
    await initiateKhaltiPayment({
      orderId: "o1", orderNumber: "GS-1", amount: 100,
      customerName: "Rozina", customerPhone: "9812345678", customerEmail: "r@test.com",
      returnUrl: "http://x.com",
    });
    expect(mockPost.mock.calls[0][1].customer_info).toEqual({
      name: "Rozina", email: "r@test.com", phone: "9812345678",
    });
  });

  test("returns success:false with the API's error detail on failure", async () => {
    mockPost.mockRejectedValue({ response: { data: { detail: "Invalid merchant key" } } });
    const result = await initiateKhaltiPayment({
      orderId: "o1", orderNumber: "GS-1", amount: 100,
      customerName: "R", customerPhone: "98", customerEmail: "r@t.com", returnUrl: "x",
    });
    expect(result).toEqual({ success: false, error: "Invalid merchant key" });
  });

  test("falls back to error.message when no response detail is available", async () => {
    mockPost.mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await initiateKhaltiPayment({
      orderId: "o1", orderNumber: "GS-1", amount: 100,
      customerName: "R", customerPhone: "98", customerEmail: "r@t.com", returnUrl: "x",
    });
    expect(result).toEqual({ success: false, error: "ECONNREFUSED" });
  });
});

describe("verifyKhaltiPayment", () => {
  afterEach(() => jest.clearAllMocks());

  test("converts total_amount from paisa back to rupees", async () => {
    mockPost.mockResolvedValue({
      data: { status: "Completed", transaction_id: "txn1", total_amount: 50000 },
    });
    const result = await verifyKhaltiPayment("pidx123");
    expect(result.success).toBe(true);
    expect(result.amount).toBe(500);
    expect(result.status).toBe("Completed");
    expect(result.transactionId).toBe("txn1");
  });

  test("calls the lookup endpoint with the given pidx", async () => {
    mockPost.mockResolvedValue({ data: { status: "Pending", total_amount: 0 } });
    await verifyKhaltiPayment("pidx-xyz");
    expect(mockPost).toHaveBeenCalledWith("/epayment/lookup/", { pidx: "pidx-xyz" });
  });

  test("returns success:false on verification failure", async () => {
    mockPost.mockRejectedValue({ response: { data: { detail: "pidx not found" } } });
    const result = await verifyKhaltiPayment("bad-pidx");
    expect(result).toEqual({ success: false, error: "pidx not found" });
  });

  test("includes the raw gateway response for auditing", async () => {
    const raw = { status: "Completed", transaction_id: "t1", total_amount: 1000 };
    mockPost.mockResolvedValue({ data: raw });
    const result = await verifyKhaltiPayment("p1");
    expect(result.raw).toEqual(raw);
  });
});
