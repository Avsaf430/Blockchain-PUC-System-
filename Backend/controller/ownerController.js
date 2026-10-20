"use strict";

const Certificate = require("../models/Certificate");

function getProfile(req, res) {
  return res.status(200).json({
    success: true,
    message: "Owner profile endpoint.",
  });
}

// GET /api/owner/search?name=...&email=...&wallet=...
async function searchCertificates(req, res) {
  try {
    const { name, email, wallet } = req.query || {};
    const conditions = [];

    if (name && String(name).trim()) {
      conditions.push({ ownerName: new RegExp("^" + String(name).trim() + "$", "i") });
    }

    if (email && String(email).trim()) {
      conditions.push({ ownerEmail: new RegExp("^" + String(email).trim() + "$", "i") });
    }

    if (wallet && String(wallet).trim()) {
      conditions.push({ ownerWallet: new RegExp("^" + String(wallet).trim() + "$", "i") });
    }

    if (conditions.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        certificates: [],
      });
    }

    const certificates = await Certificate.find({ $or: conditions }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: certificates.length,
      certificates,
    });
  } catch (error) {
    console.error("Search owner certificates error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error searching owner certificates.",
    });
  }
}

// GET /api/owner/:walletAddress/certificates
async function getCertificates(req, res) {
  const walletAddress = String(req.params.walletAddress || "").trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return res.status(400).json({
      success: false,
      message: "A valid owner wallet address is required.",
    });
  }

  try {
    const certificates = await Certificate.find({
      ownerWallet: new RegExp("^" + walletAddress + "$", "i"),
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      walletAddress,
      count: certificates.length,
      certificates,
    });
  } catch (error) {
    console.error("Owner certificates error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error retrieving owner certificates.",
    });
  }
}

module.exports = {
  getProfile,
  searchCertificates,
  getCertificates,
};
