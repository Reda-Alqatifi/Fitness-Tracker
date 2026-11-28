import { getById, getFromBackend, sendToBackend } from "../../main.js";

// Profile page (the data comes from the backend, the forms are sent to it)

/*
    Loading the profile:
        200 -> success to access the data
        401 -> not logged in (the page redirects to the login page)

    Expected response (ex) from backend (200):
        {
            "name": "Flan",
            "gender": "male",
            "birthdate": "2004-05-17",
            "age": 22,
            "height": 175,
            "weight": 78,
            "targetWeight": 72,
            "goal": "lose",
            "activity": "moderate",
            "created": "2026-10-07"
        }

    The three forms are sent as form data (POST), so the backend can read
    them using $_POST.

    Edit fields:
        name, birthdate, height, weight, target-weight, gender, goal, activity

    Password fields:
        old-password, new-password, confirm-new-password

    Delete fields:
        email, password, confirm-password

    Responses of the forms:
        200   -> success
        other -> failed, with the reason to show it under the form (ex):
            { "message": "Wrong password" }
*/

const PROFILE_API = "../../../Backend/Profile/[profile.php]"; //! [Backend]
const EDIT_API = "../../../Backend/Profile/[edit_profile.php]"; //! [Backend]
const PASSWORD_API = "../../../Backend/Profile/[change_password.php]"; //! [Backend]
const DELETE_API = "../../../Backend/Profile/[delete_account.php]"; //! [Backend]

const WELCOME_PAGE = "../welcome/welcome.html";

// With the "maintain" goal, the target weight can be this far (in kg) from the weight
const MAINTAIN_RANGE = 2;

// The text shown for each value that comes from the backend
const GENDERS = {
    male: "Male",
    female: "Female",
};
const GOALS = {
    lose: "Lose weight",
    gain: "Gain weight",
    maintain: "Maintain weight",
};
const ACTIVITIES = {
    sedentary: "Sedentary",
    light: "Lightly active",
    moderate: "Moderately active",
    very: "Very active",
};

const editForm = getById("edit-form");
const passwordForm = getById("password-form");
const deleteForm = getById("delete-form");

const editMessage = getById("edit-message");
const passwordMessage = getById("password-message");
const deleteMessage = getById("delete-message");

const deletePopup = getById("delete-popup");
const deleteYesBtn = getById("delete-yes-btn");
const deleteNoBtn = getById("delete-no-btn");

// Put a value inside an element, or "--" if there is no value
function setText(id, value) {
    if (value === undefined || value === null || value === "") {
        getById(id).textContent = "--";
    } else {
        getById(id).textContent = value;
    }
}

// Put a value inside an input, or leave it empty if there is no value
function setValue(id, value) {
    if (value === undefined || value === null) {
        getById(id).value = "";
    } else {
        getById(id).value = value;
    }
}

// Fill the "My information" card
function renderInfo(data) {
    setText("name", data.name);
    setText("gender", GENDERS[data.gender]);
    setText("age", data.age);
    setText("height", data.height);
    setText("weight", data.weight);
    setText("target-weight", data.targetWeight);
    setText("goal", GOALS[data.goal]);
    setText("activity", ACTIVITIES[data.activity]);
    setText("created", data.created);
}

// Fill the edit form with the current information
function fillEditForm(data) {
    setValue("edit-name", data.name);
    setValue("edit-birthdate", data.birthdate);
    setValue("edit-height", data.height);
    setValue("edit-weight", data.weight);
    setValue("edit-target-weight", data.targetWeight);
    setValue("edit-gender", data.gender);
    setValue("edit-goal", data.goal);
    setValue("edit-activity", data.activity);
}

async function loadProfile() {
    try {
        //! getFromBackend() is in main.js
        const data = await getFromBackend(PROFILE_API);

        // go back to the login page
        if (!data) {
            return;
        }

        renderInfo(data);
        fillEditForm(data);
    } catch (error) {
        // the backend is not ready or failed, so the page stay empty
        console.warn("Could not load the profile data:", error);
    }
}

loadProfile();

// Show a green message under a form
function showSuccess(message, text) {
    message.classList.add("success");
    message.textContent = text;
}

// Show a red message under a form
function showError(message, text) {
    message.classList.remove("success");
    message.textContent = text;
}

// Check that the target weight does not contradict the goal
// (returns the problem as text, or "" if there is no problem)
function checkTargetWeight() {
    const goal = getById("edit-goal").value;
    const target = getById("edit-target-weight").value;

    // the target weight is optional
    if (target === "") {
        return "";
    }

    const weight = Number(getById("edit-weight").value);
    const targetWeight = Number(target);

    if (goal === "lose" && targetWeight >= weight) {
        return "To lose weight, the target weight must be lower than your weight.";
    }
    if (goal === "gain" && targetWeight <= weight) {
        return "To gain weight, the target weight must be higher than your weight.";
    }
    // "maintain" allows a small difference
    if (goal === "maintain" && Math.abs(targetWeight - weight) > MAINTAIN_RANGE) {
        return `To maintain weight, the target weight must be within ${MAINTAIN_RANGE} kg of your weight.`;
    }

    return "";
}

// Edit information
editForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const problem = checkTargetWeight();

    if (problem !== "") {
        showError(editMessage, problem);
        return;
    }

    //! sendToBackend() is in main.js
    const saved = await sendToBackend(EDIT_API, new FormData(editForm), editMessage);

    if (saved) {
        showSuccess(editMessage, "Your information was saved.");
        loadProfile();
    }
});

// Change password
passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const newPassword = getById("new-password").value;
    const confirmPassword = getById("confirm-new-password").value;

    if (newPassword !== confirmPassword) {
        showError(passwordMessage, "The two new passwords do not match.");
        return;
    }

    //! sendToBackend() is in main.js
    const changed = await sendToBackend(PASSWORD_API, new FormData(passwordForm), passwordMessage);

    if (changed) {
        passwordForm.reset();
        showSuccess(passwordMessage, "Your password was changed.");
    }
});

// Delete account: the Delete button only opens the "are you sure?" popup
deleteForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const password = getById("delete-password").value;
    const confirmPassword = getById("delete-confirm-password").value;

    if (password !== confirmPassword) {
        showError(deleteMessage, "The two passwords do not match.");
        return;
    }

    deleteMessage.textContent = "";
    deletePopup.showModal();
});

// "No" closes the popup
deleteNoBtn.addEventListener("click", () => {
    deletePopup.close();
});

// "Yes" deletes the account, then goes to the welcome page
deleteYesBtn.addEventListener("click", async () => {
    deletePopup.close();

    //! sendToBackend() is in main.js
    const deleted = await sendToBackend(DELETE_API, new FormData(deleteForm), deleteMessage);

    if (deleted) {
        window.location.href = WELCOME_PAGE;
    }
});
