"use strict";

const express = require("express");
const router = express.Router();
const ownerController = require("../controller/ownerController");

router.get("/profile", ownerController.getProfile);
router.get("/search", ownerController.searchCertificates);
router.get("/:walletAddress/certificates", ownerController.getCertificates);

module.exports = router;
