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
    const walletStatus = document.getElementById("walletStatus");
    const connectButton = document.getElementById("connectWalletBtn");
    const certificateList = document.getElementById("certificateList");

    // 1. Session verification
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

    // 2. Fetch certificates from localStorage and backend
    function getLocalCertificates() {
        try {
            const records = JSON.parse(localStorage.getItem(CERTIFICATE_KEY) || "[]");
            return Array.isArray(records) ? records : [];
        } catch {
            return [];
        }
    }

    async function fetchBackendCertificates() {
        try {
            const params = new URLSearchParams();
            if (session.name) params.append("name", session.name);
            if (session.email) params.append("email", session.email);
            if (connectedWalletAddress) params.append("wallet", connectedWalletAddress);

            const res = await fetch(`${API_BASE}/owner/search?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                return data?.certificates || [];
            }
        } catch {
            // Backend offline
        }
        return [];
    }

    // 3. Status check
    function isActive(cert) {
        const emission = cert.emissionResult || {};
        const res = emission.result || cert.result;
        if (res !== "Pass" || cert.status === "revoked") return false;

        const dateStr = cert.validUntil || cert.expiryDate;
        if (!dateStr) return false;

        const expiry = new Date(String(dateStr) + (String(dateStr).includes("T") ? "" : "T00:00:00"));
        return !isNaN(expiry.getTime()) && expiry >= new Date();
    }

    function addField(container, label, value) {
        const p = document.createElement("p");
        const strong = document.createElement("strong");
        strong.textContent = label + ": ";
        p.appendChild(strong);
        p.appendChild(document.createTextNode(String(value ?? "—")));
        container.appendChild(p);
    }

    // 4. Render certificates
    async function renderCertificates() {
        const localCerts = getLocalCertificates();
        const apiCerts = await fetchBackendCertificates();

        // Combine unique certificates by certificateId
        const combinedMap = new Map();

        localCerts.forEach(c => {
            const id = c.certificateId || c.id;
            if (id) combinedMap.set(id, c);
        });

        apiCerts.forEach(c => {
            const id = c.certificateId || c.id;
            if (id) combinedMap.set(id, c);
        });

        const allCertificates = Array.from(combinedMap.values());

        // Match certificates by ownerName, email, or connected wallet
        const ownerCertificates = allCertificates.filter(function (item) {
            const matchName = item.ownerName && session.name &&
                item.ownerName.trim().toLowerCase() === session.name.trim().toLowerCase();

            const matchEmail = item.ownerEmail && session.email &&
                item.ownerEmail.trim().toLowerCase() === session.email.trim().toLowerCase();

            const matchWallet = connectedWalletAddress && item.ownerWallet &&
                item.ownerWallet.trim().toLowerCase() === connectedWalletAddress.trim().toLowerCase();

            return matchName || matchEmail || matchWallet;
        });

        if (totalElement) totalElement.textContent = ownerCertificates.length;
        if (activeElement) activeElement.textContent = ownerCertificates.filter(isActive).length;

        if (!certificateList) return;
        certificateList.replaceChildren();

        if (ownerCertificates.length === 0) {
            certificateList.className = "empty-state";
            certificateList.textContent =
                "No certificates found matching your account or wallet. " +
                "Certificates issued with your name (" + (session.name || session.email) + ") " +
                "or connected wallet will appear here.";
            return;
        }

        certificateList.className = "";

        ownerCertificates.forEach(function (certificate) {
            const card = document.createElement("article");
            card.className = "record";

            const heading = document.createElement("strong");
            const certId = certificate.certificateId || certificate.id || "Certificate";
            heading.textContent = `${certId} · ${certificate.vehicleNumber || "Vehicle"}`;
            card.appendChild(heading);

            if (certificate.storageType === "blockchain" || certificate.transactionHash) {
                const badge = document.createElement("span");
                badge.className = "pill success";
                badge.style.marginLeft = "8px";
                badge.textContent = "On-Chain";
                heading.appendChild(badge);
            }

            if (certificate.ownerName) addField(card, "Owner", certificate.ownerName);
            if (certificate.fuelType) addField(card, "Fuel Type", certificate.fuelType);
            if (certificate.vehicleType) addField(card, "Vehicle Type", certificate.vehicleType);

            addField(card, "Test Date", certificate.testDate ? new Date(certificate.testDate).toLocaleDateString() : "—");
            addField(card, "Valid Until", certificate.validUntil ? new Date(certificate.validUntil).toLocaleDateString() : (certificate.expiryDate || "—"));

            const emission = certificate.emissionResult || {};
            if (emission.co !== undefined) addField(card, "CO (g/km)", emission.co);
            if (emission.hc !== undefined) addField(card, "HC (ppm)", emission.hc);
            addField(card, "Result", emission.result || certificate.result);

            const status = document.createElement("p");
            status.textContent = isActive(certificate)
                ? "Status: 🟢 Active"
                : "Status: 🔴 Expired or not passing";
            card.appendChild(status);

            const verifyLink = document.createElement("a");
            verifyLink.href = "verify.html?certificateId=" + encodeURIComponent(certId);
            verifyLink.className = "text-link";
            verifyLink.textContent = "Verify certificate →";
            card.appendChild(verifyLink);

            certificateList.appendChild(card);
        });
    }

    renderCertificates();

    window.addEventListener("storage", function (event) {
        if (event.key === CERTIFICATE_KEY) renderCertificates();
    });

});
