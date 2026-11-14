import { getById } from "../../main.js";

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

const LOGIN_API = "../../../Backend/[login.php]"; //! [Backend]
const REGISTER_API = "../../../Backend/[register.php]"; //! [Backend]
const HOME_PAGE = "../home/home.html";

// Each page has only one of the two forms
const loginForm = getById("login-form");
const registerForm = getById("register-form");
const message = getById("message");

// Send the form to the backend, then go to the home page
async function sendForm(form, api) {
    message.textContent = "";

    try {
        const response = await fetch(api, {
            method: "POST",
            body: new FormData(form),
            credentials: "same-origin",
        });

        if (response.ok) {
            window.location.href = HOME_PAGE;
            return;
        }

        // show the reason from the backend
        const data = await response.json();
        message.textContent = data.message || "Something went wrong.";
    } catch (error) {
        // the backend is not ready or failed
        console.warn("Could not send the form:", error);
        message.textContent = "Could not reach the server. Please try again later.";
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
