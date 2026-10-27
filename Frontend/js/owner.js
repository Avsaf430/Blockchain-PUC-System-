"use strict";

/* =========================================
   DIGITAL PUC BLOCKCHAIN DAPP
   Vehicle Owner Portal
========================================= */

document.addEventListener("DOMContentLoaded", function () {
    const API_BASE = "http://localhost:5000/api";
    const CERTIFICATE_KEY = "pucDemoCertificates";
    const OWNER_SESSION = "pucDemoOwnerSession";

    const nameElement = document.getElementById("ownerName");
    const totalElement = document.getElementById("certCount");
    const activeElement = document.getElementById("activeCount");
    const certificateList = document.getElementById("certificateList");

    // 1. Verify owner session
    let session = null;

    try {
        session = JSON.parse(sessionStorage.getItem(OWNER_SESSION));
    } catch {
        session = null;
    }

    if (!session || (!session.email && !session.name)) {
        window.location.replace("owner-login.html");
        return;
    }

    if (nameElement) {
        nameElement.textContent = session.name || session.email;
    }

    let connectedWalletAddress = null;

    // 2. Read certificates saved in this browser
    function getLocalCertificates() {
        try {
            const records = JSON.parse(
                localStorage.getItem(CERTIFICATE_KEY) || "[]"
            );

            return Array.isArray(records) ? records : [];
        } catch {
            return [];
        }
    }

    // 3. Fetch certificates from backend
    async function fetchBackendCertificates() {
        try {
            const params = new URLSearchParams();

            if (session.name) {
                params.append("name", session.name);
            }

            if (session.email) {
                params.append("email", session.email);
            }

            if (connectedWalletAddress) {
                params.append("wallet", connectedWalletAddress);
            }

            const response = await fetch(
                `${API_BASE}/owner/search?${params.toString()}`
            );

            if (!response.ok) return [];

            const data = await response.json();

            return Array.isArray(data?.certificates)
                ? data.certificates
                : [];
        } catch {
            return [];
        }
    }

    // 4. Check certificate status
    function isActive(cert) {
        const emission = cert.emissionResult || {};
        const result = emission.result || cert.result;

        if (
            String(result || "").toLowerCase() !== "pass" ||
            String(cert.status || "").toLowerCase() === "revoked"
        ) {
            return false;
        }

        const dateString = cert.validUntil || cert.expiryDate;

        if (!dateString) return false;

        const expiry = new Date(
            String(dateString).includes("T")
                ? dateString
                : `${dateString}T23:59:59`
        );

        return !Number.isNaN(expiry.getTime()) &&
            expiry >= new Date();
    }

    // 5. Add a text field to a certificate card
    function addField(container, label, value) {
        const paragraph = document.createElement("p");
        const strong = document.createElement("strong");

        strong.textContent = `${label}: `;

        paragraph.appendChild(strong);
        paragraph.appendChild(
            document.createTextNode(
                value === undefined || value === null || value === ""
                    ? "—"
                    : String(value)
            )
        );

        container.appendChild(paragraph);
    }

    // 6. Create an action link
    function createAction(label, url, className) {
        const link = document.createElement("a");

        link.href = url;
        link.className = className;
        link.textContent = label;
        link.style.display = "inline-block";
        link.style.margin = "8px 8px 0 0";

        return link;
    }

    // 7. Load and display the owner's certificates
    async function renderCertificates() {
        if (certificateList) {
            certificateList.textContent = "Loading your certificates...";
        }

        const localCertificates = getLocalCertificates();
        const backendCertificates = await fetchBackendCertificates();

        // Combine records using the certificate ID
        const combined = new Map();

        localCertificates.forEach(function (certificate) {
            const id = certificate.certificateId || certificate.id;

            if (id) combined.set(String(id), certificate);
        });

        backendCertificates.forEach(function (certificate) {
            const id = certificate.certificateId || certificate.id;

            if (id) {
                const existing = combined.get(String(id));

                // Preserve browser-only blockchain fields if the API
                // response does not contain them.
                combined.set(String(id), {
                    ...(existing || {}),
                    ...certificate
                });
            }
        });

        const allCertificates = Array.from(combined.values());

        // Match records to the logged-in owner
        const ownerCertificates = allCertificates.filter(function (item) {
            const matchName = Boolean(
                item.ownerName &&
                session.name &&
                item.ownerName.trim().toLowerCase() ===
                session.name.trim().toLowerCase()
            );

            const matchEmail = Boolean(
                item.ownerEmail &&
                session.email &&
                item.ownerEmail.trim().toLowerCase() ===
                session.email.trim().toLowerCase()
            );

            const matchWallet = Boolean(
                connectedWalletAddress &&
                item.ownerWallet &&
                item.ownerWallet.trim().toLowerCase() ===
                connectedWalletAddress.trim().toLowerCase()
            );

            return matchName || matchEmail || matchWallet;
        });

        if (totalElement) {
            totalElement.textContent = ownerCertificates.length;
        }

        if (activeElement) {
            activeElement.textContent =
                ownerCertificates.filter(isActive).length;
        }

        if (!certificateList) return;

        certificateList.replaceChildren();

        if (ownerCertificates.length === 0) {
            certificateList.className = "empty-state";
            certificateList.textContent =
                "No certificates found for this account. " +
                "Certificates associated with your registered name, " +
                "email, or connected wallet will appear here.";
            return;
        }

        certificateList.className = "";

        ownerCertificates.forEach(function (certificate) {
            const card = document.createElement("article");
            card.className = "record";

            const certId = String(
                certificate.certificateId ||
                certificate.id ||
                certificate.blockchainCertId ||
                ""
            );

            const heading = document.createElement("h3");
            heading.textContent =
                `${certId || "Certificate"} · ` +
                `${certificate.vehicleNumber || "Vehicle"}`;

            card.appendChild(heading);

            if (
                certificate.storageType === "blockchain" ||
                certificate.transactionHash
            ) {
                const badge = document.createElement("span");

                badge.className = "pill success";
                badge.textContent = "On-Chain";
                badge.style.marginLeft = "8px";

                heading.appendChild(badge);
            }

            if (certificate.ownerName) {
                addField(card, "Owner", certificate.ownerName);
            }

            addField(
                card,
                "Vehicle Number",
                certificate.vehicleNumber
            );

            addField(card, "Fuel Type", certificate.fuelType);
            addField(card, "Vehicle Type", certificate.vehicleType);

            addField(
                card,
                "Test Date",
                certificate.testDate
                    ? new Date(certificate.testDate).toLocaleDateString()
                    : "—"
            );

            addField(
                card,
                "Valid Until",
                certificate.validUntil || certificate.expiryDate || "—"
            );

            const emission = certificate.emissionResult || {};

            addField(card, "CO", emission.co);
            addField(card, "HC", emission.hc);
            addField(
                card,
                "Result",
                emission.result || certificate.result
            );

            addField(
                card,
                "Status",
                isActive(certificate)
                    ? "Active"
                    : "Expired or not passing"
            );

            // Use the displayed certificate ID for navigation.
            const encodedId = encodeURIComponent(certId);

            const certificateUrl =
                `certificate.html?certificateId=${encodedId}`;

            const verifyUrl =
                `verify.html?certificateId=${encodedId}`;

            const actions = document.createElement("div");
            actions.className = "owner-certificate-actions";

            // View certificate
            actions.appendChild(
                createAction(
                    "View Certificate",
                    certificateUrl,
                    "btn btn-outline"
                )
            );

            // Open certificate so the owner can print or save as PDF
            actions.appendChild(
                createAction(
                    "Save as PDF / Print",
                    certificateUrl,
                    "btn btn-primary"
                )
            );

            // Verify the certificate
            actions.appendChild(
                createAction(
                    "Verify Certificate",
                    verifyUrl,
                    "btn btn-outline"
                )
            );

            card.appendChild(actions);
            certificateList.appendChild(card);
        });
    }

    // 8. Refresh if certificates change in another browser tab
    window.addEventListener("storage", function (event) {
        if (event.key === CERTIFICATE_KEY) {
            renderCertificates();
        }
    });

    // Optional wallet connection support, if these controls exist.
    const connectButton = document.getElementById("connectWalletBtn");
    const walletStatus = document.getElementById("walletStatus");

    if (connectButton && window.ethereum) {
        connectButton.addEventListener("click", async function () {
            try {
                const accounts = await window.ethereum.request({
                    method: "eth_requestAccounts"
                });

                connectedWalletAddress = accounts[0] || null;

                if (walletStatus) {
                    walletStatus.textContent = connectedWalletAddress
                        ? `Connected: ${connectedWalletAddress}`
                        : "Wallet not connected";
                }

                await renderCertificates();
            } catch (error) {
                if (walletStatus) {
                    walletStatus.textContent =
                        "Wallet connection was not completed.";
                }

                console.error("Wallet connection error:", error);
            }
        });
    }

    renderCertificates();
});