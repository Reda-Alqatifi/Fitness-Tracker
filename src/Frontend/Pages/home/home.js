import { getById } from '../../main.js';

// ! home page data (from the backend)

/*
    Responses:
        200 -> success to access the data
        401 -> not logged in (the page redirects to the login page)

    Expected response (ex) from backend (200):
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

const HOME_API = "../../../Backend/[home.php]"; //! [Backend]
const LOGIN_PAGE = "../Forms/login.html";

//! get the data of the logged-in user from the backend
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

//! put a value inside an element, or "--" if there is no value
function setText(id, value) {
    const element = getById(id);

    if (!element) {
        return;
    }

    if (value === undefined || value === null || value === "") {
        element.textContent = "--";
    } else {
        element.textContent = value;
    }
}

//! to fill the welcome card and the body stats
function renderInfo(data) {
    setText("name" , data.name);
    setText("weight", data.weight);
    setText("BMI", data.bmi);
    setText("PBF", data.pbf);
    setText("SMM", data.smm);
}

//! to fill the exercises table
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
                exercise.name,`${exercise.sets} x ${exercise.reps}` , `${exercise.weight} kg`,]) {

            const cell = document.createElement("td");
            cell.textContent = text;
            row.appendChild(cell);
        }

        tbody.appendChild(row);
    }
}

//! to fill the calories card
function renderCalories(calories = {}) {
    let consumed = calories.consumed;
    let goal = calories.goal;
    let burned = calories.burned;

    // put 0 if no value
    if (consumed === undefined || consumed === null)
        consumed = 0;

    if (goal === undefined || goal === null)
        goal = 0;

    if (burned === undefined || burned === null)
        burned = 0;

    getById("consumed").textContent = consumed.toLocaleString();
    getById("calories-goal").textContent = goal.toLocaleString();
    getById("burned").textContent = burned.toLocaleString();

    // percentage of the goal (max 100%)
    function percent(value) {
        if (goal <= 0)
            return 0;

        return Math.min(value / goal * 100, 100);
    }

    getById("consumed-bar").style.width = `${percent(consumed)}%`;
    getById("burned-bar").style.width = `${percent(burned)}%`;
}

// ////////////////////////////

async function loadHome() {
    try {
        const data = await fetchHomeData();

        // go back to the login page
        if (!data) {
            return;
        }

        renderInfo(data);
        renderExercises(data.exercises);
        renderCalories(data.calories);
    } catch (error) {
        // the backend is not ready or failed, so the page stay empty
        console.warn("Could not load the home data:", error);
    }
}

loadHome();
