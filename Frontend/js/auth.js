"use strict";

/* =========================================
   DIGITAL PUC BLOCKCHAIN DAPP
   Authentication & Session Management
   Supports:
     1. Live MongoDB Backend (/api/auth/register & /api/auth/login)
     2. Browser localStorage fallback if backend is offline
========================================= */

document.addEventListener("DOMContentLoaded", function () {

    const API_BASE = "http://localhost:5000/api";
    const OWNER_KEY = "pucDemoOwners";
    const OWNER_SESSION = "pucDemoOwnerSession";
    const CENTRE_SESSION = "pucDemoCentreSession";

    // Display a form message
    function showMessage(message, success = false) {
        const element = document.getElementById("formMessage");
        if (!element) return;
        element.textContent = message;
        element.className = "form-message" + (success ? " success" : "");
    }

    // Safely read demo owner accounts from localStorage
    function getOwners() {
        try {
            const owners = JSON.parse(localStorage.getItem(OWNER_KEY) || "[]");
            return Array.isArray(owners) ? owners : [];
        } catch {
            return [];
        }
    }

    // Save demo owner accounts
    function saveOwners(owners) {
        localStorage.setItem(OWNER_KEY, JSON.stringify(owners));
    }


    /* =====================================
       1. VEHICLE OWNER REGISTRATION
    ===================================== */

    const registerForm = document.getElementById("ownerRegisterForm");

    if (registerForm) {
        registerForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const name = document.getElementById("name").value.trim();
            const email = document.getElementById("regEmail").value.trim().toLowerCase();
            const password = document.getElementById("regPassword").value;
            const confirmPassword = document.getElementById("confirmPassword").value;

            if (!name || !email || !password || !confirmPassword) {
                showMessage("Please fill in all required fields.");
                return;
            }

            if (password.length < 6) {
                showMessage("Password must contain at least 6 characters.");
                return;
            }

            if (password !== confirmPassword) {
                showMessage("Passwords do not match.");
                return;
            }

            const submitBtn = registerForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;
            showMessage("Registering account...", true);

            // Attempt MongoDB Backend Registration First
            try {
                const response = await fetch(`${API_BASE}/auth/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, password })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    // Also sync to local demo storage for seamless dual fallback
                    const owners = getOwners();
                    if (!owners.some(o => o.email === email)) {
                        owners.push({ name, email, password });
                        saveOwners(owners);
                    }

                    showMessage("Registered successfully in MongoDB! Redirecting to login...", true);
                    setTimeout(function () {
                        window.location.href = "owner-login.html";
                    }, 1000);
                    return;
                } else {
                    showMessage(data.message || "Registration failed on server.");
                    if (submitBtn) submitBtn.disabled = false;
                    return;
                }
            } catch (err) {
                console.warn("Backend offline or unreachable, falling back to local demo storage:", err);
            }

            // Fallback: Local demo storage if Backend is not running
            const owners = getOwners();
            const alreadyExists = owners.some(o => o.email === email);

            if (alreadyExists) {
                showMessage("This email is already registered locally. Please log in.");
                if (submitBtn) submitBtn.disabled = false;
                return;
            }

            owners.push({ name, email, password });
            try {
                saveOwners(owners);
                showMessage("Registered in local demo storage (Backend was offline). Redirecting...", true);
                setTimeout(function () {
                    window.location.href = "owner-login.html";
                }, 1000);
            } catch {
                showMessage("Unable to save account.");
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }


    /* =====================================
       2. VEHICLE OWNER LOGIN
    ===================================== */

    const ownerLoginForm = document.getElementById("ownerLoginForm");

    if (ownerLoginForm) {
        ownerLoginForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const email = document.getElementById("email").value.trim().toLowerCase();
            const password = document.getElementById("password").value;

            if (!email || !password) {
                showMessage("Email and password are required.");
                return;
            }

            const submitBtn = ownerLoginForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;
            showMessage("Signing in...", true);

            // Attempt MongoDB Backend Login First
            try {
                const response = await fetch(`${API_BASE}/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok && data.success && data.user) {
                    sessionStorage.setItem(
                        OWNER_SESSION,
                        JSON.stringify({
                            name: data.user.name,
                            email: data.user.email,
                            id: data.user.id,
                            walletAddress: data.user.walletAddress
                        })
                    );

                    showMessage("Login successful! Redirecting...", true);
                    window.location.href = "owner-dashboard.html";
                    return;
                } else {
                    showMessage(data.message || "Invalid credentials.");
                    if (submitBtn) submitBtn.disabled = false;
                    return;
                }
            } catch (err) {
                console.warn("Backend offline, falling back to local storage authentication:", err);
            }

            // Fallback: Local Storage
            const owners = getOwners();
            const owner = owners.find(o => o.email === email && o.password === password);

            if (!owner) {
                showMessage("Invalid email or password. Please verify your credentials or register.");
                if (submitBtn) submitBtn.disabled = false;
                return;
            }

            sessionStorage.setItem(
                OWNER_SESSION,
                JSON.stringify({
                    name: owner.name,
                    email: owner.email
                })
            );

            window.location.href = "owner-dashboard.html";
        });
    }


    /* =====================================
       3. AUTHORIZED PUC CENTRE LOGIN
    ===================================== */

    const pucLoginForm = document.getElementById("pucLoginForm");

    if (pucLoginForm) {
        pucLoginForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const centreId = document.getElementById("centreId").value.trim();
            const password = document.getElementById("centrePassword").value;

            const demoCentre = {
                id: "PUC001",
                password: "Centre@123",
                name: "Demo Authorized PUC Centre"
            };

            if (centreId !== demoCentre.id || password !== demoCentre.password) {
                showMessage("Invalid centre ID or password.");
                return;
            }

            try {
                sessionStorage.setItem(
                    CENTRE_SESSION,
                    JSON.stringify({
                        id: demoCentre.id,
                        name: demoCentre.name
                    })
                );

                window.location.href = "puc-dashboard.html";
            } catch {
                showMessage("Unable to start the centre session.");
            }
        });
    }


    /* =====================================
       4. LOGOUT
    ===================================== */

    const logoutButton = document.getElementById("logoutBtn");

    if (logoutButton) {
        logoutButton.addEventListener("click", function () {
            sessionStorage.removeItem(OWNER_SESSION);
            sessionStorage.removeItem(CENTRE_SESSION);
            window.location.href = "index.html";
        });
    }

});
