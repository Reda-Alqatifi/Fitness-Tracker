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

const LOGOUT_API = "../../../Backend/[logout.php]"; //! [Backend]
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

export { getById };
