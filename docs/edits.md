# Edits: backend integration and frontend fixes

## 1. Frontend: API endpoints added or updated

| File | Change |
|---|---|
| `main.js`, `Forms.js`, `home.js`, `profile.js`, `reports.js` | API paths moved to the subfolders (for example `../../../Backend/Registration/[login.php]`). The brackets stay until each PHP file is finished. |
| `diet.js` | **New**: `DIET_API`, `DIET_MODE_API`, `MEAL_ADD_API`, `MEAL_EDIT_API`, `MEAL_DELETE_API`, the contract comment, loading meals and targets, sending add/edit/delete/mode with the meal `id`. |
| `exercises.js` | **New**: `EXERCISES_API`, `EXERCISE_MODE_API`, `EXERCISE_ADD_API`, `EXERCISE_EDIT_API`, `EXERCISE_DELETE_API`, `STEPS_API`, the contract comment, loading both tables, burned calories, and steps, and sending the forms. |

While the backend isn't ready, both pages keep working the same way as before (demo rows, and `localStorage` for custom exercises).

## 2. Frontend: serious problems fixed

1. **`exercises.html` checkboxes** were all named `training-days`, so PHP would receive only the last checked day. They're now `training-days[]` (and the selector in `exercises.js` changed too).
2. **Steps had no input**, but the SRS says steps are entered on the exercises page, and Reports needs them. Added a "Today's Steps" form to `exercises.html`.
3. **Empty training days**: `exercises.js` quietly saved `sunday` when no day was checked. Now it shows "Choose at least one training day." (the SRS requires the days).
4. **Burned calories** in `exercises.js` used `200 + 50 + weight × 2` per exercise. Now it's `50 × today's exercises + steps × 0.04`, the same as the SRS and the backend.
5. **Meals had no id** (they were found by their row number), so edit and delete couldn't tell the backend which meal it was. Now the meal `id` from the backend is sent.
6. **Reports "Custom Period"** sent no dates, so the backend could only answer with an error. Added From/To date inputs (shown only for the custom period) and they are sent as `from` and `to`.
7. **Error messages**: added a red message line under the meal, exercise, and steps forms (`diet.html`, `exercises.html`, plus small CSS) to show `data.message` from the backend.

Tested in the browser with no backend: diet add/totals, exercise add/day check, steps → burned calories, and the custom date inputs all work, with no new console errors.

## 3. Shared backend functions in `main.js`

Every page had its own copy of the same request code (`sendForm`, `sendToBackend`, `fetchHomeData`, `fetchProfileData`, ...). They are now two shared functions in `main.js`:

| Function | What it does |
|---|---|
| `getFromBackend(api)` | GET. Returns the JSON, or `null` on 401 (and goes to the login page). Throws an error when the backend isn't ready, so each page keeps its demo data. |
| `sendToBackend(api, formData, messageElement, { redirectOn401 })` | POST. Returns `true`/`false`, and shows the backend's `message` inside `messageElement`. `redirectOn401: false` is used by login and register, where 401 means "wrong email or password". |

Where they are used (each place is marked with a red `//!` comment, for example `//! sendToBackend() is in main.js`):

| File | Uses | Removed from the file |
|---|---|---|
| `Forms.js` | `sendToBackend` (with `redirectOn401: false`) | the request code inside `sendForm` |
| `home.js` | `getFromBackend` | `fetchHomeData()`, `LOGIN_PAGE` |
| `profile.js` | `getFromBackend`, `sendToBackend` (×3) | `fetchProfileData()`, `sendForm()`, `LOGIN_PAGE` |
| `reports.js` | `getFromBackend` | the fetch code inside `fetchReportData()`, `LOGIN_PAGE` |
| `diet.js` | `getFromBackend`, `sendToBackend` (×3) | its own `sendToBackend()`, `LOGIN_PAGE` |
| `exercises.js` | `getFromBackend`, `sendToBackend` (×4) | its own `sendToBackend()`, `LOGIN_PAGE` |

The logout request in `main.js` stays as it was (it has no message to show).

Because every 401 now sends the user to the login page, `Backend.md` §4 says to **use 401 only for "not logged in"**. A wrong password in `change_password.php` or `delete_account.php` must be `400`.

Tested in the browser: every page loads with no errors. Login with no backend shows "Could not reach the server". With a fake backend on the diet page, the data loads, a 400 shows its message under the form, and a 401 goes to the login page.

## 4. Reports status card

The SRS requires a "current status" card on the reports page (weight, height, BMI, SMM, PBF, BFM). It was missing, so it was added:

| File | Change |
|---|---|
| `reports.html` | New "Current Status" section at the top of `<main>`, with 6 small cards (ids `statusWeight`, `statusHeight`, `statusBmi`, `statusSmm`, `statusPbf`, `statusBfm`). SMM, PBF, and BFM have a `*` and a note: "Estimated from your BMI, age, and gender (not measured)". |
| `reports.css` | Styles for the card: 6 columns on big screens, 3 on tablets, 2 on phones. It uses the same theme colors as the charts, so dark mode works. |
| `reports.js` | New `renderStatus(data.status)`, called in `loadReport()`. Any missing value shows `--`. |

The values stay `--` until `reports.php` is ready. Tested in the browser with fake data, in light mode, dark mode, and at phone width (no horizontal scroll).

## 5. SRS update (`docs/SRS - FT (No IDs).docx`)

The SRS now follows the updated project. The design and the writing style are the same (every new paragraph is a copy of an existing one).

| Part | Change |
|---|---|
| **Backend** | **Folders:** what each folder does (Registration, Home, Profile, Reports, Diet, Exercises, includes, config). **Database tables:** the 8 tables. **Rules:** JSON answers, 401 goes to the sign-in form, hashed passwords and prepared statements, each user sees only his own data. |
| **System architecture** | The empty `Backend (PHP) { }` now lists the folders, and the database list matches the real tables (Meals, Recommended Meals, Recommended Exercises, Daily Activity). |
| **Frontend pages** | Match what was built: the setup profile is inside the register form, logout and footer are popups, the navbar has the dark mode button, reports has the custom period, recommended exercises are view-only, the steps form is on the exercises page, and the meal form includes calories. The exercises day filter sentence was removed, because the page doesn't have it. |
| **Notes** | Use XAMPP to test the backend (Live Server can't run PHP), remove the brackets from the JS paths when a PHP file is finished, and ask Reda before changing `FT.SQL` or `includes`. |
