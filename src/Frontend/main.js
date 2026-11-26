// ! to make the getElementById shorter
function getById(id) {
    return document.getElementById(id);
}

// /////////////////////////

// ! dark mode

function theme() {
    const themeSwitch = getById("theme-switch");
    const metaMode = getById("meta-mode");

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
    const membersBtn = getById("members-btn");
    const membersPopup = getById("members-popup");
    const membersCloseBtn = getById("members-close-btn");

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

const LOGOUT_API = "../../../Backend/Registration/[logout.php]"; //! [Backend]
const WELCOME_PAGE = "../welcome/welcome.html";

function logoutPopup() {
    const logoutBtn = getById("logout-btn");
    const logoutPopup = getById("logout-popup");
    const logoutYesBtn = getById("logout-yes-btn");
    const logoutNoBtn = getById("logout-no-btn");

    // if the page has the logout popup
    if (logoutBtn && logoutPopup) {

        // to open the popup
        logoutBtn.addEventListener("click", () => {
            logoutPopup.showModal();
        });

        // "No" close the popup
        logoutNoBtn.addEventListener("click", () => {
            logoutPopup.close();
        });

        // "Yes" end the session, then go to the welcome page
        logoutYesBtn.addEventListener("click", async () => {
            try {
                await fetch(LOGOUT_API, {
                    method: "POST",
                    credentials: "same-origin", // to let the server end the session correctly
                });
                window.location.href = WELCOME_PAGE;
            } catch (error) {
                // if the backend is failed, keep the user logged in
                console.warn("Could not logout:", error);
            }
        });
    }
}

logoutPopup();

// ////////////////////////////

// ! side menu (header, on small screens)

function sideMenu() {
    const menuBtn = getById("menu-btn");
    const menu = getById("sideMenu");

    // open/close the menu, and change the icon (menu <-> close)
    function setMenuOpen(isOpen) {
        menu.classList.toggle("open", isOpen);
        menuBtn.setAttribute("aria-expanded", isOpen);

        if (isOpen) {
            menuBtn.firstElementChild.textContent = "close";
        } else {
            menuBtn.firstElementChild.textContent = "menu";
        }
    }

    // if the page has the side menu
    if (menuBtn && menu) {

        // the menu button
        menuBtn.addEventListener("click", () => {
            const isOpen = menu.classList.contains("open");
            setMenuOpen(!isOpen);
        });

        // clicking outside the menu closes it
        document.addEventListener("click", (event) => {
            if (!menu.contains(event.target) && !menuBtn.contains(event.target)) {
                setMenuOpen(false);
            }
        });

        // the "Escape" key closes it
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                setMenuOpen(false);
            }
        });
    }
}

sideMenu();

// ////////////////////////////

// ! backend requests (shared by all the pages)

/*
    Every page imports these two functions, so 401 and errors are handled
    the same way everywhere (see section 4 of src/Backend/Backend.md).
*/

const LOGIN_PAGE = "../Forms/login.html";

//! GET data from the backend
// returns the JSON, or null when not logged in (then the page goes to the login page)
// throws an error when the backend is not ready or failed, so each page decides what to do
async function getFromBackend(api) {
    const response = await fetch(api, {
        credentials: "same-origin",
        headers: { "Accept": "application/json" },
    });

    // not logged in (or the session expired)
    if (response.status === 401) {
        window.location.href = LOGIN_PAGE;
        return null;
    }

    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
}

//! POST form data to the backend
// returns true if it succeeded, or false (the reason is shown inside messageElement)
// redirectOn401: false for login and register, because there 401 means "wrong email or password"
async function sendToBackend(api, formData, messageElement, { redirectOn401 = true } = {}) {
    // empty the old message (and remove the green color used by the profile page)
    if (messageElement) {
        messageElement.classList.remove("success");
        messageElement.textContent = "";
    }

    try {
        const response = await fetch(api, {
            method: "POST",
            body: formData,
            credentials: "same-origin",
        });

        // not logged in (or the session expired)
        if (response.status === 401 && redirectOn401) {
            window.location.href = LOGIN_PAGE;
            return false;
        }

        if (response.ok) {
            return true;
        }

        // show the reason from the backend
        const data = await response.json();
        if (messageElement) {
            messageElement.textContent = data.message || "Something went wrong.";
        }
    } catch (error) {
        // the backend is not ready or failed
        console.warn("Could not send to the backend:", error);
        if (messageElement) {
            messageElement.textContent = "Could not reach the server. Please try again later.";
        }
    }

    return false;
}

// ////////////////////////////

export { getById, getFromBackend, sendToBackend };
