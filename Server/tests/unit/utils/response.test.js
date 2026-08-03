const { sendSuccess, sendPaginated } = require("../../../utils/response");

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("sendSuccess", () => {
  test("defaults to status 200 and message 'Success'", () => {
    const res = mockRes();
    sendSuccess(res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: "Success" });
  });

  test("merges data into the response body", () => {
    const res = mockRes();
    sendSuccess(res, { user: { id: 1 } }, "Welcome", 201);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Welcome",
      user: { id: 1 },
    });
  });

  test("uses custom status code", () => {
    const res = mockRes();
    sendSuccess(res, {}, "Created", 201);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("sendPaginated", () => {
  test("computes totalPages correctly", () => {
    const res = mockRes();
    sendPaginated(res, { items: [1, 2] }, 25, 1, 10);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      total: 25,
      page: 1,
      limit: 10,
      totalPages: 3,
      items: [1, 2],
    });
  });

  test("handles total of 0", () => {
    const res = mockRes();
    sendPaginated(res, { items: [] }, 0, 1, 10);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ totalPages: 0, total: 0 })
    );
  });

  test("coerces page and limit to numbers", () => {
    const res = mockRes();
    sendPaginated(res, {}, 10, "2", "5");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5 })
    );
  });

  test("always responds with status 200", () => {
    const res = mockRes();
    sendPaginated(res, {}, 10, 1, 5);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
