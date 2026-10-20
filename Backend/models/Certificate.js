const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema(
  {
    certificateId: {
      type: String,
      required: true,
      unique: true,
    },

    vehicleNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    ownerName: {
      type: String,
      required: true,
      trim: true,
    },

    fuelType: {
      type: String,
      required: true,
      enum: ["Petrol", "Diesel", "CNG", "Electric"],
    },

    vehicleType: {
      type: String,
      required: true,
      enum: ["Car", "Bike", "Auto", "Truck", "Bus"],
    },

    testDate: {
      type: Date,
      required: true,
    },

    validUntil: {
      type: Date,
      required: true,
    },

    emissionResult: {
      co:     { type: Number, required: true },
      hc:     { type: Number, required: true },
      result: { type: String, required: true, enum: ["Pass", "Fail"] },
    },

    centreId: {
      type: String,
      required: true,
      trim: true,
    },

    ownerWallet: {
      type: String,
      default: null,
    },

    // Numeric ID returned by the smart contract
    blockchainCertId: {
      type: String,
      default: null,
    },

    // sha256 hash of key certificate fields
    certificateHash: {
      type: String,
      default: null,
    },

    // Ethereum transaction hash from issueCertificate()
    transactionHash: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "revoked", "expired"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Certificate", certificateSchema);
