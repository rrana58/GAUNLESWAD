const CelebrationPackage = require("../models/CelebrationPackage");

exports.getPackages = async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.celebrationType = req.query.type;
    if (req.query.active === 'true') filter.isActive = true;

    const packages = await CelebrationPackage.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, packages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createPackage = async (req, res) => {
  try {
    const pkg = new CelebrationPackage({ ...req.body, createdBy: req.user._id });
    await pkg.save();
    res.status(201).json({ success: true, package: pkg });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updatePackage = async (req, res) => {
  try {
    const pkg = await CelebrationPackage.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!pkg) return res.status(404).json({ success: false, message: "Package not found" });
    res.json({ success: true, package: pkg });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deletePackage = async (req, res) => {
  try {
    const pkg = await CelebrationPackage.findByIdAndDelete(req.params.id);
    if (!pkg) return res.status(404).json({ success: false, message: "Package not found" });
    res.json({ success: true, message: "Package deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCelebrationTypes = async (req, res) => {
  try {
    const types = await CelebrationPackage.distinct("celebrationType", { isActive: true });
    res.json({ success: true, types });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
