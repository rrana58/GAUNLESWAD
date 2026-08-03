const sendSuccess = (res, data = {}, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    ...data,
  });
};

const sendPaginated = (res, data, total, page, limit) => {
  return res.status(200).json({
    success: true,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
    ...data,
  });
};

module.exports = { sendSuccess, sendPaginated };
