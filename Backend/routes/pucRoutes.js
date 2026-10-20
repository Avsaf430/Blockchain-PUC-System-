const express       = require("express");
const router        = express.Router();
const pucController = require("../controller/pucController");

router.get("/dashboard",    pucController.getDashboard);
router.post("/issue",       pucController.issueCertificate);
router.get("/certificates", pucController.getIssuedCertificates);

module.exports = router;
