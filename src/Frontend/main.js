// ! dark mode

function theme() {
    const themeSwitch = document.getElementById("theme-switch");
    const metaMode = document.getElementById("meta-mode");

    // turn dark mode on/off, and save the choice
    function setDarkMode(isDark) {
        document.body.classList.toggle("darkmode", isDark);

        if (metaMode) {
            metaMode.content = isDark ? "only dark" : "only light";
        }

        try {
            localStorage.setItem("darkmode", isDark ? "on" : "off");
        } catch {

        }
    }

    // when the page loads, use the saved choice
    try {
        setDarkMode(localStorage.getItem("darkmode") === "on");
    } catch {
        setDarkMode(false);
    }

    // switch the mode when clicking on the button
    if (themeSwitch) {
        themeSwitch.addEventListener("click", () => {
            const isDark = document.body.classList.contains("darkmode");
            setDarkMode(!isDark);
        });
    }
}

theme();

// ////////////////////////////

// ! group members popup (footer)

function popup() {
    const membersBtn = document.getElementById("members-btn");
    const membersPopup = document.getElementById("members-popup");
    const membersCloseBtn = document.getElementById("members-close-btn");

    // if the page has the footer popup
    if (membersBtn && membersPopup) {

        // to open the popup
        membersBtn.addEventListener("click", () => {
            membersPopup.showModal();
        });

        membersCloseBtn.addEventListener("click", () => {
            membersPopup.close();
        });
    }
}

popup();

// ////////////////////////////

// ! logout popup (header)

/*
    The backend (PHP) should end the session of the logged-in user:

        POST  ../../../Backend/api/logout.php

              session_start();
              $_SESSION = [];
              session_destroy();
*/

const LOGOUT_API = "../../../Backend/api/logout.php";
const WELCOME_PAGE = "../welcome/welcome.html";

function logoutPopup() {
    const logoutBtn = document.getElementById("logout-btn");
    const logoutPopup = document.getElementById("logout-popup");
    const logoutYesBtn = document.getElementById("logout-yes-btn");
    const logoutNoBtn = document.getElementById("logout-no-btn");

    // if the page has the logout popup
    if (logoutBtn && logoutPopup) {

        // to open the popup
        logoutBtn.addEventListener("click", () => {
            logoutPopup.showModal();
        });

        // "No" -> just close the popup
        logoutNoBtn.addEventListener("click", () => {
            logoutPopup.close();
        });

        // "Yes" -> end the session, then go to the welcome page
        logoutYesBtn.addEventListener("click", async () => {
            try {
                await fetch(LOGOUT_API, {
                    method: "POST",
                    credentials: "same-origin",
                });
            } catch (error) {
                // the backend is not ready (or failed), go to the welcome page anyway
                console.warn("Could not logout:", error);
            }

            window.location.href = WELCOME_PAGE;
        });
    }
}

logoutPopup();

// ////////////////////////////

export {};
