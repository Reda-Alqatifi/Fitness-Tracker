import { getById, getFromBackend, sendToBackend } from '../../main.js';

// ////////////////////////////

// ! diet page data (from the backend)

/*
    Loading the diet:
        GET diet.php
        200 -> success to access the data
        401 -> not logged in (the page redirects to the login page)

    Expected response (ex) from backend (200):
        {
            "mode": "recommended",
            "targets": { "calories": 2400, "protein": 140, "carbohydrates": 280, "fats": 67 },
            "meals": [
                { "id": 12, "name": "Grilled Chicken", "protein": 40, "carbohydrates": 30,
                  "fats": 12, "calories": 400, "source": "recommended" }
            ]
        }
        (source = "recommended" goes to the first table, "custom" goes to the second)

    The forms are sent as form data (POST), so the backend can read them using $_POST:
        diet_mode.php   -> mode (recommended | custom)
        meal_add.php    -> meal-name, protein, carbohydrates, fats, calories
        meal_edit.php   -> id + the same fields as meal_add.php
        meal_delete.php -> id

    Responses of the forms:
        200   -> success
        other -> failed, with the reason to show it under the form (ex):
            { "message": "Meal not found" }

    Until the backend is ready, the page works only in the browser
    with the meals written in diet.html (nothing is saved).
*/

const DIET_API = "../../../Backend/Diet/[diet.php]"; //! [Backend]
const DIET_MODE_API = "../../../Backend/Diet/[diet_mode.php]"; //! [Backend]
const MEAL_ADD_API = "../../../Backend/Diet/[meal_add.php]"; //! [Backend]
const MEAL_EDIT_API = "../../../Backend/Diet/[meal_edit.php]"; //! [Backend]
const MEAL_DELETE_API = "../../../Backend/Diet/[meal_delete.php]"; //! [Backend]

// true after the diet is loaded from the backend
let backendReady = false;

// ////////////////////////////

// ! diet page elements

const recommendedBody = getById("recommended-meals");
const customBody = getById("custom-meals");

const recommendedSection = getById("recommended-section");
const customSection = getById("custom-section");

const recommendedBtn = getById("btn-recommended");
const customBtn = getById("btn-custom");

const mealForm = getById("meal-form");
const mealFormTitle = getById("meal-form-title");
const saveMealBtn = getById("save-meal-btn");
const addMealBtn = getById("add-meal-btn");

// ////////////////////////////

// ! meal data

function readMeals(tbody) {
    const meals = [];

    for (const row of tbody.querySelectorAll("tr")) {
        const cells = row.querySelectorAll("td");

        if (cells.length < 5) {
            continue;
        }

        meals.push({
            name: cells[0].textContent.trim(),
            protein: Number(cells[1].textContent),
            carbohydrates: Number(cells[2].textContent),
            fats: Number(cells[3].textContent),
            calories: Number(cells[4].textContent)
        });
    }

    return meals;
}

let recommendedMeals = readMeals(recommendedBody);
let customMeals = readMeals(customBody);

let editingMeal = null;

// ////////////////////////////

// ! render meals

function renderMeals(tbody, meals) {
    tbody.innerHTML = "";

    meals.forEach((meal, index) => {
        const row = document.createElement("tr");
        row.dataset.index = index;

        const values = [
            meal.name,
            meal.protein,
            meal.carbohydrates,
            meal.fats,
            meal.calories
        ];

        for (const value of values) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        }

        const actionsCell = document.createElement("td");

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "edit-btn";
        editBtn.dataset.action = "edit";
        editBtn.textContent = "Edit";

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "delete-btn";
        deleteBtn.dataset.action = "delete";
        deleteBtn.textContent = "Delete";

        actionsCell.append(editBtn, deleteBtn);
        row.appendChild(actionsCell);

        tbody.appendChild(row);
    });
}

// ////////////////////////////

// ! daily nutrition

function renderNutrition() {
    const allMeals = [...recommendedMeals, ...customMeals];

    const totals = {
        calories: 0,
        protein: 0,
        carbohydrates: 0,
        fats: 0
    };

    for (const meal of allMeals) {
        totals.calories += meal.calories;
        totals.protein += meal.protein;
        totals.carbohydrates += meal.carbohydrates;
        totals.fats += meal.fats;
    }

    const calorieTarget = Number(
        getById("calorie-target").textContent
    );

    const proteinTarget = Number(
        getById("protein-recommended").textContent
    );

    const carbsTarget = Number(
        getById("carbs-recommended").textContent
    );

    const fatsTarget = Number(
        getById("fats-recommended").textContent
    );

    // calories
    getById("calories-consumed").textContent =
        totals.calories.toLocaleString();

    getById("calories-remaining").textContent =
        Math.max(0, calorieTarget - totals.calories).toLocaleString();

    const calorieProgress = getById("calorie-progress");
    calorieProgress.max = calorieTarget;
    calorieProgress.value = totals.calories;

    // protein
    getById("protein-consumed").textContent = totals.protein;

    const proteinProgress = getById("protein-progress");
    proteinProgress.max = proteinTarget;
    proteinProgress.value = totals.protein;

    // carbohydrates
    getById("carbs-consumed").textContent = totals.carbohydrates;

    const carbsProgress = getById("carbs-progress");
    carbsProgress.max = carbsTarget;
    carbsProgress.value = totals.carbohydrates;

    // fats
    getById("fats-consumed").textContent = totals.fats;

    const fatsProgress = getById("fats-progress");
    fatsProgress.max = fatsTarget;
    fatsProgress.value = totals.fats;
}

// ////////////////////////////

// ! render the whole page

function renderDiet() {
    renderMeals(recommendedBody, recommendedMeals);
    renderMeals(customBody, customMeals);
    renderNutrition();
}

// ////////////////////////////

// ! backend requests

// The line under the meal form that shows the reason from the backend
const mealMessage = getById("meal-message");

function showMessage(text) {
    mealMessage.textContent = text;
}

// Get the meals and the targets of the logged-in user
async function loadDiet(useSavedMode = false) {
    try {
        //! getFromBackend() is in main.js
        const data = await getFromBackend(DIET_API);

        // go back to the login page
        if (!data) {
            return;
        }

        const meals = data.meals || [];
        const targets = data.targets || {};

        backendReady = true;

        recommendedMeals = meals.filter(meal => meal.source === "recommended");
        customMeals = meals.filter(meal => meal.source === "custom");

        getById("calorie-target").textContent = targets.calories ?? 0;
        getById("protein-recommended").textContent = targets.protein ?? 0;
        getById("carbs-recommended").textContent = targets.carbohydrates ?? 0;
        getById("fats-recommended").textContent = targets.fats ?? 0;

        renderDiet();

        if (useSavedMode && data.mode) {
            showDiet(data.mode);
        }
    } catch (error) {
        // the backend is not ready or failed, so the page keeps the meals in diet.html
        console.warn("Could not load the diet data:", error);
    }
}

// Save the chosen diet (recommended / custom)
async function saveMode(type) {
    if (!backendReady) {
        return;
    }

    const formData = new FormData();
    formData.append("mode", type);

    // choosing "recommended" adds today's recommended meals, so load them
    //! sendToBackend() is in main.js
    if (await sendToBackend(DIET_MODE_API, formData, mealMessage)) {
        await loadDiet();
    }
}

// ////////////////////////////

// ! recommended / custom selector

function showDiet(type) {
    const showRecommended = type === "recommended";

    recommendedSection.hidden = !showRecommended;
    customSection.hidden = showRecommended;

    recommendedBtn.classList.toggle("active", showRecommended);
    customBtn.classList.toggle("active", !showRecommended);
}

recommendedBtn.addEventListener("click", () => {
    showDiet("recommended");
    saveMode("recommended");
});

customBtn.addEventListener("click", () => {
    showDiet("custom");
    saveMode("custom");
});

// ////////////////////////////

// ! add meal

addMealBtn.addEventListener("click", () => {
    clearMealForm();
    getById("meal-form-section").scrollIntoView({
        behavior: "smooth"
    });
});

// ////////////////////////////

// ! edit meal

function editMeal(type, index) {
    const meals = type === "recommended"
        ? recommendedMeals
        : customMeals;

    const meal = meals[index];

    if (!meal) {
        return;
    }

    editingMeal = { type, index };

    getById("meal-name").value = meal.name;
    getById("protein").value = meal.protein;
    getById("carbohydrates").value = meal.carbohydrates;
    getById("fats").value = meal.fats;
    getById("calories").value = meal.calories;

    mealFormTitle.textContent = "Edit Meal";
    saveMealBtn.textContent = "Update Meal";

    getById("meal-form-section").scrollIntoView({
        behavior: "smooth"
    });
}

// ////////////////////////////

// ! delete meal

async function deleteMeal(type, index) {
    const meals = type === "recommended"
        ? recommendedMeals
        : customMeals;

    if (!meals[index]) {
        return;
    }

    const confirmed = confirm("Are you sure you want to delete this meal?");

    if (!confirmed) {
        return;
    }

    // delete it from the database, then load the meals again
    if (backendReady) {
        const formData = new FormData();
        formData.append("id", meals[index].id);

        //! sendToBackend() is in main.js
        if (await sendToBackend(MEAL_DELETE_API, formData, mealMessage)) {
            await loadDiet();
        }
        return;
    }

    meals.splice(index, 1);

    renderDiet();
}

// ////////////////////////////

// ! meal actions

function handleMealAction(event, type) {
    const button = event.target.closest("button[data-action]");

    if (!button) {
        return;
    }

    const row = button.closest("tr");

    if (!row) {
        return;
    }

    const index = Number(row.dataset.index);

    if (button.dataset.action === "edit") {
        editMeal(type, index);
    }

    if (button.dataset.action === "delete") {
        deleteMeal(type, index);
    }
}

recommendedBody.addEventListener("click", (event) => {
    handleMealAction(event, "recommended");
});

customBody.addEventListener("click", (event) => {
    handleMealAction(event, "custom");
});

// ////////////////////////////

// ! clear meal form

function clearMealForm() {
    mealForm.reset();

    editingMeal = null;
    showMessage("");

    mealFormTitle.textContent = "Add Meal";
    saveMealBtn.textContent = "Save Meal";
}

getById("clear-form-btn").addEventListener("click", () => {
    clearMealForm();
});

// ////////////////////////////

// ! save or update meal

mealForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!mealForm.checkValidity()) {
        mealForm.reportValidity();
        return;
    }

    const meal = {
        name: getById("meal-name").value.trim(),
        protein: Number(getById("protein").value),
        carbohydrates: Number(getById("carbohydrates").value),
        fats: Number(getById("fats").value),
        calories: Number(getById("calories").value)
    };

    // make sure the meal name is not empty
    if (!meal.name) {
        getById("meal-name").focus();
        return;
    }

    // save it in the database, then load the meals again
    if (backendReady) {
        const formData = new FormData(mealForm);
        let api = MEAL_ADD_API;

        if (editingMeal) {
            const meals = editingMeal.type === "recommended"
                ? recommendedMeals
                : customMeals;

            formData.append("id", meals[editingMeal.index].id);
            api = MEAL_EDIT_API;
        }

        const isNew = !editingMeal;

        //! sendToBackend() is in main.js
        if (await sendToBackend(api, formData, mealMessage)) {
            clearMealForm();
            await loadDiet();

            if (isNew) {
                showDiet("custom");
            }
        }
        return;
    }

    // update an existing meal
    if (editingMeal) {
        const meals = editingMeal.type === "recommended"
            ? recommendedMeals
            : customMeals;

        meals[editingMeal.index] = meal;
    } else {
        // new meals are added to Custom Diet
        customMeals.push(meal);
    }

    clearMealForm();
    renderDiet();
    showDiet("custom");
});

// ////////////////////////////

// ! initial page setup

showDiet("recommended");
renderDiet();
loadDiet(true);