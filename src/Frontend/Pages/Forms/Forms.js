import { getById, sendToBackend } from "../../main.js";

// Login and register forms (sent to the backend)

/*
    Both forms are sent as form data (POST), so the backend can read them
    using $_POST.

    Login fields:
        email, password, remember ("yes" if it is checked)

    Register fields:
        name, email, password, confirm-password,
        birthdate, height, weight, gender, goal, activity

    Responses:
        200   -> success (the page goes to the home page)
        other -> failed, with the reason to show it under the form (ex):
            { "message": "Wrong email or password" }
*/

const LOGIN_API = "../../../Backend/Registration/[login.php]"; //! [Backend]
const REGISTER_API = "../../../Backend/Registration/[register.php]"; //! [Backend]
const HOME_PAGE = "../home/home.html";

// Each page has only one of the two forms
const loginForm = getById("login-form");
const registerForm = getById("register-form");
const message = getById("message");

// Send the form to the backend, then go to the home page
async function sendForm(form, api) {
    //! sendToBackend() is in main.js (401 here means "wrong email or password", so no redirect)
    const sent = await sendToBackend(api, new FormData(form), message, { redirectOn401: false });

    if (sent) {
        window.location.href = HOME_PAGE;
    }
}

// Login page
if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
        event.preventDefault();
        sendForm(loginForm, LOGIN_API);
    });
}

// Register page
if (registerForm) {
    registerForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const password = getById("password").value;
        const confirmPassword = getById("confirm-password").value;

        if (password !== confirmPassword) {
            message.textContent = "The two passwords do not match.";
            return;
        }

        sendForm(registerForm, REGISTER_API);
    });
}
