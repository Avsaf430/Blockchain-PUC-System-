const crypto      = require("crypto");
const Certificate = require("../models/Certificate");

// Auto-generate IDs like PUC2026001, PUC2026002 ...
async function generateCertificateId() {
  const year   = new Date().getFullYear();
  const prefix = "PUC" + year;

  // Find the last certificate with this year's prefix
  const last = await Certificate
    .findOne({ certificateId: { $regex: "^" + prefix } })
    .sort({ certificateId: -1 });

  if (!last) {
    return prefix + "001";
  }

  const lastNumber = parseInt(last.certificateId.replace(prefix, ""), 10);
  const nextNumber = String(lastNumber + 1).padStart(3, "0");
  return prefix + nextNumber;
}

// POST /api/puc/issue
async function issueCertificate(req, res) {
  try {
    const {
      vehicleNumber,
      ownerName,
      fuelType,
      vehicleType,
      testDate,
      validUntil,
      co,
      hc,
      result,
      centreId,
      ownerWallet,
      transactionHash,
      blockchainCertId,
    } = req.body || {};

    // Validate required fields
    if (
      !vehicleNumber || !ownerName  || !fuelType   || !vehicleType ||
      !testDate      || !validUntil || !centreId   || !result      ||
      co === undefined || co === "" ||
      hc === undefined || hc === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided.",
      });
    }

    if (!["Pass", "Fail"].includes(result)) {
      return res.status(400).json({
        success: false,
        message: "result must be Pass or Fail.",
      });
    }

    const testDateObj   = new Date(testDate);
    const validUntilObj = new Date(validUntil);

    if (isNaN(testDateObj) || isNaN(validUntilObj)) {
      return res.status(400).json({
        success: false,
        message: "Invalid testDate or validUntil.",
      });
    }

    if (validUntilObj < testDateObj) {
      return res.status(400).json({
        success: false,
        message: "validUntil cannot be before testDate.",
      });
    }

    const certificateId = await generateCertificateId();

    // Create a sha256 hash of the certificate's key fields
    const hashInput     = vehicleNumber + "|" + testDate + "|" + centreId + "|" + certificateId;
    const certificateHash = "0x" + crypto.createHash("sha256").update(hashInput).digest("hex");

    const certificate = new Certificate({
      certificateId,
      vehicleNumber:    vehicleNumber.toUpperCase().trim(),
      ownerName:        ownerName.trim(),
      fuelType,
      vehicleType,
      testDate:         testDateObj,
      validUntil:       validUntilObj,
      emissionResult: {
        co:     parseFloat(co),
        hc:     parseInt(hc, 10),
        result,
      },
      centreId:         centreId.trim(),
      ownerWallet:      ownerWallet     || null,
      blockchainCertId: blockchainCertId ? String(blockchainCertId) : null,
      certificateHash,
      transactionHash:  transactionHash || null,
      status:           "active",
    });

    await certificate.save();

    return res.status(201).json({
      success:       true,
      message:       "Certificate issued successfully.",
      certificateId,
      certificate,
    });

  } catch (error) {
    console.error("issueCertificate error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error while issuing certificate.",
    });
  }
}

// GET /api/puc/certificates?centreId=CENTRE001
async function getIssuedCertificates(req, res) {
  try {
    const filter = {};
    if (req.query.centreId) {
      filter.centreId = req.query.centreId;
    }

    const certificates = await Certificate.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, certificates });

  } catch (error) {
    console.error("getIssuedCertificates error:", error.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
}

// GET /api/puc/dashboard
function getDashboard(req, res) {
  return res.status(200).json({
    success: true,
    message: "PUC Centre API is running.",
  });
}

module.exports = {
  issueCertificate,
  getIssuedCertificates,
  getDashboard,
};
