import { getById } from '../../main.js';

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
});

customBtn.addEventListener("click", () => {
    showDiet("custom");
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

function deleteMeal(type, index) {
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

    mealFormTitle.textContent = "Add Meal";
    saveMealBtn.textContent = "Save Meal";
}

getById("clear-form-btn").addEventListener("click", () => {
    clearMealForm();
});

// ////////////////////////////

// ! save or update meal

mealForm.addEventListener("submit", (event) => {
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