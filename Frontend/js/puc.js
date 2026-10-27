"use strict";

/*
 * DIGITAL PUC BLOCKCHAIN DAPP
 * PUC Centre Dashboard
 *
 * Supports:
 *   - Demo Mode: saves to localStorage + syncs with MongoDB backend
 *   - Blockchain Mode: MetaMask transaction on Ganache + saves to backend
 */

document.addEventListener("DOMContentLoaded", function () {

    const SESSION_KEY = "pucDemoCentreSession";
    const CERTIFICATE_KEY = "pucDemoCertificates";
    const API_BASE = "http://localhost:5000/api";

    const heading = document.getElementById("centreHeading");
    const form = document.getElementById("issueCertificateForm");
    const issueMessage = document.getElementById("issueMessage");
    const issuedList = document.getElementById("issuedList");
    const connectWalletBtn = document.getElementById("connectWalletBtn");
    const blockchainIssueBtn = document.getElementById("blockchainIssueBtn");
    const walletStatusEl = document.getElementById("walletStatus");
    const networkStatusEl = document.getElementById("networkStatus");
    const contractStatusEl = document.getElementById("contractStatus");
    const walletNote = document.getElementById("walletNote");

    // 1. Session check
    let session;
    try {
        session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    } catch {
        session = null;
    }

    if (!session || !session.id) {
        window.location.replace("puc-login.html");
        return;
    }

    if (heading) {
        heading.textContent = session.name || "PUC Centre Dashboard";
    }

    // 2. Storage helpers
    function getCertificates() {
        try {
            const records = JSON.parse(localStorage.getItem(CERTIFICATE_KEY) || "[]");
            return Array.isArray(records) ? records : [];
        } catch {
            return [];
        }
    }

    function saveCertificates(records) {
        localStorage.setItem(CERTIFICATE_KEY, JSON.stringify(records));
    }

    function showMessage(text, success = false) {
        if (!issueMessage) return;
        issueMessage.textContent = text;
        issueMessage.className = "form-message" + (success ? " success" : "");
    }

    // 3. Read form values
    function readForm() {
        return {
            vehicleNumber: (document.getElementById("vehicleNumber")?.value || "").trim().toUpperCase(),
            ownerName: (document.getElementById("ownerName")?.value || "").trim(),
            ownerWallet: (document.getElementById("ownerWallet")?.value || "").trim(),
            fuelType: (document.getElementById("fuelType")?.value || ""),
            vehicleType: (document.getElementById("vehicleType")?.value || ""),
            testDate: (document.getElementById("testDate")?.value || ""),
            validUntil: (document.getElementById("validUntil")?.value || ""),
            co: (document.getElementById("co")?.value || ""),
            hc: (document.getElementById("hc")?.value || ""),
            result: (document.getElementById("emissionsResult")?.value || "")
        };
    }

    // 4. Validate fields
    function validateForm(f) {
        if (!f.vehicleNumber) return "Vehicle registration number is required.";
        if (!f.ownerName) return "Owner name is required.";
        if (!f.fuelType) return "Fuel type is required.";
        if (!f.vehicleType) return "Vehicle type is required.";
        if (!f.testDate) return "Emissions test date is required.";
        if (!f.validUntil) return "Certificate valid until date is required.";
        if (f.co === "") return "CO emission value is required.";
        if (f.hc === "") return "HC emission value is required.";
        if (!f.result) return "Test result is required.";

        const regPattern = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/;
        if (!regPattern.test(f.vehicleNumber)) {
            return "Enter a valid registration number (e.g. MH02AB1234).";
        }

        const test = new Date(f.testDate + "T00:00:00");
        const expiry = new Date(f.validUntil + "T00:00:00");

        if (isNaN(test.getTime()) || isNaN(expiry.getTime())) {
            return "Please provide valid test and expiry dates.";
        }

        if (expiry < test) {
            return "Valid until date cannot be earlier than test date.";
        }

        if (test > new Date()) {
            return "Test date cannot be in the future.";
        }

        if (f.ownerWallet && !/^0x[a-fA-F0-9]{40}$/.test(f.ownerWallet)) {
            return "Enter a valid Ethereum wallet address or leave it blank.";
        }

        if (parseFloat(f.co) < 0 || parseInt(f.hc, 10) < 0) {
            return "Emissions values cannot be negative.";
        }

        return null;
    }

    // 5. Generate local demo certificate ID (e.g. PUC2026001)
    function generateLocalCertId(records) {
        const year = new Date().getFullYear();
        const prefix = `PUC${year}`;
        const numbers = records
            .map(r => r.certificateId || "")
            .filter(id => id.startsWith(prefix))
            .map(id => parseInt(id.replace(prefix, ""), 10))
            .filter(n => !isNaN(n));

        const nextNum = numbers.length ? Math.max(...numbers) + 1 : 1;
        return `${prefix}${String(nextNum).padStart(3, "0")}`;
    }

    // 6. Fetch from backend API
    async function fetchBackendCertificates() {
        try {
            const res = await fetch(`${API_BASE}/puc/certificates`);
            if (res.ok) {
                const data = await res.json();
                return data?.certificates || [];
            }
        } catch (_) {
            // Backend offline
        }
        return [];
    }

    // 7. Save to backend API (if running)
    async function saveToBackend(payload) {
        try {
            const res = await fetch(`${API_BASE}/puc/issue`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            return await res.json();
        } catch {
            return null; // backend offline fallback
        }
    }

    // 8. Render issued list
    function addField(container, label, value) {
        const p = document.createElement("p");
        const strong = document.createElement("strong");
        strong.textContent = label + ": ";
        p.appendChild(strong);
        p.appendChild(document.createTextNode(String(value ?? "—")));
        container.appendChild(p);
    }

    async function renderCertificates() {
        if (!issuedList) return;

        const localRecords = getCertificates();
        const apiRecords = await fetchBackendCertificates();

        // Merge without duplicates by certificateId
        const map = new Map();
        localRecords.forEach(function (r) {
            const id = r.certificateId || r.id;
            if (id) map.set(id, r);
        });
        apiRecords.forEach(function (r) {
            const id = r.certificateId || r.id;
            if (id) map.set(id, r);
        });

        let records = Array.from(map.values());

        // Filter for this centre (supporting PUC001 / CENTRE001 flexible match)
        if (session && session.id) {
            const sid = String(session.id).toLowerCase();
            records = records.filter(function (r) {
                if (!r.centreId) return true;
                const cid = String(r.centreId).toLowerCase();
                return cid === sid || cid === "puc001" || cid === "centre001";
            });
        }

        issuedList.replaceChildren();

        if (records.length === 0) {
            issuedList.className = "empty-state";
            issuedList.textContent = "No certificates issued by this centre yet.";
            return;
        }

        issuedList.className = "";

        records.forEach(function (r) {
            const card = document.createElement("article");
            card.className = "record";

            const title = document.createElement("strong");
            title.textContent = (r.certificateId || "—") + " · " + (r.vehicleNumber || "—");
            card.appendChild(title);

            if (r.storageType === "blockchain" || r.transactionHash) {
                const badge = document.createElement("span");
                badge.className = "pill success";
                badge.style.marginLeft = "8px";
                badge.textContent = "On-Chain";
                title.appendChild(badge);
            }

            addField(card, "Owner Name", r.ownerName);
            addField(card, "Fuel Type", r.fuelType);
            addField(card, "Vehicle Type", r.vehicleType);
            addField(card, "Test Date", r.testDate);
            addField(card, "Valid Until", r.validUntil);
            addField(card, "CO (g/km)", r.emissionResult?.co);
            addField(card, "HC (ppm)", r.emissionResult?.hc);
            addField(card, "Result", r.emissionResult?.result);

            if (r.transactionHash) {
                addField(card, "Tx Hash", r.transactionHash.slice(0, 16) + "…");
            }

            const certificateLink = document.createElement("a");
            certificateLink.href = "certificate.html?id=" + encodeURIComponent(r.certificateId || "");
            certificateLink.className = "text-link";
            certificateLink.textContent = "View / Print Certificate (with QR) →";
            certificateLink.style.display = "block";
            certificateLink.style.marginTop = "8px";
            card.appendChild(certificateLink);

            const link = document.createElement("a");
            link.href = "verify.html?certificateId=" + encodeURIComponent(r.certificateId || "");
            link.className = "text-link";
            link.textContent = "View verification page →";
            link.style.display = "block";
            link.style.marginTop = "8px";
            card.appendChild(link);

            issuedList.appendChild(card);
        });
    }

    // Helper to format certificate record
    function createRecord(f, certId, extra = {}) {
        return {
            certificateId: certId,
            vehicleNumber: f.vehicleNumber,
            ownerName: f.ownerName,
            ownerWallet: f.ownerWallet || null,
            fuelType: f.fuelType,
            vehicleType: f.vehicleType,
            testDate: f.testDate,
            validUntil: f.validUntil,
            emissionResult: {
                co: parseFloat(f.co),
                hc: parseInt(f.hc, 10),
                result: f.result
            },
            centreId: session.id,
            status: "active",
            createdAt: new Date().toISOString(),
            ...extra
        };
    }

    // 8. Demo mode submit (Save Demo Record)
    if (form) {
        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            const f = readForm();
            const err = validateForm(f);
            if (err) {
                showMessage(err);
                return;
            }

            const records = getCertificates();
            const localId = generateLocalCertId(records);

            // Attempt backend save
            const backendRes = await saveToBackend({
                vehicleNumber: f.vehicleNumber,
                ownerName: f.ownerName,
                ownerWallet: f.ownerWallet,
                fuelType: f.fuelType,
                vehicleType: f.vehicleType,
                testDate: f.testDate,
                validUntil: f.validUntil,
                co: f.co,
                hc: f.hc,
                result: f.result,
                centreId: session.id
            });

            const certId = backendRes?.certificateId || localId;

            const newCert = createRecord(f, certId, {
                storageType: "browser-demo",
                certificateHash: backendRes?.certificate?.certificateHash || null,
                transactionHash: null,
                blockchainCertId: null
            });

            records.unshift(newCert);
            saveCertificates(records);

            showMessage(
                `Demo record saved! Certificate ID: ${certId}` +
                (backendRes?.success ? " (Stored in MongoDB)" : " (Saved locally)"),
                true
            );

            form.reset();
            renderCertificates();
        });
    }

    // 9. MetaMask connection
    let walletConnected = false;

    function updateWalletUI(address) {
        walletConnected = true;
        if (walletStatusEl) walletStatusEl.textContent = address.slice(0, 6) + "..." + address.slice(-4);
        if (networkStatusEl) networkStatusEl.textContent = "Ganache (1337)";
        if (contractStatusEl) contractStatusEl.textContent = "Connected";
        if (connectWalletBtn) {
            connectWalletBtn.textContent = "✅ Connected";
            connectWalletBtn.disabled = true;
        }
        if (blockchainIssueBtn) blockchainIssueBtn.disabled = false;
        if (walletNote) {
            walletNote.textContent = "MetaMask connected! Click 'Issue on Blockchain' to record on Ganache.";
        }
    }

    if (connectWalletBtn) {
        connectWalletBtn.addEventListener("click", async function () {
            if (typeof PUCBlockchain === "undefined") {
                showMessage("blockchain.js is not loaded.");
                return;
            }

            connectWalletBtn.disabled = true;
            connectWalletBtn.textContent = "Connecting…";

            try {
                const wallet = await PUCBlockchain.connectWallet();
                updateWalletUI(wallet.address);
                showMessage("MetaMask connected: " + wallet.address, true);

                PUCBlockchain.listenForWalletChanges(function () {
                    walletConnected = false;
                    if (walletStatusEl) walletStatusEl.textContent = "Disconnected";
                    if (contractStatusEl) contractStatusEl.textContent = "—";
                    if (networkStatusEl) networkStatusEl.textContent = "—";
                    if (connectWalletBtn) {
                        connectWalletBtn.disabled = false;
                        connectWalletBtn.textContent = "🦊 Connect MetaMask";
                    }
                    if (blockchainIssueBtn) blockchainIssueBtn.disabled = true;
                    showMessage("Wallet disconnected.");
                });
            } catch (error) {
                connectWalletBtn.disabled = false;
                connectWalletBtn.textContent = "🦊 Connect MetaMask";
                showMessage(error.message || "MetaMask connection failed.");
            }
        });
    }

    // 10. Blockchain mode issue
    if (blockchainIssueBtn) {
        blockchainIssueBtn.addEventListener("click", async function () {
            if (!walletConnected) {
                showMessage("Please connect MetaMask first.");
                return;
            }

            const f = readForm();
            const err = validateForm(f);
            if (err) {
                showMessage(err);
                return;
            }

            blockchainIssueBtn.disabled = true;
            blockchainIssueBtn.textContent = "⏳ Awaiting MetaMask…";
            showMessage("Please approve the transaction in MetaMask.");

            try {
                // 1. Send transaction to contract
                const receipt = await PUCBlockchain.issueCertificate({
                    vehicleNumber: f.vehicleNumber,
                    ownerWallet: f.ownerWallet || "0x0000000000000000000000000000000000000000",
                    testDate: f.testDate,
                    expiryDate: f.validUntil,
                    result: f.result
                });

                // 2. Fetch the numeric blockchain certificate ID
                let blockchainCertId = null;
                try {
                    const nextId = await PUCBlockchain.getNextCertificateId();
                    blockchainCertId = String(Number(nextId) - 1);
                } catch {
                    /* non-fatal */
                }

                // 3. Save full record to backend
                const backendRes = await saveToBackend({
                    vehicleNumber: f.vehicleNumber,
                    ownerName: f.ownerName,
                    ownerWallet: f.ownerWallet,
                    fuelType: f.fuelType,
                    vehicleType: f.vehicleType,
                    testDate: f.testDate,
                    validUntil: f.validUntil,
                    co: f.co,
                    hc: f.hc,
                    result: f.result,
                    centreId: session.id,
                    transactionHash: receipt.transactionHash,
                    blockchainCertId
                });

                const certId = backendRes?.certificateId || (blockchainCertId ? `PUC${new Date().getFullYear()}#${blockchainCertId}` : "PUC-BLOCKCHAIN");

                // 4. Save to local demo cache for instant UI display
                const records = getCertificates();
                const newCert = createRecord(f, certId, {
                    blockchainCertId,
                    certificateHash: backendRes?.certificate?.certificateHash || null,
                    transactionHash: receipt.transactionHash,
                    blockNumber: receipt.blockNumber,
                    storageType: "blockchain"
                });

                records.unshift(newCert);
                saveCertificates(records);

                showMessage(
                    `✅ Certificate ${certId} minted on Ganache! ` +
                    `Blockchain ID: #${blockchainCertId || "—"} · Tx: ${receipt.transactionHash.slice(0, 18)}…`,
                    true
                );

                form.reset();
                renderCertificates();

            } catch (error) {
                showMessage(error.message || "Blockchain transaction failed.");
            } finally {
                blockchainIssueBtn.disabled = false;
                blockchainIssueBtn.textContent = "🔗 Issue on Blockchain";
            }
        });
    }

    // Initial render
    renderCertificates();

    window.addEventListener("storage", function (event) {
        if (event.key === CERTIFICATE_KEY) renderCertificates();
    });

});
