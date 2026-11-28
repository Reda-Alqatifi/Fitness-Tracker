import { getFromBackend, sendToBackend } from '../../main.js';

// ! exercises page data (from the backend)

/*
    Loading the exercises:
        GET exercises.php
        200 -> success to access the data
        401 -> not logged in (the page redirects to the login page)

    Expected response (ex) from backend (200):
        {
            "mode": "recommended",
            "burned": 380,
            "steps": 7000,
            "recommended": [
                { "name": "Bench Press", "days": ["sunday", "wednesday"], "weight": 20, "unit": "kg" }
            ],
            "custom": [
                { "id": 5, "name": "Bicep Curl", "days": ["sunday", "tuesday"], "weight": 10, "unit": "kg" }
            ]
        }
        (weight is in the unit the user chose, burned and steps are for today)

    The forms are sent as form data (POST), so the backend can read them using $_POST:
        exercise_mode.php   -> mode (recommended | custom)
        exercise_add.php    -> exercise-name, training-days[] (sunday ... saturday), weight, unit (kg | lb)
        exercise_edit.php   -> id + the same fields as exercise_add.php
        exercise_delete.php -> id
        steps.php           -> steps

    Responses of the forms:
        200   -> success
        other -> failed, with the reason to show it under the form (ex):
            { "message": "Choose at least one training day" }

    Until the backend is ready, the custom exercises are saved in the browser (localStorage).
*/

const EXERCISES_API = '../../../Backend/Exercises/[exercises.php]'; //! [Backend]
const EXERCISE_MODE_API = '../../../Backend/Exercises/[exercise_mode.php]'; //! [Backend]
const EXERCISE_ADD_API = '../../../Backend/Exercises/[exercise_add.php]'; //! [Backend]
const EXERCISE_EDIT_API = '../../../Backend/Exercises/[exercise_edit.php]'; //! [Backend]
const EXERCISE_DELETE_API = '../../../Backend/Exercises/[exercise_delete.php]'; //! [Backend]
const STEPS_API = '../../../Backend/Exercises/[steps.php]'; //! [Backend]

// The same numbers as the backend (includes/fitness.php)
const KCAL_PER_EXERCISE = 50;
const KCAL_PER_STEP = 0.04;

// true after the exercises are loaded from the backend
let backendReady = false;

const STORAGE_KEY = 'ft_custom_exercises_v1';

const DEFAULT_CUSTOM_EXERCISES = [
    {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        name: 'Bicep Curl',
        days: ['sunday', 'tuesday', 'thursday'],
        weight: 10,
        unit: 'kg',
    },
];

// DOM references matching exercises.html
const btnRecommended = document.getElementById('btn-recommended');
const btnCustom = document.getElementById('btn-custom');

const recommendedSection = document.getElementById('recommended')?.closest('article');
const customSection = document.getElementById('custom')?.closest('article');
const recommendedTableBody = recommendedSection?.querySelector('tbody');
const customTableBody = customSection?.querySelector('tbody');

const exerciseForm = document.getElementById('exercise-form');
const exerciseMessage = document.getElementById('exercise-message');
const nameInput = document.getElementById('exercise-name');
const weightInput = document.getElementById('weight');
const unitSelect = document.getElementById('unit');
const dayCheckboxes = Array.from(document.querySelectorAll('input[name="training-days[]"]'));
const caloriesStrong = document.getElementById('calories-burned');

const stepsForm = document.getElementById('steps-form');
const stepsInput = document.getElementById('steps');
const stepsMessage = document.getElementById('steps-message');

let customExercises = loadCustomExercises();
let editingId = null;

function formatDay(day) {
    return day.charAt(0).toUpperCase() + day.slice(1);
}

// "sunday", "monday", ... (the same values as the checkboxes)
function todayName() {
    return new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
}

function loadCustomExercises() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [...DEFAULT_CUSTOM_EXERCISES];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [...DEFAULT_CUSTOM_EXERCISES];
    } catch {
        return [...DEFAULT_CUSTOM_EXERCISES];
    }
}

function saveCustomExercises() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(customExercises));
    } catch {
        // Ignore storage quota or private-mode errors
    }
}

function showMessage(element, text) {
    if (element) element.textContent = text;
}

function setScheduleView(mode) {
    if (mode === 'recommended') {
        btnRecommended?.classList.add('active');
        btnCustom?.classList.remove('active');
        if (recommendedSection) recommendedSection.style.display = '';
        if (customSection) customSection.style.display = 'none';
    } else if (mode === 'custom') {
        btnCustom?.classList.add('active');
        btnRecommended?.classList.remove('active');
        if (customSection) customSection.style.display = '';
        if (recommendedSection) recommendedSection.style.display = 'none';
    } else {
        // Show both if requested
        if (recommendedSection) recommendedSection.style.display = '';
        if (customSection) customSection.style.display = '';
    }
}

// Without the backend: 50 kcal for each of today's custom exercises (SRS: the count, not the type)
// plus the steps. With the backend, the number comes from exercises.php
function updateCaloriesBurned() {
    if (!caloriesStrong || backendReady) return;

    const today = todayName();
    const count = customExercises.filter((ex) => ex.days.includes(today)).length;
    const steps = Number(stepsInput?.value) || 0;

    caloriesStrong.textContent = `~${Math.round(count * KCAL_PER_EXERCISE + steps * KCAL_PER_STEP)}`;
}

function resetFormState() {
    editingId = null;
    exerciseForm?.reset();
    const submitBtn = exerciseForm?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Save Exercise';
}

function populateFormForEdit(exercise) {
    editingId = exercise.id;
    showMessage(exerciseMessage, '');
    if (nameInput) nameInput.value = exercise.name;
    if (weightInput) weightInput.value = exercise.weight;
    if (unitSelect) unitSelect.value = exercise.unit;

    dayCheckboxes.forEach((cb) => {
        cb.checked = exercise.days.includes(cb.value);
    });

    const submitBtn = exerciseForm?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Update Exercise';

    setScheduleView('custom');
    exerciseForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    nameInput?.focus();
}

// The recommended table (only replaced when the backend sends the list)
function renderRecommendedExercises(exercises) {
    if (!recommendedTableBody) return;
    recommendedTableBody.innerHTML = '';

    exercises.forEach((exercise) => {
        const tr = document.createElement('tr');

        const values = [
            exercise.name,
            exercise.days.map(formatDay).join(', '),
            String(exercise.weight),
            exercise.unit,
        ];

        for (const value of values) {
            const td = document.createElement('td');
            td.textContent = value;
            tr.appendChild(td);
        }

        recommendedTableBody.appendChild(tr);
    });
}

function renderCustomExercises() {
    if (!customTableBody) return;
    customTableBody.innerHTML = '';

    if (customExercises.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="5">No custom exercises yet. Add one using the form below.</td>
        `;
        customTableBody.appendChild(emptyRow);
        updateCaloriesBurned();
        return;
    }

    customExercises.forEach((exercise) => {
        const tr = document.createElement('tr');

        const nameTd = document.createElement('td');
        nameTd.textContent = exercise.name;

        const daysTd = document.createElement('td');
        daysTd.textContent = exercise.days.map(formatDay).join(', ');

        const weightTd = document.createElement('td');
        weightTd.textContent = String(exercise.weight);

        const unitTd = document.createElement('td');
        unitTd.textContent = exercise.unit;

        const actionsTd = document.createElement('td');

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => populateFormForEdit(exercise));

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => deleteExercise(exercise));

        actionsTd.append(editBtn, deleteBtn);
        tr.append(nameTd, daysTd, weightTd, unitTd, actionsTd);
        customTableBody.appendChild(tr);
    });

    updateCaloriesBurned();
}

// ////////////////////////////

// ! backend requests

// Get the exercises, today's burned calories, and today's steps
async function loadExercises(useSavedMode = false) {
    try {
        //! getFromBackend() is in main.js
        const data = await getFromBackend(EXERCISES_API);

        // go back to the login page
        if (!data) return;

        backendReady = true;
        customExercises = data.custom || [];

        renderRecommendedExercises(data.recommended || []);
        renderCustomExercises();

        if (caloriesStrong) caloriesStrong.textContent = `~${data.burned ?? 0}`;
        if (stepsInput) stepsInput.value = data.steps ?? 0;

        if (useSavedMode && data.mode) {
            setScheduleView(data.mode);
        }
    } catch (error) {
        // the backend is not ready or failed, so the page keeps working in the browser only
        console.warn('Could not load the exercises data:', error);
    }
}

// Save the chosen schedule (recommended / custom)
async function saveMode(mode) {
    if (!backendReady) return;

    const formData = new FormData();
    formData.append('mode', mode);

    // the burned calories depend on the chosen schedule, so load again
    //! sendToBackend() is in main.js
    if (await sendToBackend(EXERCISE_MODE_API, formData, exerciseMessage)) {
        await loadExercises();
    }
}

async function deleteExercise(exercise) {
    if (backendReady) {
        const formData = new FormData();
        formData.append('id', exercise.id);

        //! sendToBackend() is in main.js
        if (await sendToBackend(EXERCISE_DELETE_API, formData, exerciseMessage)) {
            if (editingId === exercise.id) resetFormState();
            await loadExercises();
        }
        return;
    }

    customExercises = customExercises.filter((item) => item.id !== exercise.id);
    if (editingId === exercise.id) {
        resetFormState();
    }
    saveCustomExercises();
    renderCustomExercises();
}

// ////////////////////////////

// Schedule toggle buttons
btnRecommended?.addEventListener('click', () => {
    setScheduleView('recommended');
    saveMode('recommended');
});
btnCustom?.addEventListener('click', () => {
    setScheduleView('custom');
    saveMode('custom');
});

// Form submission (Add or Update)
exerciseForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage(exerciseMessage, '');

    const name = nameInput?.value.trim() || '';
    const weight = parseFloat(weightInput?.value ?? '0');
    const unit = unitSelect?.value || 'kg';
    const selectedDays = dayCheckboxes.filter((cb) => cb.checked).map((cb) => cb.value);

    if (!name || Number.isNaN(weight) || weight < 0) return;

    // the training days are required (SRS), the backend refuses an empty list too
    if (selectedDays.length === 0) {
        showMessage(exerciseMessage, 'Choose at least one training day.');
        return;
    }

    // save it in the database, then load the exercises again
    if (backendReady) {
        const formData = new FormData(exerciseForm);
        let api = EXERCISE_ADD_API;

        if (editingId) {
            formData.append('id', editingId);
            api = EXERCISE_EDIT_API;
        }

        //! sendToBackend() is in main.js
        if (await sendToBackend(api, formData, exerciseMessage)) {
            resetFormState();
            await loadExercises();
        }
        return;
    }

    if (editingId) {
        customExercises = customExercises.map((item) =>
            item.id === editingId
                ? { ...item, name, days: selectedDays, weight, unit }
                : item
        );
    } else {
        customExercises.push({
            id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
            name,
            days: selectedDays,
            weight,
            unit,
        });
    }

    saveCustomExercises();
    renderCustomExercises();
    resetFormState();
});

exerciseForm?.addEventListener('reset', () => {
    editingId = null;
    showMessage(exerciseMessage, '');
    const submitBtn = exerciseForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Save Exercise';
});

// Today's steps
stepsForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (backendReady) {
        //! sendToBackend() is in main.js
        if (await sendToBackend(STEPS_API, new FormData(stepsForm), stepsMessage)) {
            await loadExercises();
        }
        return;
    }

    // without the backend, only the burned calories are updated
    updateCaloriesBurned();
});

// Initial render
renderCustomExercises();
setScheduleView('recommended');
loadExercises(true);
