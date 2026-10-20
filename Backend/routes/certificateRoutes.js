const express     = require("express");
const router      = express.Router();
const Certificate = require("../models/Certificate");

// GET /api/certificates/:id
// Accepts a certificateId like "PUC2026001"
// or a blockchainCertId like "1"
router.get("/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Certificate ID is required.",
    });
  }

  try {
    const certificate = await Certificate.findOne({
      $or: [
        { certificateId:   id },
        { blockchainCertId: id },
      ],
    });

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found.",
      });
    }

    return res.status(200).json({ success: true, certificate });

  } catch (error) {
    console.error("getCertificate error:", error.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

module.exports = router;
