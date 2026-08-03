const router = require("express").Router();
const { protect } = require("../middleware/auth");
const { validateObjectId } = require("../middleware/sanitize");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { sendSuccess } = require("../utils/response");
const catchAsync = require("../utils/catchAsync");

router.use(protect);

router.delete("/addresses/:addressId",
  // FIX: validate ID format before hitting the DB
  validateObjectId("addressId"),
  catchAsync(async (req, res) => {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.addressId);
    // FIX: return 404 if address doesn't exist
    if (!addr) throw new AppError("Address not found", 404);
    // FIX: use deleteOne() — .remove() was removed in Mongoose 8 and will crash
    addr.deleteOne();
    await user.save();
    sendSuccess(res, { addresses: user.addresses }, "Address removed");
  })
);

module.exports = router;
