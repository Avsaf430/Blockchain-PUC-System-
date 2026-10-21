"use strict";

/* =========================================
   DIGITAL PUC BLOCKCHAIN DAPP
   Homepage navigation + Certificate verification
   
   Lookup Priority:
     1. Numeric ID → Ganache Smart Contract (if MetaMask connected)
     2. MongoDB Backend API (http://localhost:5000/api/certificates/:id)
     3. Browser localStorage demo records
========================================= */

document.addEventListener("DOMContentLoaded", function () {

    const API_BASE = "http://localhost:5000/api";

    // 1. Mobile navigation menu
    const menuBtn = document.getElementById("menuBtn");
    const mainNav = document.getElementById("mainNav");

    if (menuBtn && mainNav) {
        menuBtn.addEventListener("click", function () {
            const isOpen = mainNav.classList.toggle("open");
            menuBtn.setAttribute("aria-expanded", String(isOpen));
        });
    }

    // 2. MetaMask connect button (on verify.html)
    const connectWalletBtn = document.getElementById("connectWalletBtn");
    const walletStatusEl = document.getElementById("walletStatus");
    const blockchainPanel = document.getElementById("blockchainPanel");

    let walletConnected = false;

    if (connectWalletBtn) {
        connectWalletBtn.addEventListener("click", async function () {
            if (typeof PUCBlockchain === "undefined") {
                alert("blockchain.js is not loaded.");
                return;
            }
            connectWalletBtn.disabled = true;
            connectWalletBtn.textContent = "Connecting…";
            try {
                const wallet = await PUCBlockchain.connectWallet();
                walletConnected = true;
                connectWalletBtn.textContent = "✅ Connected";
                if (walletStatusEl) {
                    walletStatusEl.textContent =
                        wallet.address.slice(0, 6) + "..." + wallet.address.slice(-4);
                }

                PUCBlockchain.listenForWalletChanges(function () {
                    walletConnected = false;
                    connectWalletBtn.disabled = false;
                    connectWalletBtn.textContent = "🦊 Connect MetaMask";
                    if (walletStatusEl) walletStatusEl.textContent = "Disconnected";
                });
            } catch (err) {
                connectWalletBtn.disabled = false;
                connectWalletBtn.textContent = "🦊 Connect MetaMask";
                if (walletStatusEl) walletStatusEl.textContent = err.message || "Failed";
            }
        });
    }

    // 3. Certificate verification form
    const verifyForm = document.getElementById("verifyForm");

    if (verifyForm) {
        verifyForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const certificateInput = document.getElementById("certificateId");
            const resultBox = document.getElementById("verificationResult");

            if (!certificateInput || !resultBox) return;

            const certificateId = certificateInput.value.trim();

            if (!certificateId) {
                showResult(resultBox, "Please enter a certificate ID.", true);
                return;
            }

            const isNumeric = /^\d+$/.test(certificateId);

            // A. If numeric and user wants on-chain verification
            if (isNumeric) {
                if (blockchainPanel) blockchainPanel.style.display = "block";

                if (walletConnected) {
                    showResult(resultBox, "⏳ Querying Ganache smart contract…", false);
                    try {
                        const cert = await PUCBlockchain.verifyCertificate(certificateId);
                        displayBlockchainCertificate(resultBox, cert);
                        return;
                    } catch (err) {
                        // Fall through to API and local lookup
                        console.warn("On-chain lookup notice:", err.message);
                    }
                }
            }

            // B. Check MongoDB Backend API
            showResult(resultBox, "⏳ Looking up certificate…", false);

            try {
                const res = await fetch(`${API_BASE}/certificates/${encodeURIComponent(certificateId)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data?.success && data?.certificate) {
                        displayFullCertificate(resultBox, data.certificate, "MongoDB Database");
                        return;
                    }
                }
            } catch {
                // Backend not running, proceed to localStorage
            }

            // C. Fallback: Browser localStorage
            let certificates = [];
            try {
                certificates = JSON.parse(localStorage.getItem("pucDemoCertificates") || "[]");
                if (!Array.isArray(certificates)) certificates = [];
            } catch {
                certificates = [];
            }

            const found = certificates.find(function (r) {
                const matchId = (r.certificateId || r.id || "").toLowerCase();
                const matchNum = String(r.blockchainCertId || "");
                const target = certificateId.toLowerCase();
                return matchId === target || matchNum === target;
            });

            if (found) {
                displayFullCertificate(resultBox, found, "Local Demo Storage");
                return;
            }

            // Not found anywhere
            if (isNumeric && !walletConnected) {
                showResult(
                    resultBox,
                    "Certificate not found in database. For on-chain numeric IDs, connect MetaMask below.",
                    true
                );
            } else {
                showResult(
                    resultBox,
                    "Certificate not found. Please verify the certificate ID.",
                    true
                );
            }
        });
    }

    // 4. Handle ?certificateId= query param
    const urlParams = new URLSearchParams(window.location.search);
    const urlCertId = urlParams.get("certificateId");

    if (urlCertId) {
        const input = document.getElementById("certificateId");
        if (input) {
            input.value = urlCertId;
            setTimeout(function () {
                const form = document.getElementById("verifyForm");
                if (form) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
            }, 100);
        }
    }


    // 5. QR Scanner Implementation (Camera + File Upload)
    const scanButton = document.getElementById("scanButton");
    const qrScannerContainer = document.getElementById("qrScannerContainer");
    const closeScannerBtn = document.getElementById("closeScannerBtn");
    const qrScannerStatus = document.getElementById("qrScannerStatus");
    const qrFileInput = document.getElementById("qrFileInput");

    let html5QrCode = null;
    let isScanning = false;

    function parseCertificateId(decodedText) {
        if (!decodedText) return "";

        const clean = decodedText.trim();

        // QR contains a verification URL.
        try {
            const url = new URL(clean);
            const id = url.searchParams.get("certificateId") ||
                url.searchParams.get("id");

            if (id) return id.trim();
        } catch (_) {
            // The QR may contain a plain ID instead of a URL.
        }

        // Handle URL fragments or text containing a certificate ID.
        const match = clean.match(/[?&](?:certificateId|id)=([^&]+)/i);
        if (match) {
            try {
                return decodeURIComponent(match[1]).trim();
            } catch (_) {
                return match[1].trim();
            }
        }

        // Raw ID, such as PUC2026005.
        return clean;
    }

    function setScannerStatus(message) {
        if (qrScannerStatus) qrScannerStatus.textContent = message;
    }

    async function stopScanner() {
        if (html5QrCode && isScanning) {
            try {
                await html5QrCode.stop();
            } catch (error) {
                console.warn("Could not stop scanner:", error);
            }

            isScanning = false;
        }

        if (qrScannerContainer) {
            qrScannerContainer.classList.add("hidden");
        }

        if (scanButton) scanButton.disabled = false;
    }

    function handleScanSuccess(decodedText) {
        const certId = parseCertificateId(decodedText);

        if (!certId) {
            setScannerStatus("Could not read a certificate ID from this QR.");
            return;
        }

        stopScanner();

        const input = document.getElementById("certificateId");
        if (input) input.value = certId;

        setScannerStatus("QR read successfully. Verifying certificate...");

        if (verifyForm) {
            verifyForm.requestSubmit();
        }
    }

    if (scanButton && qrScannerContainer) {
        scanButton.addEventListener("click", async function () {
            if (typeof Html5Qrcode === "undefined") {
                setScannerStatus(
                    "QR scanner library did not load. Check your internet connection."
                );
                qrScannerContainer.classList.remove("hidden");
                return;
            }

            qrScannerContainer.classList.remove("hidden");
            scanButton.disabled = true;
            setScannerStatus("Starting camera...");

            try {
                if (!html5QrCode) {
                    html5QrCode = new Html5Qrcode("qrReader");
                }

                await html5QrCode.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1
                    },
                    function (decodedText) {
                        handleScanSuccess(decodedText);
                    },
                    function () {
                        // Ignore frames where no QR is detected.
                    }
                );

                isScanning = true;
                setScannerStatus("Point the camera at the QR code.");
            } catch (error) {
                console.error("Camera scanner error:", error);
                setScannerStatus(
                    "Camera unavailable. Upload a clear QR screenshot below."
                );
                scanButton.disabled = false;
            }
        });
    }

    if (closeScannerBtn) {
        closeScannerBtn.addEventListener("click", stopScanner);
    }

    if (qrFileInput) {
        qrFileInput.addEventListener("change", async function () {
            const file = qrFileInput.files && qrFileInput.files[0];
            if (!file) return;

            setScannerStatus("Reading uploaded QR image...");

            try {
                if (typeof Html5Qrcode === "undefined") {
                    throw new Error("The QR scanner library did not load.");
                }

                // Use a separate instance for image decoding.
                const fileScanner = new Html5Qrcode("qrReader");
                const decodedText = await fileScanner.scanFile(file, true);

                handleScanSuccess(decodedText);
            } catch (error) {
                console.error("QR image decoding error:", error);
                setScannerStatus(
                    "QR not detected. Upload a clear image containing the entire QR code, without cropping or blur."
                );
            } finally {
                qrFileInput.value = "";
            }
        });
    }


});

/* =========================================
   DISPLAY HELPERS
========================================= */

function addDetail(container, label, value) {
    const paragraph = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = label + ": ";
    paragraph.appendChild(strong);
    paragraph.appendChild(document.createTextNode(String(value ?? "—")));
    container.appendChild(paragraph);
}

function showResult(resultBox, message, isError) {
    resultBox.replaceChildren();
    resultBox.classList.remove("hidden", "invalid");
    if (isError) resultBox.classList.add("invalid");
    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    resultBox.appendChild(paragraph);
}

/* Render certificate retrieved directly from Smart Contract */
function displayBlockchainCertificate(resultBox, cert) {
    resultBox.replaceChildren();
    resultBox.classList.remove("hidden");

    const isPass = cert.passed;
    const isRevoked = cert.revoked;
    const isExpired = cert.expired;
    const isValid = cert.valid;

    let topClass = "";
    let statusBadge = "● VALID";

    if (isRevoked) {
        topClass = "revoked";
        statusBadge = "● REVOKED";
    } else if (!isPass) {
        topClass = "failed";
        statusBadge = "● FAILED";
    } else if (isExpired) {
        topClass = "expired";
        statusBadge = "● EXPIRED";
    }

    const html = `
      <div class="cert-result-container">
        <div class="cert-result-top ${topClass}">
          <strong>📜 Blockchain Certificate #${cert.certificateId}</strong>
          <span style="font-weight: 700; font-size: 11px;">${statusBadge}</span>
        </div>

        <div class="cert-result-body">
          <div class="cert-grid-2">
            <div class="cert-data-item">
              <span>Vehicle Number</span>
              <strong style="font-size: 16px; font-family: monospace;">${cert.vehicleNumber}</strong>
            </div>
            <div class="cert-data-item">
              <span>Test Result</span>
              <strong style="color: ${isPass ? 'var(--green)' : 'var(--danger)'};">${isPass ? 'PASS ✓' : 'FAIL ✕'}</strong>
            </div>
            <div class="cert-data-item">
              <span>Test Date</span>
              <strong>${new Date(cert.testDate).toLocaleDateString()}</strong>
            </div>
            <div class="cert-data-item">
              <span>Valid Until</span>
              <strong style="color: ${isExpired ? '#d97706' : 'inherit'};">${cert.expiryDate ? new Date(cert.expiryDate).toLocaleDateString() : '—'}</strong>
            </div>
            <div class="cert-data-item" style="grid-column: 1 / -1;">
              <span>PUC Centre Wallet</span>
              <strong style="font-family: monospace; font-size: 12px; word-break: break-all;">${cert.centre}</strong>
            </div>
          </div>
        </div>

        <div class="cert-result-footer">
          <span>🛡️ Verified directly on Ganache Blockchain</span>
          <span style="font-weight: 700; color: #0f766e;">On-Chain Record</span>
        </div>
      </div>
    `;

    resultBox.innerHTML = html;
}

/* Render full certificate from Database or Local Storage */
function displayFullCertificate(resultBox, cert, source) {
    resultBox.replaceChildren();
    resultBox.classList.remove("hidden");

    const expiryDateStr = cert.validUntil || cert.expiryDate;
    const expiry = new Date(String(expiryDateStr) + (String(expiryDateStr).includes("T") ? "" : "T00:00:00"));
    const isExpired = !isNaN(expiry.getTime()) && expiry < new Date();

    const emission = cert.emissionResult || {};
    const resultVal = emission.result || cert.result || "Pass";
    const passed = resultVal === "Pass";

    const isRevoked = cert.status === "revoked";
    const isValid = passed && !isExpired && !isRevoked;

    let topClass = "";
    let statusBadge = "● VALID";

    if (isRevoked) {
        topClass = "revoked";
        statusBadge = "● REVOKED";
    } else if (!passed) {
        topClass = "failed";
        statusBadge = "● FAILED";
    } else if (isExpired) {
        topClass = "expired";
        statusBadge = "● EXPIRED";
    }

    const certId = cert.certificateId || cert.id || "PUC-CERT";
    const testDateFormatted = cert.testDate ? new Date(cert.testDate).toLocaleDateString() : "—";
    const expiryFormatted = !isNaN(expiry.getTime()) ? expiry.toLocaleDateString() : "—";

    const coVal = emission.co !== undefined ? `${emission.co} %` : "—";
    const hcVal = emission.hc !== undefined ? `${emission.hc} ppm` : "—";

    const html = `
      <div class="cert-result-container">
        <!-- Top Status Banner -->
        <div class="cert-result-top ${topClass}">
          <strong>📜 Certificate ${certId}</strong>
          <span style="font-weight: 700; font-size: 11px;">${statusBadge}</span>
        </div>

        <div class="cert-result-body">
          <!-- Vehicle & Owner Grid -->
          <div class="cert-grid-2">
            <div class="cert-data-item">
              <span>Vehicle Reg. Number</span>
              <strong style="font-size: 16px; font-family: monospace;">${cert.vehicleNumber}</strong>
            </div>
            <div class="cert-data-item">
              <span>Owner Name</span>
              <strong>${cert.ownerName || '—'}</strong>
            </div>
            <div class="cert-data-item">
              <span>Vehicle Type</span>
              <strong>${cert.vehicleType || 'Car'}</strong>
            </div>
            <div class="cert-data-item">
              <span>Fuel Type</span>
              <strong>${cert.fuelType || 'Petrol'}</strong>
            </div>
            <div class="cert-data-item">
              <span>Test Date</span>
              <strong>${testDateFormatted}</strong>
            </div>
            <div class="cert-data-item">
              <span>Valid Until</span>
              <strong style="color: ${isExpired ? '#d97706' : '#0f766e'};">${expiryFormatted}</strong>
            </div>
            <div class="cert-data-item">
              <span>Testing Centre</span>
              <strong style="font-family: monospace;">${cert.centreId || 'CENTRE001'}</strong>
            </div>
            <div class="cert-data-item">
              <span>Compliance Status</span>
              <strong style="color: ${passed ? 'var(--green)' : 'var(--danger)'};">${passed ? 'PASSED ✓' : 'FAILED ✕'}</strong>
            </div>
          </div>

          <!-- Emission Readings -->
          <div class="cert-emission-box">
            <div class="cert-emission-title">Emissions Test Readings</div>
            <div class="cert-emission-row">
              <div class="cert-emission-stat">
                <small>Carbon Monoxide (CO)</small>
                <strong>${coVal}</strong>
              </div>
              <div class="cert-emission-stat">
                <small>Hydrocarbons (HC)</small>
                <strong>${hcVal}</strong>
              </div>
              <div class="cert-emission-stat" style="background: ${passed ? '#ecfdf5' : '#fef2f2'}; border-color: ${passed ? '#a7f3d0' : '#fecaca'};">
                <small>Result</small>
                <strong style="color: ${passed ? '#047857' : '#b91c1c'};">${resultVal}</strong>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="cert-result-footer">
          <span>${cert.transactionHash ? '🛡️ Blockchain Secured (Ganache)' : 'ℹ️ Verified Record (' + source + ')'}</span>
          <span style="font-weight: 700; color: #0f766e;">Authentic</span>
        </div>
      </div>
    `;

    resultBox.innerHTML = html;
}
