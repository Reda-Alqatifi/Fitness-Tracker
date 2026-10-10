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

export {};
