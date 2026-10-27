import '../../main.js';

// ! home page data (from the backend)

/*
    The backend (PHP) should return the home data of the LOGGED-IN user as JSON:

        GET  ../../../Backend/api/home.php

    ! Security:
        - The frontend does NOT send a user id. The backend must take it from the
          PHP session that was created on login, so no one can ask for another
          user's data by changing a value in the browser:

              session_start();
              if (!isset($_SESSION['user_id'])) {
                  http_response_code(401);   // not logged in
                  exit;
              }
              $userId = $_SESSION['user_id'];

        - On login: session_regenerate_id(true); then $_SESSION['user_id'] = <id>;
        - Session cookie should be HttpOnly + SameSite=Strict (and Secure on HTTPS).
        - Use prepared statements (PDO) for every query that uses $userId.

    Responses:
        200 -> the data below
        401 -> not logged in (the page redirects to the login page)

    Expected response (200):
        {
            "name": "Flan",
            "weight": 78,
            "bmi": 24.1,
            "pbf": 18,
            "smm": 34,
            "exercises": [
                { "name": "Bench Press", "sets": 3, "reps": 10, "weight": 40 }
            ],
            "calories": {
                "consumed": 1650,
                "goal": 2400,
                "burned": 420
            }
        }
*/

const HOME_API = "../../../Backend/api/home.php";
const LOGIN_PAGE = "../Forms/login.html";

// get the data of the logged-in user from the backend
// (the session cookie is sent automatically, the backend knows who the user is)
async function fetchHomeData() {
    const response = await fetch(HOME_API, {
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

// ////////////////////////////

// put a value inside an element, or "--" if there is no value
function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = (value ?? "") === "" ? "--" : value;
    }
}

// fill the welcome card and the body stats
function renderInfo(data) {
    document.getElementById("name").textContent = data.name ?? "";

    setText("weight", data.weight);
    setText("BMI", data.bmi);
    setText("PBF", data.pbf);
    setText("SMM", data.smm);
}

// fill the exercises table
function renderExercises(exercises = []) {
    const tbody = document.querySelector("#exercises-table tbody");

    // keep the "No exercises" row if the list is empty
    if (exercises.length === 0) {
        return;
    }

    tbody.innerHTML = "";

    for (const exercise of exercises) {
        const row = document.createElement("tr");

        for (const text of [
            exercise.name,
            `${exercise.sets} x ${exercise.reps}`,
            `${exercise.weight} kg`,
        ]) {
            const cell = document.createElement("td");
            cell.textContent = text;
            row.appendChild(cell);
        }

        tbody.appendChild(row);
    }
}

// fill the calories card and its progress bars
function renderCalories(calories = {}) {
    const consumed = calories.consumed ?? 0;
    const goal = calories.goal ?? 0;
    const burned = calories.burned ?? 0;

    document.getElementById("consumed").textContent = consumed.toLocaleString();
    document.getElementById("calories-goal").textContent = goal.toLocaleString();
    document.getElementById("burned").textContent = burned.toLocaleString();

    // percentage of the goal (max 100%)
    const percent = (value) => goal > 0 ? Math.min(value / goal * 100, 100) : 0;

    document.getElementById("consumed-bar").style.width = `${percent(consumed)}%`;
    document.getElementById("burned-bar").style.width = `${percent(burned)}%`;
}

// ////////////////////////////

async function loadHome() {
    try {
        const data = await fetchHomeData();

        // redirecting to the login page
        if (!data) {
            return;
        }

        renderInfo(data);
        renderExercises(data.exercises);
        renderCalories(data.calories);
    } catch (error) {
        // the backend is not ready (or failed), so the page stays empty
        console.warn("Could not load the home data:", error);
    }
}

loadHome();
