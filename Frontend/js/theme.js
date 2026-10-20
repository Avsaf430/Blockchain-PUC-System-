"use strict";

/* ==========================================================
   THEME SWITCHER (DARK MODE & LIGHT MODE)
   Synchronizes theme preference across all pages via localStorage
   ========================================================== */

(function () {
    const THEME_KEY = "pucAppTheme";

    // 1. Apply theme immediately before render to avoid flash
    function getSavedTheme() {
        try {
            return localStorage.getItem(THEME_KEY) || "light";
        } catch {
            return "light";
        }
    }

    function applyTheme(theme) {
        if (theme === "dark") {
            document.documentElement.setAttribute("data-theme", "dark");
        } else {
            document.documentElement.removeAttribute("data-theme");
        }
        updateButtonIcons(theme);
    }

    function updateButtonIcons(theme) {
        const btns = document.querySelectorAll(".theme-toggle-btn");
        btns.forEach(btn => {
            if (theme === "dark") {
                btn.innerHTML = "☀️";
                btn.setAttribute("title", "Switch to Light Mode");
                btn.setAttribute("aria-label", "Switch to Light Mode");
            } else {
                btn.innerHTML = "🌙";
                btn.setAttribute("title", "Switch to Dark Mode");
                btn.setAttribute("aria-label", "Switch to Dark Mode");
            }
        });
    }

    // Apply saved theme immediately on script execution
    const currentTheme = getSavedTheme();
    applyTheme(currentTheme);

    // 2. Setup theme toggle button on DOMContentLoaded
    document.addEventListener("DOMContentLoaded", function () {
        // Find existing button or inject into header if not present
        let toggleBtns = document.querySelectorAll(".theme-toggle-btn");

        if (toggleBtns.length === 0) {
            const header = document.querySelector(".site-header");
            if (header) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "theme-toggle-btn";
                header.appendChild(btn);
            }
        }

        // Re-query after possible injection
        toggleBtns = document.querySelectorAll(".theme-toggle-btn");
        updateButtonIcons(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");

        toggleBtns.forEach(btn => {
            btn.addEventListener("click", function () {
                const isDark = document.documentElement.getAttribute("data-theme") === "dark";
                const newTheme = isDark ? "light" : "dark";
                localStorage.setItem(THEME_KEY, newTheme);
                applyTheme(newTheme);
            });
        });
    });
})();
