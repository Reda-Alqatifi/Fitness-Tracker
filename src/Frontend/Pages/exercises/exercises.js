import '../../main.js';

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
const customTableBody = customSection?.querySelector('tbody');

const exerciseForm = document.querySelector('form');
const nameInput = document.getElementById('exercise-name');
const weightInput = document.getElementById('weight');
const unitSelect = document.getElementById('unit');
const dayCheckboxes = Array.from(document.querySelectorAll('input[name="training-days"]'));
const caloriesStrong = document.querySelector('aside strong');

let customExercises = loadCustomExercises();
let editingId = null;

function formatDay(day) {
    return day.charAt(0).toUpperCase() + day.slice(1);
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

function updateCaloriesBurned() {
    if (!caloriesStrong) return;
    // Approximate estimate: 50 kcal per custom exercise + 50 kcal per weight increment
    const total = customExercises.reduce((sum, ex) => {
        const weightFactor = Number(ex.weight) || 0;
        return sum + 50 + Math.round(weightFactor * 2);
    }, 200);
    caloriesStrong.textContent = `~${total}`;
}

function resetFormState() {
    editingId = null;
    exerciseForm?.reset();
    const submitBtn = exerciseForm?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Save Exercise';
}

function populateFormForEdit(exercise) {
    editingId = exercise.id;
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
        deleteBtn.addEventListener('click', () => {
            customExercises = customExercises.filter((item) => item.id !== exercise.id);
            if (editingId === exercise.id) {
                resetFormState();
            }
            saveCustomExercises();
            renderCustomExercises();
        });

        actionsTd.append(editBtn, deleteBtn);
        tr.append(nameTd, daysTd, weightTd, unitTd, actionsTd);
        customTableBody.appendChild(tr);
    });

    updateCaloriesBurned();
}

// Schedule toggle buttons
btnRecommended?.addEventListener('click', () => setScheduleView('recommended'));
btnCustom?.addEventListener('click', () => setScheduleView('custom'));

// Form submission (Add or Update)
exerciseForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    const name = nameInput?.value.trim() || '';
    const weight = parseFloat(weightInput?.value ?? '0');
    const unit = unitSelect?.value || 'kg';
    const selectedDays = dayCheckboxes.filter((cb) => cb.checked).map((cb) => cb.value);

    if (!name || Number.isNaN(weight) || weight < 0) return;

    const daysToSave = selectedDays.length > 0 ? selectedDays : ['sunday'];

    if (editingId) {
        customExercises = customExercises.map((item) =>
            item.id === editingId
                ? { ...item, name, days: daysToSave, weight, unit }
                : item
        );
    } else {
        customExercises.push({
            id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
            name,
            days: daysToSave,
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
    const submitBtn = exerciseForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Save Exercise';
});

// Initial render
renderCustomExercises();
setScheduleView('recommended');