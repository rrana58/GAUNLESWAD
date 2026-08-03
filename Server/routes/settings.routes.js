const router = require("express").Router();
const { getPublicSettings } = require("../controllers/settings.controller");
router.get("/public", getPublicSettings);
module.exports = router;