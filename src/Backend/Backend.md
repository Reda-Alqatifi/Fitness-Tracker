# Backend Plan (PHP & MySQL)

This is the design for the backend of the Fitness Tracker. It is based on:

- the SRS (`docs/SRS - FT.docx`)
- the API contracts written at the top of every page's JS file (`Forms.js`, `home.js`, `profile.js`, `reports.js`, `diet.js`, `exercises.js`, `main.js`). **These comments are the contract.** If the backend and the comment disagree, fix one of them so they match.

Contents:

1. [What the backend is responsible for](#1-what-the-backend-is-responsible-for)
2. [How to run it (important)](#2-how-to-run-it-important)
3. [Folder structure](#3-folder-structure)
4. [General rules for every endpoint](#4-general-rules-for-every-endpoint)
5. [Database design](#5-database-design)
6. [Calculations (BMI, PBF, calories ...)](#6-calculations)
7. [Endpoints, page by page](#7-endpoints-page-by-page)
8. [Code skeletons](#8-code-skeletons)
9. [Security checklist](#9-security-checklist)
10. [Frontend status](#10-frontend-status)
11. [Suggested tasks (T11 – T18)](#11-suggested-tasks-t11--t18)
12. [Who does what (team split)](#12-who-does-what-team-split)
13. [Full code for every backend file](#13-full-code-for-every-backend-file)

---

## 1. What the backend is responsible for

| Area | What the backend does |
|---|---|
| **Accounts** | Register, log in (with "remember me"), log out, change password, delete account |
| **Sessions** | Know who the logged-in user is on every request, and return `401` when no one is logged in |
| **Profile** | Store and update body data (birthdate, gender, height, weight, target weight, goal, activity level) |
| **Weight history** | Save a record every time the weight changes, for the weight chart in Reports |
| **Calculations** | BMI, PBF, BFM, SMM, daily calorie target, macro targets, calories burned |
| **Diet** | Recommended or custom diet, add, edit, and delete meals, targets for the day |
| **Exercises** | Recommended or custom schedule, add, edit, and delete custom exercises, weights in kg/lb, training days, steps |
| **Reports** | Combine the data into daily series (weight, consumed, burned, steps) for a week, month, year, or custom range |
| **Validation and privacy** | Validate every input, and make sure each user can only read and change their own rows |

Things that **don't need the backend**:

- **Dark mode**: already handled in the frontend.
- **PDF export**: already done in the frontend with `window.print()` (the "Export to PDF" button in Reports).

---

## 2. How to run it (important)

**VS Code Live Server can't run PHP.** For the frontend and backend to work together they have to be served by the **same PHP server** (same origin), so the session cookie gets sent with each request.

Pick one:

- **XAMPP** (recommended for the course): put the project in `htdocs/`, start Apache and MySQL, and open
  `http://localhost/<project-folder>/src/Frontend/index.html`
- **PHP built-in server** (MySQL still has to be running):
  ```bash
  php -S localhost:8000 -t src
  # open http://localhost:8000/Frontend/index.html
  ```

Every page calls its endpoints with `../../../Backend/<Folder>/[file.php]` from `Frontend/Pages/<page>/`, which resolves to `src/Backend/<Folder>/file.php`. The brackets mean "not ready yet". **When you finish an endpoint, remove the brackets** in the JS constant:

```js
const LOGIN_API = "../../../Backend/Registration/[login.php]";  // before
const LOGIN_API = "../../../Backend/Registration/login.php";    // after
```

While the brackets are there, the request fails with 404 and the page keeps working with its demo data. So every page can be tested before its backend exists.

Import the database with phpMyAdmin (Import → `src/Database/FT.SQL`) or:

```bash
mysql -u root < src/Database/FT.SQL
```

---

## 3. Folder structure

One PHP file per action, grouped in one folder per page. Shared code goes in `includes/`.

```
src/Backend/
    |
    |---- index.php                     -> redirect to the welcome page
    |---- Backend.md                    -> this file
    |
    |---- config/
    |       |---- config.example.php    -> DB host/name/user/password template (committed)
    |       |---- config.php            -> real values (in .gitignore, never committed)
    |
    |---- includes/
    |       |---- db.php                -> mysqli connection ($conn)
    |       |---- response.php          -> json_response(), json_error(), require_method()
    |       |---- auth.php              -> start_session(), require_login()
    |       |---- validate.php          -> helpers to read and validate $_POST / $_GET
    |       |---- fitness.php           -> all formulas (BMI, PBF, BMR, TDEE, macros, burned calories)
    |
    |---- Registration/
    |       |---- register.php          POST
    |       |---- login.php             POST
    |       |---- logout.php            POST
    |
    |---- Home/
    |       |---- home.php              GET
    |
    |---- Profile/
    |       |---- profile.php           GET
    |       |---- edit_profile.php      POST
    |       |---- change_password.php   POST
    |       |---- delete_account.php    POST
    |
    |---- Reports/
    |       |---- reports.php           GET
    |
    |---- Diet/
    |       |---- diet.php              GET
    |       |---- diet_mode.php         POST
    |       |---- meal_add.php          POST
    |       |---- meal_edit.php         POST
    |       |---- meal_delete.php       POST
    |
    |---- Exercises/
            |---- exercises.php         GET
            |---- exercise_mode.php     POST
            |---- exercise_add.php      POST
            |---- exercise_edit.php     POST
            |---- exercise_delete.php   POST
            |---- steps.php             POST
```

Because the endpoints are one folder deep, **every endpoint includes the shared files with `/../`**:

```php
require __DIR__ . '/../includes/response.php';
```

The SQL file stays where it is: `src/Database/FT.SQL` (schema and seed data from [section 5](#5-database-design)).

---

## 4. General rules for every endpoint

These rules match what the frontend already expects:

1. **Responses are always JSON**, with `Content-Type: application/json; charset=utf-8`.
2. **Success** returns HTTP `200` with the data, or `{ "message": "..." }` for actions.
3. **Failure** returns a non-200 status with `{ "message": "Human readable reason" }`. The frontend shows `data.message` under the form.

   | Status | When |
   |---|---|
   | `400` | Missing or invalid input (wrong email format, height out of range ...) |
   | `401` | Not logged in or the session expired. **Every protected page redirects to login on 401** (`sendToBackend()` and `getFromBackend()` in `main.js` do it), so always return it for protected endpoints. **Use 401 only for this** (and for a wrong email/password in `login.php`). A wrong password in `change_password.php` or `delete_account.php` is `400`, otherwise the user would be sent to the login page instead of seeing the message. |
   | `404` | The meal or exercise doesn't exist (or belongs to another user) |
   | `405` | Wrong method (GET on a POST endpoint) |
   | `409` | The email is already registered |
   | `500` | Database error (log the real error, send a generic message) |

4. **Inputs come as form data**, so read them with `$_POST` (the frontend sends `FormData`). GET endpoints use `$_GET`.
5. **Each protected endpoint starts with `require_login()`**. It returns the user id from the session or sends `401`.
6. **Never trust a `user_id` sent by the client.** Always use the one in the session.
7. **Every query uses mysqli prepared statements** (`mysqli_prepare` + `mysqli_stmt_bind_param`). Never build SQL by joining strings.
8. **Each row that belongs to a user is checked with `WHERE id = ? AND user_id = ?`.** This covers the SRS "Data Privacy" requirement.
9. **Store numbers in metric** (kg, cm). Convert lb → kg on input (`kg = lb × 0.45359237`).
10. **Dates** go over the API as `YYYY-MM-DD` strings. Set the timezone once: `date_default_timezone_set('Asia/Riyadh');`.
11. **Day names** are the full lowercase English names, `sunday` … `saturday` (the values of the checkboxes in `exercises.html`). Today's name in PHP is `strtolower(date('l'))`.

---

## 5. Database design

The SRS architecture lists: *Users, Profiles, Weight History, Diets, Foods, Exercises, Exercise History*. The design below follows the same idea.

### 5.1 Overview (ER)

```
users 1───1 profiles
  │
  ├──< weight_history          (one row per day the weight changes)
  ├──< meals                   (the "Foods" of the SRS, each with a date)
  ├──< exercises               (the user's custom schedule)
  └──< daily_activity          (the "Exercise History": steps and number of exercises per day)

recommended_meals              (catalog, copied into meals for the day when the diet is "recommended")
recommended_exercises          (catalog, shown as-is in the recommended table, read-only)
```

All user tables use `ON DELETE CASCADE`, so **deleting a user deletes all their data** automatically (SRS: Account Deletion and Database Integrity).

### 5.2 Tables

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Login account | `id`, `name`, `email` (unique), `password_hash`, `created_at` |
| `profiles` | Body data and settings (1:1 with users) | `birthdate`, `gender`, `height_cm`, `weight_kg`, `target_weight_kg`, `goal`, `activity`, `diet_mode`, `exercise_mode`, `steps_goal`, `recommended_meals_on` |
| `weight_history` | Weight over time (Reports weight chart) | `user_id`, `weight_kg`, `recorded_on` (unique per user per day) |
| `meals` | Meals of the user on a date (both tables of the diet page) | `user_id`, `name`, `protein_g`, `carbs_g`, `fats_g`, `calories`, `meal_date`, `source` |
| `recommended_meals` | Catalog of ready meals | `name`, macros, `calories`, `goal` |
| `exercises` | The user's custom exercises (the "Custom Exercises" table) | `user_id`, `name`, `sets`, `reps`, `weight_kg`, `unit`, `training_days` (SET) |
| `recommended_exercises` | The "Recommended Exercises" table (read-only) | `name`, `sets`, `reps`, `weight_kg`, `training_days` |
| `daily_activity` | One row per user per day: steps and number of exercises | `user_id`, `activity_date`, `steps`, `exercises_count` |

Why some of these choices:

- **Age isn't stored.** It's calculated from `birthdate`, so it's always correct.
- **BMI, PBF, BFM, and SMM aren't stored.** They're calculated from weight, height, age, and gender each time (see [section 6](#6-calculations)), so they can't get out of sync.
- **Meals have a `meal_date` and a `source`.** The date lets Reports show "consumed per day". `source` decides which table the meal appears in on the diet page (`recommended` or `custom`). The diet page adds **both tables** together for the daily totals.
- **`recommended_meals_on`** remembers the last day the recommended meals were copied for the user, so they are copied once per day only (and a meal the user deleted doesn't come back on reload).
- **Recommended exercises are not copied.** The page shows them read-only. The user's own exercises are in `exercises`.
- **`daily_activity.exercises_count`** is the "Exercise History". The SRS calculates burned calories from the *count* of exercises, so the backend saves today's count every day the user uses the site. Past days keep their count, so changing the schedule today doesn't change last month's report.
- **`training_days` uses MySQL's `SET` type**, so one column holds several days, for example `'sunday,tuesday,thursday'`. Filter with `FIND_IN_SET('monday', training_days)`.

### 5.3 SQL (put this in `src/Database/FT.SQL`)

```sql
-- =========================================================
--  Fitness Tracker - database schema (MySQL 8 / MariaDB 10.4+)
-- =========================================================

CREATE DATABASE IF NOT EXISTS fitness_tracker
    CHARACTER SET utf8mb4            -- full Unicode (the recommended default)
    COLLATE utf8mb4_unicode_ci;

USE fitness_tracker;

-- ---------- users ----------
CREATE TABLE users (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(50)  NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,                 -- from password_hash()
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- profiles (1:1 with users) ----------
CREATE TABLE profiles (
    user_id               INT UNSIGNED PRIMARY KEY,
    birthdate             DATE NOT NULL,
    gender                ENUM('male','female') NOT NULL,
    height_cm             DECIMAL(5,1) NOT NULL,           -- 50 .. 250
    weight_kg             DECIMAL(5,1) NOT NULL,           -- 20 .. 300
    target_weight_kg      DECIMAL(5,1) NULL,
    goal                  ENUM('lose','gain','maintain') NOT NULL,
    activity              ENUM('sedentary','light','moderate','very') NOT NULL,
    diet_mode             ENUM('recommended','custom') NOT NULL DEFAULT 'recommended',
    exercise_mode         ENUM('recommended','custom') NOT NULL DEFAULT 'recommended',
    steps_goal            INT UNSIGNED NOT NULL DEFAULT 10000,
    recommended_meals_on  DATE NULL,                       -- last day the recommended meals were copied
    updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- weight history ----------
CREATE TABLE weight_history (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      INT UNSIGNED NOT NULL,
    weight_kg    DECIMAL(5,1) NOT NULL,
    recorded_on  DATE NOT NULL,
    UNIQUE KEY uq_weight_day (user_id, recorded_on),      -- one value per day (last edit wins)
    CONSTRAINT fk_weight_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- recommended meals (catalog) ----------
CREATE TABLE recommended_meals (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    protein_g   DECIMAL(6,1) NOT NULL,
    carbs_g     DECIMAL(6,1) NOT NULL,
    fats_g      DECIMAL(6,1) NOT NULL,
    calories    INT UNSIGNED NOT NULL,
    goal        ENUM('lose','gain','maintain') NULL        -- NULL = fits any goal
) ENGINE=InnoDB;

-- ---------- meals (both tables of the diet page) ----------
CREATE TABLE meals (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    name        VARCHAR(100) NOT NULL,
    protein_g   DECIMAL(6,1) NOT NULL DEFAULT 0,
    carbs_g     DECIMAL(6,1) NOT NULL DEFAULT 0,
    fats_g      DECIMAL(6,1) NOT NULL DEFAULT 0,
    calories    INT UNSIGNED NOT NULL DEFAULT 0,
    meal_date   DATE NOT NULL,
    source      ENUM('recommended','custom') NOT NULL DEFAULT 'custom',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_meals_user_date (user_id, meal_date),
    CONSTRAINT fk_meals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- recommended exercises (catalog, read-only) ----------
CREATE TABLE recommended_exercises (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    sets           TINYINT UNSIGNED NOT NULL DEFAULT 3,
    reps           TINYINT UNSIGNED NOT NULL DEFAULT 10,
    weight_kg      DECIMAL(5,1) NOT NULL DEFAULT 0,          -- "the least weight"
    training_days  SET('sunday','monday','tuesday','wednesday','thursday','friday','saturday') NOT NULL
) ENGINE=InnoDB;

-- ---------- exercises (the user's custom schedule) ----------
CREATE TABLE exercises (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id        INT UNSIGNED NOT NULL,
    name           VARCHAR(100) NOT NULL,
    sets           TINYINT UNSIGNED NOT NULL DEFAULT 3,      -- no input on the page yet, default used
    reps           TINYINT UNSIGNED NOT NULL DEFAULT 10,     -- no input on the page yet, default used
    weight_kg      DECIMAL(5,1) NOT NULL DEFAULT 0,          -- always stored in kg
    unit           ENUM('kg','lb') NOT NULL DEFAULT 'kg',     -- how the user prefers to see it
    training_days  SET('sunday','monday','tuesday','wednesday','thursday','friday','saturday') NOT NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ex_user (user_id),
    CONSTRAINT fk_ex_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- exercise history (steps and number of exercises per day) ----------
CREATE TABLE daily_activity (
    user_id          INT UNSIGNED NOT NULL,
    activity_date    DATE NOT NULL,
    steps            INT UNSIGNED NOT NULL DEFAULT 0,
    exercises_count  TINYINT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, activity_date),
    CONSTRAINT fk_act_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================================================
--  Seed data (the same items as the demo rows in the HTML)
-- =========================================================
INSERT INTO recommended_meals (name, protein_g, carbs_g, fats_g, calories, goal) VALUES
('Oatmeal with Milk',           15, 50, 10, 350, NULL),
('Grilled Chicken',             40, 30, 12, 400, NULL),
('Greek Yogurt',                20, 15, 5,  185, NULL),
('Tuna Salad',                  30, 10, 12, 270, 'lose'),
('Peanut Butter Sandwich',      14, 45, 18, 400, 'gain');

INSERT INTO recommended_exercises (name, sets, reps, weight_kg, training_days) VALUES
('Bench Press',  3, 10, 20, 'sunday,wednesday'),
('Squat',        3, 10, 30, 'monday,thursday'),
('Deadlift',     3, 8,  40, 'tuesday');
```

---

## 6. Calculations

Put all of these in `includes/fitness.php` so every endpoint uses the same formulas. **Label PBF, BFM, and SMM as "estimated" in the UI.** Real values need a body-composition scale (InBody), and these formulas only estimate them from BMI.

| Value | Formula |
|---|---|
| **Age** | years between `birthdate` and today |
| **BMI** | `weight_kg / (height_m)²`, rounded to 1 decimal |
| **PBF** (body fat %, Deurenberg) | `1.20 × BMI + 0.23 × age − 10.8 × sex − 5.4`, where `sex = 1` for male and `0` for female |
| **BFM** (body fat mass, kg) | `weight_kg × PBF / 100` |
| **SMM** (skeletal muscle mass, kg, rough estimate) | `(weight_kg − BFM) × 0.5` (lean mass ≈ 50% muscle) |
| **BMR** (Mifflin-St Jeor) | male: `10w + 6.25h − 5a + 5`, female: `10w + 6.25h − 5a − 161` |
| **TDEE** | `BMR × factor`: sedentary 1.2, light 1.375, moderate 1.55, very 1.725 |
| **Calorie target** | lose: `TDEE − 500`, maintain: `TDEE`, gain: `TDEE + 300` (never below 1200 for female or 1500 for male) |
| **Protein target** | `1.8 g × weight_kg` (2.0 g when losing weight) |
| **Fats target** | `25% of calorie target / 9` (grams) |
| **Carbohydrates target** | `(calorie target − protein×4 − fats×9) / 4` (grams) |
| **Today's exercises** | the exercises of the **chosen schedule** (`profiles.exercise_mode`) where `FIND_IN_SET(<today>, training_days)`: `recommended_exercises` for `recommended`, the user's `exercises` for `custom` |
| **Burned (one day)** | `exercises_count × 50 + steps × 0.04` (from that day's `daily_activity` row). The SRS says to use the *count*, not the type. Keep `50` and `0.04` as constants (`exercises.js` uses the same numbers when the backend isn't ready). |

```php
// includes/fitness.php (example)
const KCAL_PER_EXERCISE = 50;
const KCAL_PER_STEP     = 0.04;

function age_from(string $birthdate): int {
    return (new DateTime($birthdate))->diff(new DateTime('today'))->y;
}

function bmi(float $kg, float $cm): float {
    $m = $cm / 100;
    return round($kg / ($m * $m), 1);
}

function body_fat_percent(float $bmi, int $age, string $gender): float {
    $sex = $gender === 'male' ? 1 : 0;
    return round(1.20 * $bmi + 0.23 * $age - 10.8 * $sex - 5.4, 1);
}

function calorie_target(array $p): int {
    $age = age_from($p['birthdate']);
    $bmr = 10 * $p['weight_kg'] + 6.25 * $p['height_cm'] - 5 * $age
         + ($p['gender'] === 'male' ? 5 : -161);
    $factor = ['sedentary' => 1.2, 'light' => 1.375, 'moderate' => 1.55, 'very' => 1.725][$p['activity']];
    $tdee = $bmr * $factor;
    $adjust = ['lose' => -500, 'maintain' => 0, 'gain' => 300][$p['goal']];
    $min = $p['gender'] === 'male' ? 1500 : 1200;
    return (int) max($min, round($tdee + $adjust));
}

function burned(int $exercisesCount, int $steps): int {
    return (int) round($exercisesCount * KCAL_PER_EXERCISE + $steps * KCAL_PER_STEP);
}
```

### 6.1 Saving today's exercise count

`fitness.php` also has one function that uses the database:

```
save_today_activity($conn, $userId)
    count = number of today's exercises (see the table above)
    INSERT INTO daily_activity (user_id, activity_date, exercises_count) VALUES (?, today, count)
    ON DUPLICATE KEY UPDATE exercises_count = VALUES(exercises_count)
```

Call it in **`home.php`, `exercises.php`, `exercise_mode.php`, `exercise_add.php`, `exercise_edit.php`, and `exercise_delete.php`**, so today's row is always up to date. Past days are never changed.

---

## 7. Endpoints, page by page

Request fields below use the **exact `name=` attributes** in the HTML forms, and the responses are the ones written at the top of each page's JS file.

### 7.1 Auth: `Registration/` (login and register forms, navbar)

#### `POST Registration/register.php`
- **Fields:** `name`, `email`, `password`, `confirm-password`, `birthdate`, `height`, `weight`, `gender`, `goal`, `activity`
  (the register form already includes the "setup profile" fields, so one request creates everything)
- **Validation:**
  - name 2–50 chars
  - valid email
  - password ≥ 8 chars and equal to the confirmation
  - birthdate between 1926-01-01 and 2016-12-31
  - height 50–250, weight 20–300
  - gender, goal, and activity must be one of the enum values
- **Logic (in one transaction):**
  1. Check the email isn't used (otherwise `409`).
  2. `INSERT users` with `password_hash($password, PASSWORD_DEFAULT)`.
  3. `INSERT profiles` (modes default to `recommended`).
  4. `INSERT weight_history` (the first weight, today).
  5. Log the user in (`session_regenerate_id(true)`, `$_SESSION['user_id'] = ...`).
- **Response:** `200 { "message": "Account created" }` → the frontend goes to home.

#### `POST Registration/login.php`
- **Fields:** `email`, `password`, `remember` (`"yes"` when checked)
- **Logic:**
  1. Find the user by email.
  2. Check with `password_verify()`.
  3. If it fails, return `401 { "message": "Wrong email or password" }`. Use the same message for "email not found", so attackers can't learn which emails exist.
  4. On success, call `session_regenerate_id(true)` and set `$_SESSION['user_id']`.
  5. If `remember === "yes"`, make the session cookie last 30 days (see the skeleton in [section 8](#8-code-skeletons)).

#### `POST Registration/logout.php`
- **Logic:** `$_SESSION = []`, delete the session cookie, then `session_destroy()`.
- **Response:** `200`.

### 7.2 Home page: `Home/`

#### `GET Home/home.php`
Defined in `home.js`:
```json
{
  "name": "Flan",
  "weight": 78,
  "bmi": 24.1,
  "pbf": 18,
  "smm": 34,
  "exercises": [ { "name": "Bench Press", "sets": 3, "reps": 10, "weight": 40 } ],
  "calories": { "consumed": 1650, "goal": 2400, "burned": 420 }
}
```
- `exercises` = **today's exercises of the chosen schedule** ([section 6](#6-calculations)).
- `weight` of each exercise is **in kg** (`home.js` always writes "kg").
- `calories.consumed` = `SUM(calories)` from `meals` for today (both sources).
- `calories.goal` = `calorie_target()`.
- `calories.burned` = `burned()` with today's `daily_activity` row. Call `save_today_activity()` first.

### 7.3 Profile page: `Profile/`

#### `GET Profile/profile.php`
Defined in `profile.js`:
```json
{ "name": "Flan", "gender": "male", "birthdate": "2004-05-17", "age": 22,
  "height": 175, "weight": 78, "targetWeight": 72, "goal": "lose",
  "activity": "moderate", "created": "2026-10-07" }
```

#### `POST Profile/edit_profile.php`
- **Fields:** `name`, `birthdate`, `height`, `weight`, `target-weight` (optional), `gender`, `goal`, `activity`
- **Validation:** the same rules as register, plus the target-weight vs goal rule that `profile.js` already checks:
  - lose → target < weight
  - gain → target > weight
  - maintain → within 2 kg

  **Check it again in PHP.** Frontend checks can be bypassed.
- **Logic:**
  1. `UPDATE users SET name`.
  2. `UPDATE profiles`.
  3. **If the weight changed:** `INSERT INTO weight_history ... ON DUPLICATE KEY UPDATE weight_kg = VALUES(weight_kg)` for today.

#### `POST Profile/change_password.php`
- **Fields:** `old-password`, `new-password`, `confirm-new-password`
- **Logic:**
  1. `password_verify(old)`. If wrong, return `400 { "message": "Wrong password" }`.
  2. Check the new password is ≥ 8 chars and equals the confirmation.
  3. Store `password_hash(new)`.

#### `POST Profile/delete_account.php`
- **Fields:** `email`, `password`, `confirm-password`
- **Logic:**
  1. The email must equal the logged-in user's email.
  2. `password_verify()`. If the email or password is wrong, return `400` (not `401`, see [section 4](#4-general-rules-for-every-endpoint)).
  3. `DELETE FROM users WHERE id = ?`. The cascade removes everything else.
  4. Destroy the session.

### 7.4 Reports page: `Reports/`

#### `GET Reports/reports.php?range=week|month|year` or `?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`
Defined in `reports.js`:
```json
{
  "status": { "weight": 78, "height": 175, "bmi": 25.5, "smm": 30.1, "pbf": 22.4, "bfm": 17.5 },
  "today":  { "consumed": 2000, "burned": 500 },
  "steps":  { "today": 7000, "goal": 10000 },
  "daily": [
    { "date": "2026-11-09", "weight": 82, "consumed": 2100, "burned": 330, "steps": 6200 }
  ]
}
```
How to build `daily`:
1. Work out `from` and `to`:
   - week = last 7 days
   - month = last 30 days
   - year = last 365 days
   - custom = validate both dates, with `from ≤ to`, `to` not in the future, and at most 1 year apart (otherwise `400`)
2. Run **one grouped query per table**, not one query per day:
   - `SELECT meal_date, SUM(calories) FROM meals WHERE user_id=? AND meal_date BETWEEN ? AND ? GROUP BY meal_date`
   - `SELECT activity_date, steps, exercises_count FROM daily_activity WHERE user_id=? AND activity_date BETWEEN ? AND ?`
   - `SELECT recorded_on, weight_kg FROM weight_history WHERE user_id=? AND recorded_on BETWEEN ? AND ?` (also get the last weight **before** `from`, to start the line)
3. Loop over each date from `from` to `to` in PHP and fill the missing days with `0`. `burned` = `burned(exercises_count, steps)`. For **weight**, carry the last known value forward instead of using 0.
4. For `year`, it's a good idea to group by week or month (about 52 or 12 points), so the chart stays readable.

`status` fills the "Current Status" card at the top of the reports page (SRS: weight, height, BMI, SMM, PBF, BFM). Send plain numbers: weight and SMM/BFM in kg, height in cm, PBF in %, rounded to 1 decimal. A missing value shows `--`.

### 7.5 Diet page: `Diet/`

The page has two tables: **Recommended Diet** (`source = 'recommended'`) and **Custom Diet** (`source = 'custom'`). The daily totals are the sum of **both** tables (that's how `diet.js` calculates them). The two buttons only choose which table is shown, and the choice is saved.

#### `GET Diet/diet.php`
Defined in `diet.js`:
```json
{
  "mode": "recommended",
  "targets": { "calories": 2400, "protein": 140, "carbohydrates": 280, "fats": 67 },
  "meals": [
    { "id": 12, "name": "Grilled Chicken", "protein": 40, "carbohydrates": 30,
      "fats": 12, "calories": 400, "source": "recommended" }
  ]
}
```
- **Logic:**
  1. If `diet_mode = 'recommended'` and `recommended_meals_on` isn't today: copy the `recommended_meals` that fit the goal (`goal = ? OR goal IS NULL`) into `meals` for today with `source = 'recommended'`, and set `recommended_meals_on = today`. **Do both in one transaction.** (SRS: "If the user chooses the recommended one, automatically he will get some meals".)
  2. Return today's meals (both sources) and the targets from `fitness.php`.
- The frontend calculates the consumed totals, so they don't need to be sent.

#### `POST Diet/diet_mode.php`
- **Fields:** `mode` = `recommended` | `custom`
- **Logic:** update `profiles.diet_mode`. The frontend loads `diet.php` again right after, so choosing `recommended` adds today's recommended meals (step 1 above).

#### `POST Diet/meal_add.php`
- **Fields** (in `diet.html`): `meal-name`, `protein`, `carbohydrates`, `fats`, `calories`
- **Validation:** name 1–100 chars, all numbers required and ≥ 0 with sensible maximums (for example protein, carbohydrates, fats ≤ 500 g, calories ≤ 5000).
- **Logic:** `INSERT` for today with `source = 'custom'`.

#### `POST Diet/meal_edit.php`
- **Fields:** `id`, plus the same fields as add
- **Logic:** `UPDATE meals SET ... WHERE id = ? AND user_id = ?` (any source, recommended meals can be edited too). If 0 rows match, return `404`.

#### `POST Diet/meal_delete.php`
- **Fields:** `id`
- **Logic:** `DELETE FROM meals WHERE id = ? AND user_id = ?`. If 0 rows match, return `404`.

### 7.6 Exercises page: `Exercises/`

The page has two tables: **Recommended Exercises** (read-only, from `recommended_exercises`) and **Custom Exercises** (the user's `exercises`, with Edit and Delete). The two buttons choose the schedule the user follows, and the choice is saved. Home and the burned calories use the chosen schedule.

#### `GET Exercises/exercises.php`
Defined in `exercises.js`:
```json
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
```
- `days` = `explode(',', $row['training_days'])`.
- Custom `weight` is shown **in the unit the user chose**: if `unit = 'lb'`, send `round(weight_kg / 0.45359237, 1)`.
- `burned` and `steps` are for today. Call `save_today_activity()` first.

#### `POST Exercises/exercise_mode.php`
- **Fields:** `mode` = `recommended` | `custom`
- **Logic:** update `profiles.exercise_mode`, then `save_today_activity()` (today's count depends on the schedule).

#### `POST Exercises/exercise_add.php`
- **Fields** (in `exercises.html`): `exercise-name`, `training-days[]`, `weight`, `unit`
- **Validation:**
  - name 1–100 chars
  - at least 1 day, and every day in `sunday..saturday` (otherwise `400 { "message": "Choose at least one training day" }`)
  - weight 0–500
  - unit `kg`|`lb`
- **Logic:**
  1. Convert lb → kg before saving.
  2. Store the days as `implode(',', $days)` (that's the format the `SET` column takes).
  3. `save_today_activity()`.

#### `POST Exercises/exercise_edit.php`
- **Fields:** `id`, plus the same fields as add (the SRS requires being able to edit the weight)
- **Logic:** update with `WHERE id = ? AND user_id = ?` (`404` if 0 rows match), then `save_today_activity()`.

#### `POST Exercises/exercise_delete.php`
- **Fields:** `id`
- **Logic:** delete with `WHERE id = ? AND user_id = ?` (`404` if 0 rows match), then `save_today_activity()`. Past days keep their count in `daily_activity`, so the reports history isn't lost.

#### `POST Exercises/steps.php`
- **Fields:** `steps` (0–100000)
- **Logic:** `INSERT INTO daily_activity (user_id, activity_date, steps) VALUES (?, today, ?) ON DUPLICATE KEY UPDATE steps = VALUES(steps)`
- **Where:** the "Today's Steps" form on the exercises page (SRS: steps are "entered by the user into exercises page").

---

## 8. Code skeletons

These show the patterns. Every endpoint follows the same shape.

They use **procedural mysqli**, the same style as the course (`mysqli_connect(...)`).

> `json_response()` and `json_error()` use the `never` return type, which needs **PHP 8.1 or newer**. Check with `php -v`. On older PHP, use `void`.

### `config/config.example.php`
```php
<?php
$server   = "localhost";
$user     = "root";
$password = "";               // XAMPP default is empty
$database = "fitness_tracker";
```
Each member copies it to `config/config.php` and puts their own values there.

### `includes/db.php`
```php
<?php
require __DIR__ . '/../config/config.php';

// turn mysqli errors into exceptions, so they can be caught with try/catch
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

try {
    $conn = mysqli_connect($server, $user, $password, $database);
    mysqli_set_charset($conn, "utf8mb4");
} catch (mysqli_sql_exception $e) {
    error_log($e->getMessage());
    json_error('Could not connect to the database', 500);
}
```

Each endpoint requires `response.php` **before** `db.php`, because `db.php` uses `json_error()`.

**How a prepared statement works in mysqli:**

```php
$stmt = mysqli_prepare($conn, "SELECT ... WHERE id = ? AND user_id = ?");
mysqli_stmt_bind_param($stmt, "ii", $id, $userId);   // one letter per ?
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);              // only for SELECT
$row    = mysqli_fetch_assoc($result);                // one row (or null)
// or: $rows = mysqli_fetch_all($result, MYSQLI_ASSOC);  // all rows
```

The type letters are `i` = integer, `d` = decimal (double), `s` = string. Dates are sent as strings (`s`).

**Transactions** (register, copying the recommended meals):

```php
mysqli_begin_transaction($conn);
try {
    // ... several INSERTs ...
    mysqli_commit($conn);
} catch (mysqli_sql_exception $e) {
    mysqli_rollback($conn);
    error_log($e->getMessage());
    json_error('Server error, please try again later', 500);
}
```

### `includes/response.php`
```php
<?php
function json_response($data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $message, int $status = 400): never {
    json_response(['message' => $message], $status);
}

function require_method(string $method): void {
    if ($_SERVER['REQUEST_METHOD'] !== $method) {
        json_error('Method not allowed', 405);
    }
}
```

### `includes/auth.php`
```php
<?php
const REMEMBER_SECONDS = 60 * 60 * 24 * 30;   // 30 days

function start_session(bool $remember = false): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;

    $lifetime = $remember ? REMEMBER_SECONDS : 0;   // 0 = until the browser closes
    ini_set('session.gc_maxlifetime', (string) REMEMBER_SECONDS);
    session_set_cookie_params([
        'lifetime' => $lifetime,
        'path'     => '/',
        'httponly' => true,      // JS can't read the cookie
        'samesite' => 'Lax',     // basic CSRF protection
    ]);
    session_start();
}

function require_login(): int {
    start_session();
    if (empty($_SESSION['user_id'])) {
        json_error('Not logged in', 401);
    }
    return (int) $_SESSION['user_id'];
}
```
Note: `gc_maxlifetime` applies to every session, so sessions without "remember me" also stay valid on the server for 30 days (the cookie still ends when the browser closes). That's fine for this project.

### `Registration/login.php` (an example endpoint)
```php
<?php
require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';

require_method('POST');

$email    = trim($_POST['email'] ?? '');
$password = $_POST['password'] ?? '';
$remember = ($_POST['remember'] ?? '') === 'yes';

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
    json_error('Please enter a valid email and password');
}

try {
    $stmt = mysqli_prepare($conn, "SELECT id, password_hash FROM users WHERE email = ?");
    mysqli_stmt_bind_param($stmt, "s", $email);
    mysqli_stmt_execute($stmt);
    $user = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));
} catch (mysqli_sql_exception $e) {
    error_log($e->getMessage());
    json_error('Server error, please try again later', 500);
}

if (!$user || !password_verify($password, $user['password_hash'])) {
    json_error('Wrong email or password', 401);
}

start_session($remember);
session_regenerate_id(true);           // prevents session fixation
$_SESSION['user_id'] = (int) $user['id'];

json_response(['message' => 'Logged in']);
```

### A protected endpoint (pattern, `Diet/meal_delete.php`)
```php
<?php
require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';

require_method('POST');
$userId = require_login();

$id = filter_var($_POST['id'] ?? null, FILTER_VALIDATE_INT);
if (!$id) json_error('Invalid meal');

$stmt = mysqli_prepare($conn, "DELETE FROM meals WHERE id = ? AND user_id = ?");
mysqli_stmt_bind_param($stmt, "ii", $id, $userId);
mysqli_stmt_execute($stmt);

if (mysqli_stmt_affected_rows($stmt) === 0) json_error('Meal not found', 404);

json_response(['message' => 'Meal deleted']);
```

---

## 9. Security checklist

Mapped to the SRS non-functional requirements:

- [ ] **Passwords**: `password_hash()` / `password_verify()` only, never stored as plain text or MD5 (*Security*)
- [ ] **SQL injection**: every query is a prepared statement (*Security, Integrity*)
- [ ] **Ownership**: every query on user data has `AND user_id = ?` using the session id (*Data Privacy*)
- [ ] **Validation**: every input is checked in PHP for type, range, and allowed enum values, even if the HTML already checks it (*Input Validation*)
- [ ] **Session**: `session_regenerate_id(true)` after login, plus `httponly` and `SameSite=Lax` cookies
- [ ] **Errors**: log the real exceptions with `error_log`, and send only friendly messages to the user (*Error Handling*)
- [ ] **XSS**: the frontend uses `textContent` for API data (good). Keep it that way and never put API data into `innerHTML`.
- [ ] **Transactions**: register and copying the recommended meals write several rows, so wrap them in `mysqli_begin_transaction()` / `mysqli_commit()` (*Integrity*)
- [ ] **Foreign keys** with `ON DELETE CASCADE` (*Integrity, Account Deletion*)
- [ ] **Config**: `config/config.php` with the DB password is in `.gitignore`
- [ ] **Performance**: indexes on `(user_id, date)` columns, and grouped queries in reports instead of loops (*Performance < 3 s*)

---

## 10. Frontend status

### 10.1 Already done (ready for the backend)

- Every page has its API constants with the new folder paths, and the contract written at the top of its JS.
- All the requests go through two shared functions in `main.js`: `getFromBackend(api)` (GET) and `sendToBackend(api, formData, messageElement)` (POST). Every place that uses them is marked with a `//!` comment.
- `diet.js` and `exercises.js` load from and send to the backend. Until the backend is ready they keep working in the browser only (demo data in the HTML, and `localStorage` for custom exercises).
- `exercises.html`: the checkboxes are named `training-days[]`, and the "Today's Steps" form exists.
- `reports.html`: the "Custom Period" option shows From/To date inputs and sends `from` and `to`.
- `reports.html`: the "Current Status" card (weight, height, BMI, SMM, PBF, BFM) is filled from `status`, and SMM, PBF, and BFM are marked as estimated.
- Every form shows `data.message` from the backend when it fails.

### 10.2 Still missing (frontend work, not blocking the backend)

1. **Exercises day filter** (SRS: "filtering by the current day or a day specified by the user"). The page shows all exercises. If you add it, filter in the frontend with the `days` array, no backend change is needed.
2. **Sets and reps** have no inputs on the exercises page, so custom exercises use the defaults (3 × 10) on the home page.
3. **Remove the brackets** from each API constant when its PHP file is finished ([section 2](#2-how-to-run-it-important)).
4. **Test through the PHP server** (XAMPP or `php -S`), not Live Server.

---

## 11. Suggested tasks (T11 – T18)

These fit the empty backend rows in the SRS task table, in dependency order:

| No | Task | Depends on | Output |
|---|---|---|---|
| T11 | Database schema and seed data | - | `src/Database/FT.SQL` |
| T12 | Core includes (db, response, auth/session, validation, fitness formulas) and config | T11 | `includes/*`, `config/*` |
| T13 | Auth: register, login (remember me), logout | T12 | `Registration/*` |
| T14 | Profile: get, edit (and weight history), change password, delete account | T13 | `Profile/*` |
| T15 | Home dashboard data | T14 | `Home/home.php` |
| T16 | Diet: get, mode, add, edit, and delete meals | T13 | `Diet/*` |
| T17 | Exercises: get, mode, add, edit, delete, and steps | T13 | `Exercises/*` |
| T18 | Reports and full integration testing (all pages talking to the backend) | T14–T17 | `Reports/reports.php`, bug fixes |

After T13 is done, T16 and T17 can be worked on **at the same time** by different members, since they don't touch the same files.

---

## 12. Who does what (team split)

**Each member builds the backend of the pages they built in the frontend.** They already know those pages' forms and JS. Reda also builds the shared parts (the database and `includes/`), because everyone else depends on them.

### 12.1 Overview

| Member | Backend files | Tables they query | Tasks |
|---|---|---|---|
| **Reda** | `FT.SQL`, `config/*`, `includes/db.php`, `response.php`, `auth.php`, `validate.php`, `index.php`, `Home/home.php` | all (creates them), reads in `home.php` | T11, T12, T15 |
| **Mohammed** | `Registration/register.php`, `login.php`, `logout.php`, `Profile/profile.php`, `edit_profile.php`, `change_password.php`, `delete_account.php` | `users`, `profiles`, `weight_history` | T13, T14 |
| **Hassan** | `includes/fitness.php`, `Reports/reports.php` | reads `meals`, `daily_activity`, `weight_history`, `profiles` | T18 (and the formulas in T12) |
| **Redwan** | `Diet/diet.php`, `diet_mode.php`, `meal_add.php`, `meal_edit.php`, `meal_delete.php` | `meals`, `recommended_meals`, `profiles` | T16 |
| **Ahmed** | `Exercises/exercises.php`, `exercise_mode.php`, `exercise_add.php`, `exercise_edit.php`, `exercise_delete.php`, `steps.php` | `exercises`, `recommended_exercises`, `daily_activity`, `profiles` | T17 |

### 12.2 Order of work

```
Phase 1:  Reda      -> FT.SQL + config + includes (db, response, auth, validate)
          Hassan    -> includes/fitness.php (the formulas, plus save_today_activity())
              |
Phase 2:  Mohammed  -> register.php + login.php + logout.php   (everyone needs login to test)
              |
Phase 3 (at the same time):
          Mohammed  -> profile endpoints
          Redwan    -> diet endpoints
          Ahmed     -> exercises endpoints
          Reda      -> home.php
              |
Phase 4:  Hassan    -> reports.php (needs data from diet, exercises, and profile)
          Everyone  -> test their own page end to end, fix bugs
```

**Waiting for login (Phase 2)?** Create a test user in phpMyAdmin and test your endpoint with it. Use a test file like `dev_login.php` that only does `start_session(); $_SESSION['user_id'] = 1;`, and **delete it before the final submission**.

### 12.3 Details per member

#### Reda: database and shared code, plus Home
- [ ] Write `src/Database/FT.SQL` from [section 5.3](#53-sql-put-this-in-srcdatabaseftsql), import it, and check that all tables and seed rows exist.
- [ ] Write `config/config.example.php` (`config/config.php` is already in `.gitignore`).
- [ ] Write `includes/response.php`, `includes/db.php`, and `includes/auth.php` (see [section 8](#8-code-skeletons)).
- [ ] Write `includes/validate.php` with small helpers everyone uses, for example `post_int()`, `post_float()`, `post_enum()`, `post_date()`, `post_days()` (for `training-days[]`).
- [ ] Write `index.php` (redirect to the welcome page).
- [ ] Write `Home/home.php` ([section 7.2](#72-home-page-home)) and remove the brackets from `HOME_API` in `home.js`.
- [ ] Remove the brackets from `LOGOUT_API` in `main.js` once Mohammed's `logout.php` exists.
- [ ] **Owns `FT.SQL`:** if anyone needs a new column or table, they ask Reda, so the schema stays in one place.
- [ ] Review the pull requests to `main`.

#### Mohammed: accounts and profile
- [ ] `Registration/register.php`: validation, then one transaction that inserts into `users`, `profiles`, and `weight_history`, then logs the user in ([section 7.1](#71-auth-registration-login-and-register-forms-navbar)).
- [ ] `Registration/login.php` (with "remember me") and `Registration/logout.php`.
- [ ] `Profile/profile.php`: return the profile, with `age` calculated from `birthdate` ([section 7.3](#73-profile-page-profile)).
- [ ] `Profile/edit_profile.php`: check the target weight against the goal again in PHP, and save today's weight in `weight_history` when it changes.
- [ ] `Profile/change_password.php` and `Profile/delete_account.php` (the delete relies on `ON DELETE CASCADE`).
- [ ] In `Forms.js` and `profile.js`, remove the brackets from the API constants.

#### Hassan: formulas and Reports
- [ ] `includes/fitness.php`: age, BMI, PBF, BFM, SMM, BMR, TDEE, calorie target, macro targets, `burned()`, and `save_today_activity()` ([section 6](#6-calculations)). **Do this in Phase 1**, because Home, Diet, and Exercises use it.
- [ ] `Reports/reports.php`: the `week`, `month`, `year`, and `custom` ranges, one grouped query per table, filling missing days (weight carries forward), plus the `status` object ([section 7.4](#74-reports-page-reports)).
- [ ] In `reports.js`: remove the brackets from `REPORTS_API` (the status card is already there, it only needs the `status` object).

#### Redwan: Diet
- [ ] `Diet/diet.php`: copy today's recommended meals once per day (in a transaction), then return the meals and the targets from `fitness.php` ([section 7.5](#75-diet-page-diet)).
- [ ] `Diet/diet_mode.php`: save the mode.
- [ ] `Diet/meal_add.php`, `Diet/meal_edit.php`, and `Diet/meal_delete.php`, always with `AND user_id = ?`.
- [ ] In `diet.js`, remove the brackets from the API constants.

#### Ahmed: Exercises and steps
- [ ] `Exercises/exercises.php`: both lists, today's `burned` and `steps` ([section 7.6](#76-exercises-page-exercises)).
- [ ] `Exercises/exercise_mode.php`: save the mode.
- [ ] `Exercises/exercise_add.php`, `exercise_edit.php`, and `exercise_delete.php` (convert lb → kg before saving).
- [ ] `Exercises/steps.php` (the "Today's Steps" form).
- [ ] In `exercises.js`, remove the brackets from the API constants.

### 12.4 Rules for everyone
- Work in **your own branch** and open a pull request when you finish, as described in the SRS notes.
- **Don't edit someone else's files.** If you need a change in `includes/` or `FT.SQL`, ask the owner.
- Follow [section 4](#4-general-rules-for-every-endpoint) and the patterns in [section 8](#8-code-skeletons), so every file looks the same.
- Before opening your pull request, test your page through XAMPP with a real logged-in user, including the error cases (wrong input, not logged in).

---

## 13. Full code for every backend file

This section is the actual code of every backend file, ready to copy into the project. It follows the plan above, so each endpoint answers in the exact shape that the comment at the top of its frontend JS file describes. (The `.php` files themselves are not created yet. Copy each block into the path in its title.)

**Helper names.** The code uses longer, descriptive names instead of the short ones in the section 8 skeletons:

| Section 8 skeleton | Name used here | File |
|---|---|---|
| `json_response()` | `send_json_response($responseData, $httpStatusCode = 200)` | `includes/response.php` |
| `json_error()` | `send_json_error($errorMessage, $httpStatusCode = 400)` | `includes/response.php` |
| `require_method()` | `require_request_method('POST')` | `includes/response.php` |
| `start_session()` | `start_user_session($rememberUser = false)` | `includes/auth.php` |
| `require_login()` | `require_logged_in_user()` (returns the user id) | `includes/auth.php` |

New helpers are `log_in_user()`, `log_out_user()` and `handle_server_error()`. The database connection is the global `$databaseConnection` (opened by `includes/db.php`).

**Include guards.** Every file in `includes/` starts with `if (defined('..._LOADED')) { return; }`, so including it twice is harmless. Each endpoint requires the files it needs with `require __DIR__ . '/../includes/response.php';` and so on. `db.php`, `auth.php`, `validate.php` and `fitness.php` also load `response.php` themselves.

**Number casting rule.** MySQL (mysqli) gives every number back as text, for example `"70.5"` or `"3"`. The frontend does math with these values (for example `diet.js` adds the meal macros with `+=`, and `home.js` and `reports.js` pass numbers to the charts), so a text value would be joined like a string (`"1" + "2"` is `"12"`). That is why **every number is cast before it goes into the JSON**: ids, steps and calories with `(int)`, and `DECIMAL` columns, `SUM()` results and calculated values with `(float)` or `(int)`.

**Where this code intentionally differs from the plan**

- **Helper names** are longer and clearer (see the table above), and `require_request_method()` also sends the `Allow` header with the 405.
- **`response.php` hides PHP errors and catches everything.** It calls `ini_set('display_errors', '0')` and registers `set_exception_handler('handle_server_error')`, so a mistake never prints an HTML error page into the JSON. The `never` return type needs PHP 8.1 or newer (check the version of your XAMPP).
- **Emails are trimmed and lowercased** inside `read_post_email()`, so `Ali@Mail.com` and `ali@mail.com` are the same account (login, register and delete account all rely on it). Name lengths are counted with `mb_strlen`, and every `read_*` helper rejects an array value (for example `name[]=x`) with `is_string`.
- **Registration** returns `409` for an email that exists, both from the early `SELECT` and from MySQL error `1062` (two people registering at the same moment). The three inserts run in one transaction.
- **Wrong credentials are `400`, not `401`** in `change_password.php` and `delete_account.php` (the frontend redirects to the login page on `401`). `delete_account.php` also checks that `password` equals `confirm-password`, compares the email without case, and clears the session and its cookie.
- **Body formulas.** The calorie target and the macro targets are whole numbers. Carbohydrates are never below `0`. The body fat percentage (PBF) is calculated from the unrounded BMI and kept between `3` and `60`, so a very low BMI cannot give a negative percentage. `calculate_body_numbers()` is an extra helper that `home.php` and `reports.php` share.
- **`FT.SQL`** stores `weight_kg` of `exercises` and `recommended_exercises` as `DECIMAL(8,4)` (not `(5,1)`), so a weight typed in pounds converts to kg and back without drifting. The API rounds to 1 decimal only when it sends the number. Importing the file twice is safe, but `CREATE TABLE IF NOT EXISTS` does not change a table that already exists, so drop the old `fitness_tracker` database first when you change a column type.
- **Today's exercise count.** `home.php`, `reports.php`, `exercises.php`, `exercise_mode.php`, `exercise_add.php`, `exercise_edit.php`, `exercise_delete.php` and `steps.php` call `save_today_activity()`, so `daily_activity` always has today's row. `steps.php` saves the steps first, then the count.
- **Reports ranges.** `week` is today minus 6 days up to today. `month` is the current calendar month, from the 1st to today (the SRS says "each day of the current month"), not "the last 30 days". `year` returns one row per day for the last 365 days (the plan only suggests grouping by week or month, and `reports.js` already draws a daily array). `custom` is `from` to `to`, at most 365 days, and not in the future. An invalid custom range returns `400`, but `reports.js` shows nothing on a failed GET (it only logs it), so that error is silent in the page. `reports.js` should validate the range itself.
- **Report weights.** `daily[].weight` carries the last known weight forward and is `null` before the user's first weight record (the chart leaves a gap instead of drawing a false `0`). `today` and `steps` are always for the real today, even if the chosen period does not include today.
- **Profile.** `profile.php` sends `created` as `YYYY-MM-DD` and `targetWeight` as `null` when it is not set. `edit_profile.php` stores an empty `target-weight` as `NULL`, checks the target against the goal again on the server, and runs the `users`, `profiles` and `weight_history` changes in one transaction.
- **Recommended meals** are copied once per day with the `profiles.recommended_meals_on` column. The copy and the date update run in one transaction after `SELECT ... FOR UPDATE` on the profile row, so two page loads at the same time cannot copy the meals twice.
- **`meal_add.php` does not change the saved diet mode.** After an add, `diet.js` (lines 488-490) switches the page to the custom view without calling `diet_mode.php`. We keep that: the new meal is saved as `source = 'custom'`, so it shows in the custom table after a reload, and the mode that was saved is used again on the next visit.
- **Edit endpoints (`meal_edit.php`, `exercise_edit.php`) decide `404` with a `SELECT ... WHERE id = ? AND user_id = ?` first**, never with the `UPDATE`'s `affected_rows`, which is also `0` when nothing changed.
- **Recommended exercises** are always sent with `unit` `"kg"`, and `days` is always an array (an empty `SET` gives `[]`).
- **`VALUES()` in `ON DUPLICATE KEY UPDATE`** is deprecated since MySQL 8.0.20, but it still works there, and MariaDB (XAMPP) needs it. Each use has a comment about it.
- **`logout.php` does not open the database**, because logging out only needs the session. If `load_user_profile()` finds no user for the session, it clears the session and sends `401`.
- **Time zone.** "Today" is decided by PHP in `APP_TIMEZONE` (from `config.php`, default `Asia/Riyadh`), and `db.php` sets the same offset in MySQL.
- **Passwords** are limited to 72 bytes (the limit of bcrypt), and the code never trims them.

The code was checked by reading only: PHP is not installed on the machine where it was written, so `php -l` has not been run yet. Run `php -l file.php` (XAMPP has it in `C:\xampp\php`) on every file before the first test.

### 13.1 `src/Database/FT.SQL`

Full corrected schema and seed data. It is safe to import twice, and every table is explicitly utf8mb4.

```sql
-- =========================================================
--  Fitness Tracker - database schema (MySQL 8 / MariaDB 10.4+)
--  Import with:  mysql -u root < src/Database/FT.SQL
--  Safe to import more than once: tables are only created if
--  they do not exist, and the two catalog tables are re-seeded.
-- =========================================================

CREATE DATABASE IF NOT EXISTS fitness_tracker
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE fitness_tracker;

-- Make sure this import itself talks to MySQL in full Unicode
SET NAMES utf8mb4;

-- ---------- users ----------
CREATE TABLE IF NOT EXISTS users (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(50)  NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,              -- UNIQUE = no two accounts with one email
    password_hash   VARCHAR(255) NOT NULL,                     -- from password_hash()
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- profiles (1:1 with users) ----------
CREATE TABLE IF NOT EXISTS profiles (
    user_id               INT UNSIGNED PRIMARY KEY,            -- same id as the user (1:1)
    birthdate             DATE NOT NULL,
    gender                ENUM('male','female') NOT NULL,
    height_cm             DECIMAL(5,1) NOT NULL,               -- 50 .. 250
    weight_kg             DECIMAL(5,1) NOT NULL,               -- 20 .. 300
    target_weight_kg      DECIMAL(5,1) NULL,
    goal                  ENUM('lose','gain','maintain') NOT NULL,
    activity              ENUM('sedentary','light','moderate','very') NOT NULL,
    diet_mode             ENUM('recommended','custom') NOT NULL DEFAULT 'recommended',
    exercise_mode         ENUM('recommended','custom') NOT NULL DEFAULT 'recommended',
    steps_goal            INT UNSIGNED NOT NULL DEFAULT 10000,
    recommended_meals_on  DATE NULL,                           -- last day the recommended meals were copied
    updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- weight history ----------
CREATE TABLE IF NOT EXISTS weight_history (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      INT UNSIGNED NOT NULL,
    weight_kg    DECIMAL(5,1) NOT NULL,
    recorded_on  DATE NOT NULL,
    -- one value per user per day. This UNIQUE key is what makes
    -- "INSERT ... ON DUPLICATE KEY UPDATE" work (last edit of the day wins)
    UNIQUE KEY uq_weight_day (user_id, recorded_on),
    CONSTRAINT fk_weight_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- recommended meals (catalog) ----------
CREATE TABLE IF NOT EXISTS recommended_meals (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    protein_g   DECIMAL(6,1) NOT NULL,
    carbs_g     DECIMAL(6,1) NOT NULL,
    fats_g      DECIMAL(6,1) NOT NULL,
    calories    INT UNSIGNED NOT NULL,
    goal        ENUM('lose','gain','maintain') NULL            -- NULL = fits any goal
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- meals (both tables of the diet page) ----------
CREATE TABLE IF NOT EXISTS meals (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    name        VARCHAR(100) NOT NULL,
    protein_g   DECIMAL(6,1) NOT NULL DEFAULT 0,
    carbs_g     DECIMAL(6,1) NOT NULL DEFAULT 0,
    fats_g      DECIMAL(6,1) NOT NULL DEFAULT 0,
    calories    INT UNSIGNED NOT NULL DEFAULT 0,
    meal_date   DATE NOT NULL,
    source      ENUM('recommended','custom') NOT NULL DEFAULT 'custom',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_meals_user_date (user_id, meal_date),            -- fast "meals of this user on this day"
    CONSTRAINT fk_meals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- recommended exercises (catalog, read-only) ----------
CREATE TABLE IF NOT EXISTS recommended_exercises (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    sets           TINYINT UNSIGNED NOT NULL DEFAULT 3,
    reps           TINYINT UNSIGNED NOT NULL DEFAULT 10,
    weight_kg      DECIMAL(8,4) NOT NULL DEFAULT 0,            -- "the least weight" (4 decimals, same as exercises)
    training_days  SET('sunday','monday','tuesday','wednesday','thursday','friday','saturday') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- exercises (the user's custom schedule) ----------
CREATE TABLE IF NOT EXISTS exercises (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id        INT UNSIGNED NOT NULL,
    name           VARCHAR(100) NOT NULL,
    sets           TINYINT UNSIGNED NOT NULL DEFAULT 3,        -- no input on the page yet, default used
    reps           TINYINT UNSIGNED NOT NULL DEFAULT 10,       -- no input on the page yet, default used
    -- always stored in kg. 4 decimals, so a weight typed in lb (for example 10 lb = 4.5359 kg)
    -- converts back to 10.0 lb. The API rounds it to 1 decimal only when it SENDS the number.
    weight_kg      DECIMAL(8,4) NOT NULL DEFAULT 0,
    unit           ENUM('kg','lb') NOT NULL DEFAULT 'kg',      -- how the user prefers to see it
    training_days  SET('sunday','monday','tuesday','wednesday','thursday','friday','saturday') NOT NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ex_user (user_id),
    CONSTRAINT fk_ex_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- exercise history (steps and number of exercises per day) ----------
CREATE TABLE IF NOT EXISTS daily_activity (
    user_id          INT UNSIGNED NOT NULL,
    activity_date    DATE NOT NULL,
    steps            INT UNSIGNED NOT NULL DEFAULT 0,
    exercises_count  TINYINT UNSIGNED NOT NULL DEFAULT 0,
    -- the PRIMARY KEY (user + day) is what makes
    -- "INSERT ... ON DUPLICATE KEY UPDATE" work: one row per user per day
    PRIMARY KEY (user_id, activity_date),
    CONSTRAINT fk_act_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
--  Seed data (the same items as the demo rows in the HTML)
--  The catalog tables are emptied first so importing this
--  file twice does not create duplicate rows. Nothing points
--  at these two tables with a foreign key, so this is safe.
-- =========================================================
DELETE FROM recommended_meals;
DELETE FROM recommended_exercises;

INSERT INTO recommended_meals (name, protein_g, carbs_g, fats_g, calories, goal) VALUES
('Oatmeal with Milk',           15, 50, 10, 350, NULL),
('Grilled Chicken',             40, 30, 12, 400, NULL),
('Greek Yogurt',                20, 15, 5,  185, NULL),
('Tuna Salad',                  30, 10, 12, 270, 'lose'),
('Peanut Butter Sandwich',      14, 45, 18, 400, 'gain');

INSERT INTO recommended_exercises (name, sets, reps, weight_kg, training_days) VALUES
('Bench Press',  3, 10, 20, 'sunday,wednesday'),
('Squat',        3, 10, 30, 'monday,thursday'),
('Deadlift',     3, 8,  40, 'tuesday');
```

### 13.2 `src/Backend/config/config.example.php`

Template for each member's own config.php (which stays out of git).

```php
<?php
// Copy this file to config/config.php and put your own values there.
// config/config.php is in .gitignore, so your password is never committed.

define('DB_HOST', 'localhost');
define('DB_NAME', 'fitness_tracker');
define('DB_USER', 'root');
define('DB_PASSWORD', '');            // XAMPP default is an empty password

// All dates ("today") are decided by PHP in this timezone.
define('APP_TIMEZONE', 'Asia/Riyadh');
```

### 13.3 `src/Backend/includes/db.php`

Loads the config, sets the timezone, and opens the global `$databaseConnection`.

```php
<?php
// Opens the database connection and puts it in the global variable $databaseConnection.
// Include it at the top level of an endpoint (not inside a function):
//     require __DIR__ . '/../includes/db.php';
if (defined('DB_HELPERS_LOADED')) {
    return;
}
define('DB_HELPERS_LOADED', true);

// db.php needs send_json_error(), so load response.php first (only once).
require_once __DIR__ . '/response.php';

// Step 1: the real config file must exist (each member copies config.example.php to config.php).
$configurationFilePath = __DIR__ . '/../config/config.php';
if (!file_exists($configurationFilePath)) {
    error_log('Missing config/config.php. Copy config.example.php to config.php.');
    send_json_error('Server is not configured', 500);
}
require_once $configurationFilePath;

// Step 2: make sure the config file defined everything we need.
if (!defined('DB_HOST') || !defined('DB_NAME') || !defined('DB_USER') || !defined('DB_PASSWORD')) {
    error_log('config/config.php is missing DB_HOST, DB_NAME, DB_USER or DB_PASSWORD.');
    send_json_error('Server is not configured', 500);
}

// Step 3: set the timezone once. "Today" in PHP now means today in this timezone.
$applicationTimezone = 'Asia/Riyadh';
if (defined('APP_TIMEZONE')) {
    $applicationTimezone = APP_TIMEZONE;
}
date_default_timezone_set($applicationTimezone);

// Step 4: turn mysqli errors into exceptions, so we can catch them with try/catch.
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// Step 5: connect.
try {
    $databaseConnection = mysqli_connect(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);

    // Full Unicode support (names, emoji, Arabic ...).
    mysqli_set_charset($databaseConnection, 'utf8mb4');

    // Make MySQL use the same clock offset as PHP (for example "+03:00"),
    // so MySQL functions like CURDATE() and NOW() agree with PHP's date().
    // The offset text comes from PHP itself (never from the user), so it is safe to put in the query.
    $phpTimezoneOffset = date('P');
    mysqli_query($databaseConnection, "SET time_zone = '" . $phpTimezoneOffset . "'");
} catch (Throwable $connectionException) {
    error_log('Database connection failed: ' . $connectionException->getMessage());
    send_json_error('Could not connect to the database', 500);
}
```

### 13.4 `src/Backend/includes/response.php`

JSON response helpers used by every endpoint.

```php
<?php
// Helpers that send JSON back to the browser.
// Safe to include more than once (the guard below stops a second load).
if (defined('RESPONSE_HELPERS_LOADED')) {
    return;
}
define('RESPONSE_HELPERS_LOADED', true);

// Never print PHP errors or warnings into the page: they would break the JSON.
// (They are still written to the PHP error log.)
ini_set('display_errors', '0');

// Send any data as JSON and stop the script.
// The return type "never" needs PHP 8.1 or newer (XAMPP with PHP 8.1+).
function send_json_response($responseData, int $httpStatusCode = 200): never
{
    http_response_code($httpStatusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($responseData, JSON_UNESCAPED_UNICODE);
    exit;
}

// Send { "message": "..." } with an error status code and stop the script.
// ("never" again needs PHP 8.1+.)
function send_json_error(string $errorMessage, int $httpStatusCode = 400): never
{
    send_json_response(['message' => $errorMessage], $httpStatusCode);
}

// Stop with 405 when the request uses the wrong method (for example GET on a POST endpoint).
function require_request_method(string $expectedMethod): void
{
    $actualMethod = '';
    if (isset($_SERVER['REQUEST_METHOD'])) {
        $actualMethod = $_SERVER['REQUEST_METHOD'];
    }

    if ($actualMethod !== $expectedMethod) {
        // The Allow header tells the browser which method is accepted.
        header('Allow: ' . $expectedMethod);
        send_json_error('Method not allowed', 405);
    }
}

// Log the real error for the developers, but only show a generic message to the user.
function handle_server_error(Throwable $caughtException): never
{
    error_log(
        $caughtException->getMessage()
        . ' in ' . $caughtException->getFile()
        . ':' . $caughtException->getLine()
    );
    send_json_error('Server error, please try again later', 500);
}

// Safety net: any error that no try/catch caught becomes a JSON 500 (never an HTML error page).
set_exception_handler('handle_server_error');
```

### 13.5 `src/Backend/includes/auth.php`

Session helpers: start, log in, require login, log out.

```php
<?php
// Session helpers: who is logged in, log in, log out.
// Needs response.php (loaded here if the endpoint did not load it).
if (defined('AUTH_HELPERS_LOADED')) {
    return;
}
define('AUTH_HELPERS_LOADED', true);

require_once __DIR__ . '/response.php';

// "Remember me" keeps the login for 30 days.
const REMEMBER_SESSION_SECONDS = 60 * 60 * 24 * 30;

// Start the session with safe cookie settings (does nothing if it is already started).
// Cookie settings only work BEFORE session_start(), so call this before anything else.
function start_user_session(bool $rememberUser = false): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    // 0 means "until the browser is closed".
    $cookieLifetimeInSeconds = 0;
    if ($rememberUser) {
        $cookieLifetimeInSeconds = REMEMBER_SESSION_SECONDS;
    }

    // The server keeps session data for 30 days (applies to all sessions).
    ini_set('session.gc_maxlifetime', (string) REMEMBER_SESSION_SECONDS);
    // Refuse session ids that the server did not create.
    ini_set('session.use_strict_mode', '1');

    session_set_cookie_params([
        'lifetime' => $cookieLifetimeInSeconds,
        'path'     => '/',
        'httponly' => true,    // JavaScript cannot read the cookie
        'samesite' => 'Lax',   // basic protection against CSRF
    ]);
    session_start();
}

// Save the user id in the session after a correct login or registration.
function log_in_user(int $userId, bool $rememberUser): void
{
    start_user_session($rememberUser);

    // New session id after login stops "session fixation" attacks.
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;

    // If the session was already started before this call, its cookie settings
    // could not be changed, so send the long-lived cookie by hand.
    if ($rememberUser) {
        setcookie(session_name(), session_id(), [
            'expires'  => time() + REMEMBER_SESSION_SECONDS,
            'path'     => '/',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
}

// Return the logged-in user id, or stop with 401 { "message": ... }.
function require_logged_in_user(): int
{
    start_user_session();

    if (!isset($_SESSION['user_id'])) {
        send_json_error('Not logged in', 401);
    }

    $userId = (int) $_SESSION['user_id'];
    if ($userId <= 0) {
        send_json_error('Not logged in', 401);
    }

    return $userId;
}

// Forget the user completely: session data, cookie and server-side session.
function log_out_user(): void
{
    start_user_session();

    // 1. Remove the data from the session.
    $_SESSION = [];

    // 2. Tell the browser to delete the session cookie (an expired date does that).
    $cookieSettings = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires'  => time() - 42000,
        'path'     => $cookieSettings['path'],
        'domain'   => $cookieSettings['domain'],
        'secure'   => $cookieSettings['secure'],
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    // 3. Destroy the session on the server.
    session_destroy();
}
```

### 13.6 `src/Backend/includes/validate.php`

Readers that validate `$_POST` / `$_GET` values and answer 400 on bad input.

```php
<?php
// Helpers that read and validate $_POST / $_GET values.
// Every helper stops the script with a 400 JSON message when the value is wrong,
// so the code that calls it can trust the returned value.
if (defined('VALIDATE_HELPERS_LOADED')) {
    return;
}
define('VALIDATE_HELPERS_LOADED', true);

require_once __DIR__ . '/response.php';

// The only day names allowed (same values as the checkboxes in exercises.html).
const ALL_DAY_NAMES = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
];

// ---------- small internal helpers ----------

// Return the trimmed text of a field, or '' when it is missing or not a plain string.
function read_trimmed_text_from_source(array $sourceArray, string $fieldName): string
{
    if (!isset($sourceArray[$fieldName])) {
        return '';
    }
    if (!is_string($sourceArray[$fieldName])) {
        return '';
    }
    return trim($sourceArray[$fieldName]);
}

// Count characters (not bytes), so Arabic or emoji names count correctly.
function count_text_characters(string $text): int
{
    if (function_exists('mb_strlen')) {
        return mb_strlen($text, 'UTF-8');
    }
    return strlen($text);
}

// Turn 70.50 into "70.5" and 100.0 into "100" for friendly messages.
function format_number_for_message(float $number): string
{
    $formattedNumber = number_format($number, 2, '.', '');
    $formattedNumber = rtrim($formattedNumber, '0');
    $formattedNumber = rtrim($formattedNumber, '.');
    return $formattedNumber;
}

// Check that the text is a real number inside the range and return it as a float.
function convert_text_to_number_or_fail(string $numberText, string $fieldLabel, float $minimumValue, float $maximumValue): float
{
    if (!is_numeric($numberText)) {
        send_json_error($fieldLabel . ' must be a number');
    }

    $number = (float) $numberText;
    if (!is_finite($number)) {
        send_json_error($fieldLabel . ' must be a number');
    }

    if ($number < $minimumValue || $number > $maximumValue) {
        send_json_error(
            $fieldLabel . ' must be between '
            . format_number_for_message($minimumValue) . ' and '
            . format_number_for_message($maximumValue)
        );
    }

    return $number;
}

// Check "YYYY-MM-DD" strictly (also rejects 2026-02-31) and return it, or stop with 400.
function check_date_text_or_fail(string $dateText, string $fieldLabel): string
{
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $dateText, $dateParts) !== 1) {
        send_json_error($fieldLabel . ' must be a valid date (YYYY-MM-DD)');
    }

    $year = (int) $dateParts[1];
    $month = (int) $dateParts[2];
    $day = (int) $dateParts[3];

    if (!checkdate($month, $day, $year)) {
        send_json_error($fieldLabel . ' must be a valid date (YYYY-MM-DD)');
    }

    return $dateText;
}

// ---------- POST readers ----------

// Text with a length limit (trimmed).
function read_post_text(string $fieldName, string $fieldLabel, int $minimumLength, int $maximumLength): string
{
    $text = read_trimmed_text_from_source($_POST, $fieldName);
    $textLength = count_text_characters($text);

    if ($textLength < $minimumLength || $textLength > $maximumLength) {
        send_json_error($fieldLabel . ' must be between ' . $minimumLength . ' and ' . $maximumLength . ' characters');
    }

    return $text;
}

// A valid email address (trimmed, lowercase, at most 255 characters like the database column).
// Lowercase means "Ali@Mail.com" and "ali@mail.com" are the same account.
function read_post_email(string $fieldName): string
{
    $emailAddress = read_trimmed_text_from_source($_POST, $fieldName);

    if ($emailAddress === '' || strlen($emailAddress) > 255) {
        send_json_error('Please enter a valid email address');
    }
    if (filter_var($emailAddress, FILTER_VALIDATE_EMAIL) === false) {
        send_json_error('Please enter a valid email address');
    }

    return strtolower($emailAddress);
}

// A password. NOT trimmed, because spaces can be part of a password.
function read_post_password(string $fieldName, int $minimumLength): string
{
    $password = '';
    if (isset($_POST[$fieldName]) && is_string($_POST[$fieldName])) {
        $password = $_POST[$fieldName];
    }

    if (strlen($password) < $minimumLength) {
        send_json_error('Password must be at least ' . $minimumLength . ' characters');
    }
    // password_hash() (bcrypt) only uses the first 72 bytes, so refuse longer passwords.
    if (strlen($password) > 72) {
        send_json_error('Password must be at most 72 characters');
    }

    return $password;
}

// A decimal number inside a range (for example weight 20 to 300).
function read_post_number(string $fieldName, string $fieldLabel, float $minimumValue, float $maximumValue): float
{
    $numberText = read_trimmed_text_from_source($_POST, $fieldName);

    if ($numberText === '') {
        send_json_error($fieldLabel . ' is required');
    }

    return convert_text_to_number_or_fail($numberText, $fieldLabel, $minimumValue, $maximumValue);
}

// A whole number inside a range (for example an id or a step count).
function read_post_integer(string $fieldName, string $fieldLabel, int $minimumValue, int $maximumValue): int
{
    $integerText = read_trimmed_text_from_source($_POST, $fieldName);

    if ($integerText === '') {
        send_json_error($fieldLabel . ' is required');
    }

    $integerValue = filter_var($integerText, FILTER_VALIDATE_INT);
    if ($integerValue === false) {
        send_json_error($fieldLabel . ' must be a whole number');
    }

    if ($integerValue < $minimumValue || $integerValue > $maximumValue) {
        send_json_error($fieldLabel . ' must be between ' . $minimumValue . ' and ' . $maximumValue);
    }

    return $integerValue;
}

// A decimal number that may be left empty. Returns null when missing or empty.
function read_post_optional_number(string $fieldName, string $fieldLabel, float $minimumValue, float $maximumValue): ?float
{
    $numberText = read_trimmed_text_from_source($_POST, $fieldName);

    if ($numberText === '') {
        return null;
    }

    return convert_text_to_number_or_fail($numberText, $fieldLabel, $minimumValue, $maximumValue);
}

// One value out of a fixed list (for example goal: lose, gain, maintain).
function read_post_choice(string $fieldName, string $fieldLabel, array $allowedValues): string
{
    $chosenValue = read_trimmed_text_from_source($_POST, $fieldName);

    if (!in_array($chosenValue, $allowedValues, true)) {
        send_json_error($fieldLabel . ' must be one of: ' . implode(', ', $allowedValues));
    }

    return $chosenValue;
}

// A date "YYYY-MM-DD" between two dates (both included). Dates in this format compare correctly as text.
function read_post_date(string $fieldName, string $fieldLabel, string $earliestDate, string $latestDate): string
{
    $dateText = read_trimmed_text_from_source($_POST, $fieldName);
    $dateText = check_date_text_or_fail($dateText, $fieldLabel);

    if ($dateText < $earliestDate || $dateText > $latestDate) {
        send_json_error($fieldLabel . ' must be between ' . $earliestDate . ' and ' . $latestDate);
    }

    return $dateText;
}

// The list of training days. The HTML field is name="training-days[]", so PHP sees
// $_POST['training-days'] as an array. Pass a singular label such as 'training day',
// so the empty-list message reads "Choose at least one training day".
// Returns the unique valid days in week order (sunday first).
function read_post_day_list(string $fieldName, string $fieldLabel): array
{
    if (!isset($_POST[$fieldName]) || !is_array($_POST[$fieldName])) {
        send_json_error('Choose at least one ' . $fieldLabel);
    }

    $selectedDays = [];
    foreach ($_POST[$fieldName] as $submittedDay) {
        if (!is_string($submittedDay)) {
            send_json_error('Invalid ' . $fieldLabel);
        }

        $cleanDay = strtolower(trim($submittedDay));
        if (!in_array($cleanDay, ALL_DAY_NAMES, true)) {
            send_json_error('Invalid ' . $fieldLabel);
        }

        $selectedDays[$cleanDay] = true;
    }

    // Build the result in week order, which also removes duplicates.
    $orderedDays = [];
    foreach (ALL_DAY_NAMES as $dayName) {
        if (isset($selectedDays[$dayName])) {
            $orderedDays[] = $dayName;
        }
    }

    if (count($orderedDays) === 0) {
        send_json_error('Choose at least one ' . $fieldLabel);
    }

    return $orderedDays;
}

// A checkbox: true when the value is yes, on, 1 or true (the login form sends "yes").
function read_post_checkbox(string $fieldName): bool
{
    $checkboxText = strtolower(read_trimmed_text_from_source($_POST, $fieldName));

    if ($checkboxText === 'yes' || $checkboxText === 'on' || $checkboxText === '1' || $checkboxText === 'true') {
        return true;
    }

    return false;
}

// ---------- GET readers ----------

// One value out of a fixed list, read from the query string (for example ?range=week).
function read_get_choice(string $fieldName, string $fieldLabel, array $allowedValues): string
{
    $chosenValue = read_trimmed_text_from_source($_GET, $fieldName);

    if (!in_array($chosenValue, $allowedValues, true)) {
        send_json_error($fieldLabel . ' must be one of: ' . implode(', ', $allowedValues));
    }

    return $chosenValue;
}

// A date "YYYY-MM-DD" from the query string (the caller checks the range, for example from <= to).
function read_get_date(string $fieldName, string $fieldLabel): string
{
    $dateText = read_trimmed_text_from_source($_GET, $fieldName);

    return check_date_text_or_fail($dateText, $fieldLabel);
}
```

### 13.7 `src/Backend/includes/fitness.php`

All formulas plus the shared profile and daily-activity database helpers.

```php
<?php
// All the formulas and the shared "today" helpers.
// Dates use PHP's timezone, which db.php sets (so load db.php in the endpoint too).
if (defined('FITNESS_HELPERS_LOADED')) {
    return;
}
define('FITNESS_HELPERS_LOADED', true);

require_once __DIR__ . '/response.php';
require_once __DIR__ . '/auth.php';

// Same numbers as exercises.js.
const CALORIES_PER_EXERCISE = 50;
const CALORIES_PER_STEP = 0.04;
const KILOGRAMS_PER_POUND = 0.45359237;

// ---------- dates ----------

// Today as "YYYY-MM-DD".
function get_today_date(): string
{
    return date('Y-m-d');
}

// Today's full lowercase English name: sunday ... saturday.
function get_today_day_name(): string
{
    return strtolower(date('l'));
}

// Whole years between the birthdate and today.
function calculate_age_in_years(string $birthdate): int
{
    $birthdateObject = new DateTime($birthdate);
    $todayObject = new DateTime(get_today_date());
    $difference = $birthdateObject->diff($todayObject);

    return (int) $difference->y;
}

// ---------- body numbers ----------

// BMI = weight / height(m)^2, NOT rounded (used inside the other formulas).
function calculate_raw_body_mass_index(float $weightInKilograms, float $heightInCentimeters): float
{
    $heightInMeters = $heightInCentimeters / 100;

    return $weightInKilograms / ($heightInMeters * $heightInMeters);
}

// BMI rounded to 1 decimal (the number we show).
function calculate_body_mass_index(float $weightInKilograms, float $heightInCentimeters): float
{
    return round(calculate_raw_body_mass_index($weightInKilograms, $heightInCentimeters), 1);
}

// Estimated body fat % (Deurenberg): 1.20*BMI + 0.23*age - 10.8*sex - 5.4 (sex: male 1, female 0).
// Pass the UNROUNDED BMI (calculate_raw_body_mass_index), so rounding does not change the result.
// Plan fix: the result is kept between 3 and 60 so a very low BMI cannot give a negative percentage.
function calculate_body_fat_percentage(float $bodyMassIndex, int $ageInYears, string $gender): float
{
    $sexNumber = 0;
    if ($gender === 'male') {
        $sexNumber = 1;
    }

    $bodyFatPercentage = 1.20 * $bodyMassIndex + 0.23 * $ageInYears - 10.8 * $sexNumber - 5.4;

    if ($bodyFatPercentage < 3.0) {
        $bodyFatPercentage = 3.0;
    }
    if ($bodyFatPercentage > 60.0) {
        $bodyFatPercentage = 60.0;
    }

    return round($bodyFatPercentage, 1);
}

// Body fat mass in kg = weight * PBF / 100.
function calculate_body_fat_mass(float $weightInKilograms, float $bodyFatPercentage): float
{
    return round($weightInKilograms * $bodyFatPercentage / 100, 1);
}

// Rough skeletal muscle mass in kg: about half of the lean mass (weight - fat mass).
function calculate_skeletal_muscle_mass(float $weightInKilograms, float $bodyFatMass): float
{
    return round(($weightInKilograms - $bodyFatMass) * 0.5, 1);
}

// All body numbers of a profile in one call (home.php and reports.php use it).
// Returns floats with 1 decimal: bmi, pbf (body fat %), fat_mass (kg), muscle_mass (kg).
function calculate_body_numbers(array $userProfile): array
{
    $weightInKilograms = (float) $userProfile['weight_kg'];
    $heightInCentimeters = (float) $userProfile['height_cm'];
    $ageInYears = calculate_age_in_years((string) $userProfile['birthdate']);

    $rawBodyMassIndex = calculate_raw_body_mass_index($weightInKilograms, $heightInCentimeters);
    $bodyFatPercentage = calculate_body_fat_percentage($rawBodyMassIndex, $ageInYears, (string) $userProfile['gender']);
    $bodyFatMass = calculate_body_fat_mass($weightInKilograms, $bodyFatPercentage);
    $skeletalMuscleMass = calculate_skeletal_muscle_mass($weightInKilograms, $bodyFatMass);

    return [
        'bmi'         => round($rawBodyMassIndex, 1),
        'pbf'         => $bodyFatPercentage,
        'fat_mass'    => $bodyFatMass,
        'muscle_mass' => $skeletalMuscleMass,
    ];
}

// ---------- calories ----------

// Calories the body burns at rest (Mifflin-St Jeor).
function calculate_basal_metabolic_rate(float $weightInKilograms, float $heightInCentimeters, int $ageInYears, string $gender): float
{
    $baseValue = 10 * $weightInKilograms + 6.25 * $heightInCentimeters - 5 * $ageInYears;

    if ($gender === 'male') {
        return $baseValue + 5;
    }

    return $baseValue - 161;
}

// How much the BMR is multiplied by, depending on how active the user is.
function get_activity_factor(string $activityLevel): float
{
    $activityFactors = [
        'sedentary' => 1.2,
        'light'     => 1.375,
        'moderate'  => 1.55,
        'very'      => 1.725,
    ];

    if (isset($activityFactors[$activityLevel])) {
        return $activityFactors[$activityLevel];
    }

    // Unknown value: use the lowest factor.
    return 1.2;
}

// Daily calorie target (a whole number). $userProfile keys are the database column names:
// birthdate, gender, height_cm, weight_kg, goal, activity.
function calculate_daily_calorie_target(array $userProfile): int
{
    $weightInKilograms = (float) $userProfile['weight_kg'];
    $heightInCentimeters = (float) $userProfile['height_cm'];
    $gender = (string) $userProfile['gender'];
    $ageInYears = calculate_age_in_years((string) $userProfile['birthdate']);

    $basalMetabolicRate = calculate_basal_metabolic_rate($weightInKilograms, $heightInCentimeters, $ageInYears, $gender);
    $totalDailyEnergy = $basalMetabolicRate * get_activity_factor((string) $userProfile['activity']);

    // Lose weight: eat less. Gain weight: eat more.
    $goalAdjustments = [
        'lose'     => -500,
        'maintain' => 0,
        'gain'     => 300,
    ];
    $goalAdjustment = 0;
    if (isset($goalAdjustments[$userProfile['goal']])) {
        $goalAdjustment = $goalAdjustments[$userProfile['goal']];
    }

    // Never go below a safe minimum.
    $minimumCalories = 1200;
    if ($gender === 'male') {
        $minimumCalories = 1500;
    }

    $calorieTarget = (int) round($totalDailyEnergy + $goalAdjustment);
    if ($calorieTarget < $minimumCalories) {
        $calorieTarget = $minimumCalories;
    }

    return $calorieTarget;
}

// Daily macro targets in grams (whole numbers). Keys match diet.js: 'protein', 'carbohydrates', 'fats'.
// 'carbs' is the same number as 'carbohydrates' (a short alias).
// Plan fix: carbohydrates are never negative (a heavy person on a low calorie target
// could otherwise get a negative number).
function calculate_macro_targets(int $dailyCalorieTarget, float $weightInKilograms, string $goal): array
{
    // Protein: 1.8 g per kg, 2.0 g per kg when losing weight.
    $proteinPerKilogram = 1.8;
    if ($goal === 'lose') {
        $proteinPerKilogram = 2.0;
    }
    $proteinGrams = $proteinPerKilogram * $weightInKilograms;

    // Fats: 25% of the calories, and 1 g of fat is 9 calories.
    $fatsGrams = ($dailyCalorieTarget * 0.25) / 9;

    // Carbohydrates: whatever calories are left, and 1 g of carbs is 4 calories.
    $caloriesLeftForCarbs = $dailyCalorieTarget - ($proteinGrams * 4) - ($fatsGrams * 9);
    $carbohydratesGrams = $caloriesLeftForCarbs / 4;
    if ($carbohydratesGrams < 0) {
        $carbohydratesGrams = 0;
    }

    $roundedCarbohydrates = (int) round($carbohydratesGrams);

    return [
        'protein'       => (int) round($proteinGrams),
        'carbohydrates' => $roundedCarbohydrates,
        'carbs'         => $roundedCarbohydrates,
        'fats'          => (int) round($fatsGrams),
    ];
}

// Calories burned in one day = exercises * 50 + steps * 0.04 (SRS: use the count, not the type).
function calculate_calories_burned(int $exercisesCount, int $stepsCount): int
{
    $burnedCalories = $exercisesCount * CALORIES_PER_EXERCISE + $stepsCount * CALORIES_PER_STEP;

    return (int) round($burnedCalories);
}

// ---------- unit conversion ----------

function convert_pounds_to_kilograms(float $weightInPounds): float
{
    return $weightInPounds * KILOGRAMS_PER_POUND;
}

function convert_kilograms_to_pounds(float $weightInKilograms): float
{
    return $weightInKilograms / KILOGRAMS_PER_POUND;
}

// ---------- database helpers ----------

// Load one user (users + profiles). Returned keys: user_id, name, email, created_at,
// birthdate, gender, height_cm, weight_kg, target_weight_kg (float or null), goal, activity,
// diet_mode, exercise_mode, steps_goal, recommended_meals_on.
// If the user no longer exists, the session is cleared and 401 is sent (the page goes to login).
function load_user_profile(mysqli $databaseConnection, int $userId): array
{
    $selectProfileStatement = mysqli_prepare(
        $databaseConnection,
        'SELECT users.id AS user_id, users.name, users.email, users.created_at,
                profiles.birthdate, profiles.gender, profiles.height_cm, profiles.weight_kg,
                profiles.target_weight_kg, profiles.goal, profiles.activity,
                profiles.diet_mode, profiles.exercise_mode, profiles.steps_goal,
                profiles.recommended_meals_on
         FROM users
         INNER JOIN profiles ON profiles.user_id = users.id
         WHERE users.id = ?'
    );
    mysqli_stmt_bind_param($selectProfileStatement, 'i', $userId);
    mysqli_stmt_execute($selectProfileStatement);
    $profileResult = mysqli_stmt_get_result($selectProfileStatement);
    $profileRow = mysqli_fetch_assoc($profileResult);
    mysqli_stmt_close($selectProfileStatement);

    if ($profileRow === null) {
        log_out_user();
        send_json_error('Account not found, please log in again', 401);
    }

    // DECIMAL columns come back as text, so turn them into real numbers.
    $profileRow['user_id'] = (int) $profileRow['user_id'];
    $profileRow['height_cm'] = (float) $profileRow['height_cm'];
    $profileRow['weight_kg'] = (float) $profileRow['weight_kg'];
    $profileRow['steps_goal'] = (int) $profileRow['steps_goal'];
    if ($profileRow['target_weight_kg'] !== null) {
        $profileRow['target_weight_kg'] = (float) $profileRow['target_weight_kg'];
    }

    return $profileRow;
}

// How many exercises are planned for today in the schedule the user chose
// (profiles.exercise_mode): the catalog for 'recommended', the user's own for 'custom'.
function count_today_exercises(mysqli $databaseConnection, int $userId): int
{
    // Step 1: which schedule does the user follow?
    $selectModeStatement = mysqli_prepare($databaseConnection, 'SELECT exercise_mode FROM profiles WHERE user_id = ?');
    mysqli_stmt_bind_param($selectModeStatement, 'i', $userId);
    mysqli_stmt_execute($selectModeStatement);
    $modeRow = mysqli_fetch_assoc(mysqli_stmt_get_result($selectModeStatement));
    mysqli_stmt_close($selectModeStatement);

    if ($modeRow === null) {
        return 0;
    }

    $todayDayName = get_today_day_name();

    // Step 2: count today's exercises in that schedule.
    // FIND_IN_SET looks for today's day name inside the SET column "training_days".
    if ($modeRow['exercise_mode'] === 'custom') {
        $countStatement = mysqli_prepare(
            $databaseConnection,
            'SELECT COUNT(*) AS exercises_total FROM exercises
             WHERE user_id = ? AND FIND_IN_SET(?, training_days) > 0'
        );
        mysqli_stmt_bind_param($countStatement, 'is', $userId, $todayDayName);
    } else {
        $countStatement = mysqli_prepare(
            $databaseConnection,
            'SELECT COUNT(*) AS exercises_total FROM recommended_exercises
             WHERE FIND_IN_SET(?, training_days) > 0'
        );
        mysqli_stmt_bind_param($countStatement, 's', $todayDayName);
    }

    mysqli_stmt_execute($countStatement);
    $countRow = mysqli_fetch_assoc(mysqli_stmt_get_result($countStatement));
    mysqli_stmt_close($countStatement);

    return (int) $countRow['exercises_total'];
}

// Save today's exercise count in daily_activity (one row per user per day).
// If today's row already exists (the steps may be saved), only the count is updated.
function save_today_activity(mysqli $databaseConnection, int $userId): void
{
    $exercisesCount = count_today_exercises($databaseConnection, $userId);
    $todayDate = get_today_date();

    // Note: VALUES() is deprecated since MySQL 8.0.20, but it still works there, and
    // MariaDB (XAMPP) needs it, so we keep it.
    $saveActivityStatement = mysqli_prepare(
        $databaseConnection,
        'INSERT INTO daily_activity (user_id, activity_date, exercises_count)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE exercises_count = VALUES(exercises_count)'
    );
    mysqli_stmt_bind_param($saveActivityStatement, 'isi', $userId, $todayDate, $exercisesCount);
    mysqli_stmt_execute($saveActivityStatement);
    mysqli_stmt_close($saveActivityStatement);
}

// Extra helper: today's steps and exercise count. Returns ['steps' => int, 'exercises_count' => int]
// (both 0 when there is no row for today). Call save_today_activity() first to get a fresh count.
function load_today_activity(mysqli $databaseConnection, int $userId): array
{
    $todayDate = get_today_date();

    $selectActivityStatement = mysqli_prepare(
        $databaseConnection,
        'SELECT steps, exercises_count FROM daily_activity WHERE user_id = ? AND activity_date = ?'
    );
    mysqli_stmt_bind_param($selectActivityStatement, 'is', $userId, $todayDate);
    mysqli_stmt_execute($selectActivityStatement);
    $activityRow = mysqli_fetch_assoc(mysqli_stmt_get_result($selectActivityStatement));
    mysqli_stmt_close($selectActivityStatement);

    if ($activityRow === null) {
        return ['steps' => 0, 'exercises_count' => 0];
    }

    return [
        'steps'           => (int) $activityRow['steps'],
        'exercises_count' => (int) $activityRow['exercises_count'],
    ];
}
```

### 13.8 `src/Backend/index.php`

Redirects to the real welcome page of the frontend.

```php
<?php
// Visiting /src/Backend/ sends the browser to the real welcome page of the frontend.
// The path is relative to this folder: src/Backend/ -> src/Frontend/Pages/welcome/welcome.html
header('Location: ../Frontend/Pages/welcome/welcome.html', true, 302);
exit;
```

### 13.9 `src/Backend/Registration/register.php`

POST. Fields: name, email, password, confirm-password, birthdate, height, weight, gender, goal, activity. Creates users, profiles and the first weight_history row in one transaction, logs the user in, returns 200 {message}; 409 if the email exists.

```php
<?php
// POST Registration/register.php
// Creates the user, the profile and the first weight record, then logs the user in.

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/validate.php';
require __DIR__ . '/../includes/fitness.php';

// Only POST is allowed
require_request_method('POST');

try {
    // Step 1: read and validate every field (each helper sends a 400 on failure)
    $userName = read_post_text('name', 'Name', 2, 50);
    // read_post_email() trims the email and makes it lowercase
    $userEmail = read_post_email('email');
    $userPassword = read_post_password('password', 8);
    $confirmPassword = read_post_password('confirm-password', 1);
    $userBirthdate = read_post_date('birthdate', 'Birthdate', '1926-01-01', '2016-12-31');
    $heightInCentimeters = read_post_number('height', 'Height', 50, 250);
    $weightInKilograms = read_post_number('weight', 'Weight', 20, 300);
    $userGender = read_post_choice('gender', 'Gender', ['male', 'female']);
    $userGoal = read_post_choice('goal', 'Goal', ['lose', 'gain', 'maintain']);
    $userActivity = read_post_choice('activity', 'Activity level', ['sedentary', 'light', 'moderate', 'very']);

    // Step 2: the two passwords must be the same
    if ($userPassword !== $confirmPassword) {
        send_json_error('The two passwords do not match', 400);
    }

    // Step 3: stop early if the email is already registered (409)
    $selectEmailStatement = mysqli_prepare($databaseConnection, 'SELECT id FROM users WHERE email = ?');
    mysqli_stmt_bind_param($selectEmailStatement, 's', $userEmail);
    mysqli_stmt_execute($selectEmailStatement);
    $existingUserResult = mysqli_stmt_get_result($selectEmailStatement);
    $existingUserRow = mysqli_fetch_assoc($existingUserResult);
    mysqli_stmt_close($selectEmailStatement);

    if ($existingUserRow !== null) {
        send_json_error('This email is already registered', 409);
    }

    // Step 4: hash the password (never store the real one)
    $passwordHash = password_hash($userPassword, PASSWORD_DEFAULT);
    $todayDate = get_today_date();

    // Step 5: insert the three rows in ONE transaction (all or nothing)
    mysqli_begin_transaction($databaseConnection);

    try {
        // 5a: the account
        $insertUserStatement = mysqli_prepare(
            $databaseConnection,
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
        );
        mysqli_stmt_bind_param($insertUserStatement, 'sss', $userName, $userEmail, $passwordHash);
        mysqli_stmt_execute($insertUserStatement);
        $newUserId = (int) mysqli_insert_id($databaseConnection);
        mysqli_stmt_close($insertUserStatement);

        // 5b: the profile (diet_mode and exercise_mode use their default: recommended)
        $insertProfileStatement = mysqli_prepare(
            $databaseConnection,
            'INSERT INTO profiles (user_id, birthdate, gender, height_cm, weight_kg, goal, activity)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        mysqli_stmt_bind_param(
            $insertProfileStatement,
            'issddss',
            $newUserId,
            $userBirthdate,
            $userGender,
            $heightInCentimeters,
            $weightInKilograms,
            $userGoal,
            $userActivity
        );
        mysqli_stmt_execute($insertProfileStatement);
        mysqli_stmt_close($insertProfileStatement);

        // 5c: the first weight record (today)
        $insertWeightStatement = mysqli_prepare(
            $databaseConnection,
            'INSERT INTO weight_history (user_id, weight_kg, recorded_on) VALUES (?, ?, ?)'
        );
        mysqli_stmt_bind_param($insertWeightStatement, 'ids', $newUserId, $weightInKilograms, $todayDate);
        mysqli_stmt_execute($insertWeightStatement);
        mysqli_stmt_close($insertWeightStatement);

        // Save everything
        mysqli_commit($databaseConnection);
    } catch (mysqli_sql_exception $insertException) {
        // Something failed: undo every insert
        mysqli_rollback($databaseConnection);

        // 1062 = duplicate entry (two people registered the same email at the same moment)
        if ((int) $insertException->getCode() === 1062) {
            send_json_error('This email is already registered', 409);
        }

        // Anything else is a real server error
        throw $insertException;
    }

    // Step 6: log the new user in (no "remember me" on registration)
    log_in_user($newUserId, false);

    send_json_response(['message' => 'Account created']);
} catch (Throwable $caughtException) {
    handle_server_error($caughtException);
}
```

### 13.10 `src/Backend/Registration/login.php`

POST. Fields: email, password, remember ("yes"). Returns 200 {message}, or 401 "Wrong email or password" (same message for unknown email).

```php
<?php
// POST Registration/login.php
// Checks the email and password, then starts the session (30 days if "remember" is "yes").

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/validate.php';

// Only POST is allowed
require_request_method('POST');

try {
    // Step 1: read the fields (400 if the email is not an email or the password is empty)
    $loginEmail = read_post_email('email');
    $loginPassword = read_post_password('password', 1);

    // The checkbox sends "yes" only when it is checked
    $rememberUser = read_post_checkbox('remember');

    // Step 2: find the user by email
    $selectUserStatement = mysqli_prepare(
        $databaseConnection,
        'SELECT id, password_hash FROM users WHERE email = ?'
    );
    mysqli_stmt_bind_param($selectUserStatement, 's', $loginEmail);
    mysqli_stmt_execute($selectUserStatement);
    $userResult = mysqli_stmt_get_result($selectUserStatement);
    $userRow = mysqli_fetch_assoc($userResult);
    mysqli_stmt_close($selectUserStatement);

    // Step 3: same 401 message for "no such email" and "wrong password",
    // so nobody can find out which emails exist
    if ($userRow === null) {
        send_json_error('Wrong email or password', 401);
    }
    if (!password_verify($loginPassword, $userRow['password_hash'])) {
        send_json_error('Wrong email or password', 401);
    }

    // Step 4: start the session
    log_in_user((int) $userRow['id'], $rememberUser);

    send_json_response(['message' => 'Logged in']);
} catch (Throwable $caughtException) {
    handle_server_error($caughtException);
}
```

### 13.11 `src/Backend/Registration/logout.php`

POST, no fields. Ends the session and returns 200 (main.js only checks that the fetch did not throw).

```php
<?php
// POST Registration/logout.php
// Ends the session. It needs no fields and always answers 200.

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/auth.php';

// Only POST is allowed (logging out does not need the database)
require_request_method('POST');

try {
    // Empty the session data, delete the cookie and destroy the session
    log_out_user();

    send_json_response(['message' => 'Logged out']);
} catch (Throwable $caughtException) {
    handle_server_error($caughtException);
}
```

### 13.12 `src/Backend/Home/home.php`

GET. Returns name, weight, bmi, pbf, smm, today's exercises (weight in kg) and calories {consumed, goal, burned}, exactly the keys home.js reads.

```php
<?php
// GET Home/home.php
// Returns the numbers for the dashboard: body stats, today's exercises and today's calories.

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/fitness.php';

// Only GET is allowed
require_request_method('GET');

// Only logged-in users (401 otherwise). The id always comes from the session.
$loggedInUserId = require_logged_in_user();

try {
    $todayDate = get_today_date();
    $todayDayName = get_today_day_name();

    // Step 1: make sure today's exercise count is saved before we read it
    save_today_activity($databaseConnection, $loggedInUserId);

    // Step 2: the user's data and the calculated body values
    $userProfile = load_user_profile($databaseConnection, $loggedInUserId);

    $weightInKilograms = (float) $userProfile['weight_kg'];
    $bodyNumbers = calculate_body_numbers($userProfile);

    // Step 3: today's exercises from the schedule the user chose
    // (the weight is always sent in kg, because home.js writes "kg")
    if ($userProfile['exercise_mode'] === 'custom') {
        $selectExercisesSql = 'SELECT name, sets, reps, weight_kg FROM exercises
                               WHERE user_id = ? AND FIND_IN_SET(?, training_days) > 0
                               ORDER BY id';
        $selectExercisesStatement = mysqli_prepare($databaseConnection, $selectExercisesSql);
        mysqli_stmt_bind_param($selectExercisesStatement, 'is', $loggedInUserId, $todayDayName);
    } else {
        // The recommended catalog is shared by everyone, so there is no user_id here
        $selectExercisesSql = 'SELECT name, sets, reps, weight_kg FROM recommended_exercises
                               WHERE FIND_IN_SET(?, training_days) > 0
                               ORDER BY id';
        $selectExercisesStatement = mysqli_prepare($databaseConnection, $selectExercisesSql);
        mysqli_stmt_bind_param($selectExercisesStatement, 's', $todayDayName);
    }
    mysqli_stmt_execute($selectExercisesStatement);
    $exercisesResult = mysqli_stmt_get_result($selectExercisesStatement);

    $todayExercises = [];
    while ($exerciseRow = mysqli_fetch_assoc($exercisesResult)) {
        $todayExercises[] = [
            'name' => $exerciseRow['name'],
            'sets' => (int) $exerciseRow['sets'],
            'reps' => (int) $exerciseRow['reps'],
            // the column has 4 decimals, so round to 1 decimal only when sending
            'weight' => round((float) $exerciseRow['weight_kg'], 1),
        ];
    }
    mysqli_stmt_close($selectExercisesStatement);

    // Step 4: calories eaten today (both meal sources together)
    $selectConsumedStatement = mysqli_prepare(
        $databaseConnection,
        'SELECT COALESCE(SUM(calories), 0) AS total_calories FROM meals
         WHERE user_id = ? AND meal_date = ?'
    );
    mysqli_stmt_bind_param($selectConsumedStatement, 'is', $loggedInUserId, $todayDate);
    mysqli_stmt_execute($selectConsumedStatement);
    $consumedResult = mysqli_stmt_get_result($selectConsumedStatement);
    $consumedRow = mysqli_fetch_assoc($consumedResult);
    mysqli_stmt_close($selectConsumedStatement);
    $caloriesConsumed = (int) $consumedRow['total_calories'];

    // Step 5: steps and exercise count of today, to calculate the burned calories
    $todayActivity = load_today_activity($databaseConnection, $loggedInUserId);
    $caloriesBurned = calculate_calories_burned($todayActivity['exercises_count'], $todayActivity['steps']);

    // Step 6: the daily calorie goal
    $dailyCalorieGoal = calculate_daily_calorie_target($userProfile);

    // Step 7: send the answer in the shape home.js expects
    // (every number is cast to int or float, so JSON sends numbers and not text)
    send_json_response([
        'name' => $userProfile['name'],
        'weight' => $weightInKilograms,
        'bmi' => $bodyNumbers['bmi'],
        'pbf' => $bodyNumbers['pbf'],
        'smm' => $bodyNumbers['muscle_mass'],
        'exercises' => $todayExercises,
        'calories' => [
            'consumed' => $caloriesConsumed,
            'goal' => $dailyCalorieGoal,
            'burned' => $caloriesBurned,
        ],
    ]);
} catch (Throwable $caughtException) {
    handle_server_error($caughtException);
}
```

### 13.13 `src/Backend/Profile/profile.php`

GET. Returns name, gender, birthdate, age, height, weight, targetWeight (null when not set), goal, activity, created, as profile.js expects.

```php
<?php
// GET Profile/profile.php
// Returns the logged-in user's information for the profile page.

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/fitness.php';

// Only GET is allowed
require_request_method('GET');

// Only logged-in users (401 otherwise)
$loggedInUserId = require_logged_in_user();

try {
    // Step 1: users + profiles row (DB column names)
    $userProfile = load_user_profile($databaseConnection, $loggedInUserId);

    // Step 2: age is calculated from the birthdate (it is not stored)
    $ageInYears = calculate_age_in_years($userProfile['birthdate']);

    // Step 3: the target weight is optional, so it can be null
    $targetWeightInKilograms = null;
    if ($userProfile['target_weight_kg'] !== null) {
        $targetWeightInKilograms = (float) $userProfile['target_weight_kg'];
    }

    // Step 4: "created_at" is "YYYY-MM-DD HH:MM:SS", the page only needs the date part
    $createdDate = substr($userProfile['created_at'], 0, 10);

    // Step 5: send the answer in the shape profile.js expects
    // (numbers are cast, and targetWeight stays null when it is not set)
    send_json_response([
        'name' => $userProfile['name'],
        'gender' => $userProfile['gender'],
        'birthdate' => $userProfile['birthdate'],
        'age' => $ageInYears,
        'height' => (float) $userProfile['height_cm'],
        'weight' => (float) $userProfile['weight_kg'],
        'targetWeight' => $targetWeightInKilograms,
        'goal' => $userProfile['goal'],
        'activity' => $userProfile['activity'],
        'created' => $createdDate,
    ]);
} catch (Throwable $caughtException) {
    handle_server_error($caughtException);
}
```

### 13.14 `src/Backend/Profile/edit_profile.php`

POST. Fields: name, birthdate, height, weight, target-weight (optional), gender, goal, activity. Re-checks the target weight against the goal, updates users and profiles, and saves today's weight in weight_history when it changed (one transaction).

```php
<?php
// POST Profile/edit_profile.php
// Updates the name and body data. When the weight changes, today's weight history is saved too.

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/validate.php';
require __DIR__ . '/../includes/fitness.php';

// With the "maintain" goal, the target weight can be this far (in kg) from the weight
// (the same number as MAINTAIN_RANGE in profile.js)
const MAINTAIN_RANGE_IN_KILOGRAMS = 2;

// Only POST is allowed
require_request_method('POST');

// Only logged-in users (401 otherwise)
$loggedInUserId = require_logged_in_user();

try {
    // Step 1: read and validate every field (400 on failure)
    $newName = read_post_text('name', 'Name', 2, 50);
    $newBirthdate = read_post_date('birthdate', 'Birthdate', '1926-01-01', '2016-12-31');
    $newHeightInCentimeters = read_post_number('height', 'Height', 50, 250);
    $newWeightInKilograms = read_post_number('weight', 'Weight', 20, 300);
    $newTargetWeight = read_post_optional_number('target-weight', 'Target weight', 20, 300);
    $newGender = read_post_choice('gender', 'Gender', ['male', 'female']);
    $newGoal = read_post_choice('goal', 'Goal', ['lose', 'gain', 'maintain']);
    $newActivity = read_post_choice('activity', 'Activity level', ['sedentary', 'light', 'moderate', 'very']);

    // Step 2: check the target weight against the goal again
    // (the frontend check in profile.js can be bypassed)
    if ($newTargetWeight !== null) {
        if ($newGoal === 'lose' && $newTargetWeight >= $newWeightInKilograms) {
            send_json_error('To lose weight, the target weight must be lower than your weight.', 400);
        }
        if ($newGoal === 'gain' && $newTargetWeight <= $newWeightInKilograms) {
            send_json_error('To gain weight, the target weight must be higher than your weight.', 400);
        }
        if ($newGoal === 'maintain') {
            $differenceInKilograms = abs($newTargetWeight - $newWeightInKilograms);
            if ($differenceInKilograms > MAINTAIN_RANGE_IN_KILOGRAMS) {
                send_json_error(
                    'To maintain weight, the target weight must be within '
                    . MAINTAIN_RANGE_IN_KILOGRAMS . ' kg of your weight.',
                    400
                );
            }
        }
    }

    // (an empty "target-weight" was read as null above, and the UPDATE below stores it as NULL)
    // Step 3: find out if the weight changed (compare with 1 decimal, like the DB column)
    $currentProfile = load_user_profile($databaseConnection, $loggedInUserId);
    $oldWeightRounded = round((float) $currentProfile['weight_kg'], 1);
    $newWeightRounded = round($newWeightInKilograms, 1);
    $weightChanged = false;
    if ($oldWeightRounded !== $newWeightRounded) {
        $weightChanged = true;
    }

    $todayDate = get_today_date();

    // Step 4: save everything in one transaction
    mysqli_begin_transaction($databaseConnection);

    try {
        // 4a: the name is in the users table
        $updateUserStatement = mysqli_prepare($databaseConnection, 'UPDATE users SET name = ? WHERE id = ?');
        mysqli_stmt_bind_param($updateUserStatement, 'si', $newName, $loggedInUserId);
        mysqli_stmt_execute($updateUserStatement);
        mysqli_stmt_close($updateUserStatement);

        // 4b: the body data is in the profiles table
        $updateProfileStatement = mysqli_prepare(
            $databaseConnection,
            'UPDATE profiles
             SET birthdate = ?, gender = ?, height_cm = ?, weight_kg = ?,
                 target_weight_kg = ?, goal = ?, activity = ?
             WHERE user_id = ?'
        );
        mysqli_stmt_bind_param(
            $updateProfileStatement,
            'ssdddssi',
            $newBirthdate,
            $newGender,
            $newHeightInCentimeters,
            $newWeightInKilograms,
            $newTargetWeight,
            $newGoal,
            $newActivity,
            $loggedInUserId
        );
        mysqli_stmt_execute($updateProfileStatement);
        mysqli_stmt_close($updateProfileStatement);

        // 4c: if the weight changed, save it in the history (last edit of the day wins)
        if ($weightChanged) {
            // Note: VALUES() is deprecated since MySQL 8.0.20, but it still works there,
            // and MariaDB (XAMPP) needs it, so we keep it.
            $saveWeightStatement = mysqli_prepare(
                $databaseConnection,
                'INSERT INTO weight_history (user_id, weight_kg, recorded_on) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE weight_kg = VALUES(weight_kg)'
            );
            mysqli_stmt_bind_param($saveWeightStatement, 'ids', $loggedInUserId, $newWeightInKilograms, $todayDate);
            mysqli_stmt_execute($saveWeightStatement);
            mysqli_stmt_close($saveWeightStatement);
        }

        mysqli_commit($databaseConnection);
    } catch (Throwable $saveException) {
        // Undo the partial changes, then report a server error
        mysqli_rollback($databaseConnection);
        throw $saveException;
    }

    send_json_response(['message' => 'Profile updated']);
} catch (Throwable $caughtException) {
    handle_server_error($caughtException);
}
```

### 13.15 `src/Backend/Profile/change_password.php`

POST. Fields: old-password, new-password, confirm-new-password. Wrong old password returns 400 "Wrong password"; success returns 200.

```php
<?php
// POST Profile/change_password.php
// Fields: old-password, new-password, confirm-new-password. A wrong old password is 400 (not 401).

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/validate.php';

// Only POST is allowed
require_request_method('POST');

// Only logged-in users (401 otherwise)
$loggedInUserId = require_logged_in_user();

try {
    // Step 1: read the three fields
    $oldPassword = read_post_password('old-password', 1);
    $newPassword = read_post_password('new-password', 8);
    $confirmNewPassword = read_post_password('confirm-new-password', 1);

    // Step 2: get the stored hash of this user
    $selectHashStatement = mysqli_prepare($databaseConnection, 'SELECT password_hash FROM users WHERE id = ?');
    mysqli_stmt_bind_param($selectHashStatement, 'i', $loggedInUserId);
    mysqli_stmt_execute($selectHashStatement);
    $hashResult = mysqli_stmt_get_result($selectHashStatement);
    $hashRow = mysqli_fetch_assoc($hashResult);
    mysqli_stmt_close($selectHashStatement);

    if ($hashRow === null) {
        // The account no longer exists, so the session is not valid anymore
        send_json_error('Not logged in', 401);
    }

    // Step 3: the old password must be right (400, so the user stays on the page)
    if (!password_verify($oldPassword, $hashRow['password_hash'])) {
        send_json_error('Wrong password', 400);
    }

    // Step 4: the two new passwords must be the same
    if ($newPassword !== $confirmNewPassword) {
        send_json_error('The two new passwords do not match', 400);
    }

    // Step 5: store the hash of the new password
    $newPasswordHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $updatePasswordStatement = mysqli_prepare(
        $databaseConnection,
        'UPDATE users SET password_hash = ? WHERE id = ?'
    );
    mysqli_stmt_bind_param($updatePasswordStatement, 'si', $newPasswordHash, $loggedInUserId);
    mysqli_stmt_execute($updatePasswordStatement);
    mysqli_stmt_close($updatePasswordStatement);

    send_json_response(['message' => 'Password changed']);
} catch (Throwable $caughtException) {
    handle_server_error($caughtException);
}
```

### 13.16 `src/Backend/Profile/delete_account.php`

POST. Fields: email, password, confirm-password. Wrong email or password returns 400; otherwise deletes the user (cascade removes the rest), destroys the session, returns 200.

```php
<?php
// POST Profile/delete_account.php
// Fields: email, password, confirm-password. Wrong email or password is 400 (not 401).

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/validate.php';

// Only POST is allowed
require_request_method('POST');

// Only logged-in users (401 otherwise)
$loggedInUserId = require_logged_in_user();

try {
    // Step 1: read the three fields
    $typedEmail = read_post_email('email');
    $typedPassword = read_post_password('password', 1);
    $typedConfirmPassword = read_post_password('confirm-password', 1);

    if ($typedPassword !== $typedConfirmPassword) {
        send_json_error('The two passwords do not match', 400);
    }

    // Step 2: get the email and the hash of the logged-in user
    $selectUserStatement = mysqli_prepare(
        $databaseConnection,
        'SELECT email, password_hash FROM users WHERE id = ?'
    );
    mysqli_stmt_bind_param($selectUserStatement, 'i', $loggedInUserId);
    mysqli_stmt_execute($selectUserStatement);
    $userResult = mysqli_stmt_get_result($selectUserStatement);
    $userRow = mysqli_fetch_assoc($userResult);
    mysqli_stmt_close($selectUserStatement);

    if ($userRow === null) {
        // The account no longer exists, so the session is not valid anymore
        send_json_error('Not logged in', 401);
    }

    // Step 3: the email must be the logged-in user's email (not case sensitive;
    // read_post_email() already made the typed one lowercase)
    if (strtolower($typedEmail) !== strtolower($userRow['email'])) {
        send_json_error('Wrong email or password', 400);
    }

    // Step 4: the password must be right
    if (!password_verify($typedPassword, $userRow['password_hash'])) {
        send_json_error('Wrong email or password', 400);
    }

    // Step 5: delete the user. ON DELETE CASCADE removes all of his other rows.
    // (One DELETE statement is already all-or-nothing, so no extra transaction is needed.)
    $deleteUserStatement = mysqli_prepare($databaseConnection, 'DELETE FROM users WHERE id = ?');
    mysqli_stmt_bind_param($deleteUserStatement, 'i', $loggedInUserId);
    mysqli_stmt_execute($deleteUserStatement);
    mysqli_stmt_close($deleteUserStatement);

    // Step 6: end the session (clears the session data and the cookie)
    log_out_user();

    send_json_response(['message' => 'Account deleted']);
} catch (Throwable $caughtException) {
    handle_server_error($caughtException);
}
```

### 13.17 `src/Backend/Reports/reports.php`

GET ?range=week|month|year|custom (&from&to for custom). Returns status, today, steps and a daily array with one row for every day (zeros for empty days, weight carried forward, null before the first record).

```php
<?php
// GET Reports/reports.php?range=week|month|year  or  ?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns the status card, today's numbers and one row for EVERY day of the period.
//   week   = the last 7 days (today - 6 days ... today)
//   month  = the current calendar month (the 1st ... today)
//   year   = the last 365 days, one row per day
//   custom = from ... to (both included)
// NOTE: reports.js shows nothing when a GET request fails (it only logs the error),
// so a 400 for a bad custom range is silent in the page. The frontend validates the range too.

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/validate.php';
require __DIR__ . '/../includes/fitness.php';

// A custom period can be at most one year long
const MAXIMUM_PERIOD_IN_DAYS = 365;

// Only GET is allowed
require_request_method('GET');

// Only logged-in users (401 otherwise)
$loggedInUserId = require_logged_in_user();

try {
    // Step 0: save today's exercise count first, so every number below is up to date
    save_today_activity($databaseConnection, $loggedInUserId);

    $todayDate = get_today_date();
    $todayDateObject = new DateTime($todayDate);

    // Step 1: work out the first and last day of the period
    $selectedRange = read_get_choice('range', 'Range', ['week', 'month', 'year', 'custom']);

    $periodEndDate = $todayDate;
    $periodStartObject = new DateTime($todayDate);

    if ($selectedRange === 'week') {
        $periodStartObject->modify('-6 days');
    } elseif ($selectedRange === 'month') {
        // the 1st day of the current month
        $periodStartObject->modify('first day of this month');
    } elseif ($selectedRange === 'year') {
        $periodStartObject->modify('-364 days');
    } else {
        // custom: both dates must be valid
        $customFromDate = read_get_date('from', 'From date');
        $customToDate = read_get_date('to', 'To date');

        $customFromObject = new DateTime($customFromDate);
        $customToObject = new DateTime($customToDate);

        if ($customFromObject > $customToObject) {
            send_json_error('The "from" date must not be after the "to" date', 400);
        }
        if ($customToObject > $todayDateObject) {
            send_json_error('The "to" date cannot be in the future', 400);
        }

        $periodLengthInDays = (int) $customFromObject->diff($customToObject)->days;
        if ($periodLengthInDays > MAXIMUM_PERIOD_IN_DAYS) {
            send_json_error('The period cannot be longer than one year', 400);
        }

        $periodStartObject = $customFromObject;
        $periodEndDate = $customToDate;
    }

    $periodStartDate = $periodStartObject->format('Y-m-d');

    // Step 2: load the profile
    $userProfile = load_user_profile($databaseConnection, $loggedInUserId);

    // Step 3: calories eaten per day (ONE grouped query for the whole period)
    $selectMealsStatement = mysqli_prepare(
        $databaseConnection,
        'SELECT meal_date, SUM(calories) AS total_calories
         FROM meals
         WHERE user_id = ? AND meal_date BETWEEN ? AND ?
         GROUP BY meal_date'
    );
    mysqli_stmt_bind_param($selectMealsStatement, 'iss', $loggedInUserId, $periodStartDate, $periodEndDate);
    mysqli_stmt_execute($selectMealsStatement);
    $mealsResult = mysqli_stmt_get_result($selectMealsStatement);

    // Lookup table: date -> calories
    $consumedByDate = [];
    while ($mealRow = mysqli_fetch_assoc($mealsResult)) {
        $consumedByDate[$mealRow['meal_date']] = (int) $mealRow['total_calories'];
    }
    mysqli_stmt_close($selectMealsStatement);

    // Step 4: steps and exercise count per day
    $selectActivityStatement = mysqli_prepare(
        $databaseConnection,
        'SELECT activity_date, steps, exercises_count
         FROM daily_activity
         WHERE user_id = ? AND activity_date BETWEEN ? AND ?'
    );
    mysqli_stmt_bind_param($selectActivityStatement, 'iss', $loggedInUserId, $periodStartDate, $periodEndDate);
    mysqli_stmt_execute($selectActivityStatement);
    $activityResult = mysqli_stmt_get_result($selectActivityStatement);

    // Lookup tables: date -> steps, date -> exercise count
    $stepsByDate = [];
    $exercisesCountByDate = [];
    while ($activityRow = mysqli_fetch_assoc($activityResult)) {
        $stepsByDate[$activityRow['activity_date']] = (int) $activityRow['steps'];
        $exercisesCountByDate[$activityRow['activity_date']] = (int) $activityRow['exercises_count'];
    }
    mysqli_stmt_close($selectActivityStatement);

    // Step 5: weight records inside the period
    $selectWeightStatement = mysqli_prepare(
        $databaseConnection,
        'SELECT recorded_on, weight_kg
         FROM weight_history
         WHERE user_id = ? AND recorded_on BETWEEN ? AND ?'
    );
    mysqli_stmt_bind_param($selectWeightStatement, 'iss', $loggedInUserId, $periodStartDate, $periodEndDate);
    mysqli_stmt_execute($selectWeightStatement);
    $weightResult = mysqli_stmt_get_result($selectWeightStatement);

    // Lookup table: date -> weight
    $weightByDate = [];
    while ($weightRow = mysqli_fetch_assoc($weightResult)) {
        $weightByDate[$weightRow['recorded_on']] = (float) $weightRow['weight_kg'];
    }
    mysqli_stmt_close($selectWeightStatement);

    // Step 6: the last weight BEFORE the period, to start the weight line
    // (stays null when the user has no earlier record)
    $lastKnownWeight = null;
    $selectEarlierWeightStatement = mysqli_prepare(
        $databaseConnection,
        'SELECT weight_kg
         FROM weight_history
         WHERE user_id = ? AND recorded_on < ?
         ORDER BY recorded_on DESC
         LIMIT 1'
    );
    mysqli_stmt_bind_param($selectEarlierWeightStatement, 'is', $loggedInUserId, $periodStartDate);
    mysqli_stmt_execute($selectEarlierWeightStatement);
    $earlierWeightResult = mysqli_stmt_get_result($selectEarlierWeightStatement);
    $earlierWeightRow = mysqli_fetch_assoc($earlierWeightResult);
    mysqli_stmt_close($selectEarlierWeightStatement);

    if ($earlierWeightRow !== null) {
        $lastKnownWeight = (float) $earlierWeightRow['weight_kg'];
    }

    // Step 7: build one row for every day, from the first day to the last day
    $dailyRows = [];
    $currentDayObject = new DateTime($periodStartDate);
    $lastDayObject = new DateTime($periodEndDate);

    while ($currentDayObject <= $lastDayObject) {
        $currentDayText = $currentDayObject->format('Y-m-d');

        // Missing days are filled with 0
        $consumedCalories = 0;
        if (isset($consumedByDate[$currentDayText])) {
            $consumedCalories = $consumedByDate[$currentDayText];
        }

        $stepsCount = 0;
        if (isset($stepsByDate[$currentDayText])) {
            $stepsCount = $stepsByDate[$currentDayText];
        }

        $exercisesCount = 0;
        if (isset($exercisesCountByDate[$currentDayText])) {
            $exercisesCount = $exercisesCountByDate[$currentDayText];
        }

        // Weight: use the record of this day, or carry the last known weight forward
        if (isset($weightByDate[$currentDayText])) {
            $lastKnownWeight = $weightByDate[$currentDayText];
        }

        $dailyRows[] = [
            'date' => $currentDayText,
            'weight' => $lastKnownWeight,
            'consumed' => $consumedCalories,
            'burned' => calculate_calories_burned($exercisesCount, $stepsCount),
            'steps' => $stepsCount,
        ];

        $currentDayObject->modify('+1 day');
    }

    // Step 8: today's numbers (read separately, because today may be outside the period)
    $selectTodayMealsStatement = mysqli_prepare(
        $databaseConnection,
        'SELECT COALESCE(SUM(calories), 0) AS total_calories
         FROM meals
         WHERE user_id = ? AND meal_date = ?'
    );
    mysqli_stmt_bind_param($selectTodayMealsStatement, 'is', $loggedInUserId, $todayDate);
    mysqli_stmt_execute($selectTodayMealsStatement);
    $todayMealsResult = mysqli_stmt_get_result($selectTodayMealsStatement);
    $todayMealsRow = mysqli_fetch_assoc($todayMealsResult);
    mysqli_stmt_close($selectTodayMealsStatement);
    $todayConsumedCalories = (int) $todayMealsRow['total_calories'];

    $todayActivity = load_today_activity($databaseConnection, $loggedInUserId);
    $todayStepsCount = $todayActivity['steps'];
    $todayBurnedCalories = calculate_calories_burned($todayActivity['exercises_count'], $todayStepsCount);

    // Step 9: the "Current Status" card (calculated from the profile)
    $bodyNumbers = calculate_body_numbers($userProfile);

    // Step 10: send the answer in the shape reports.js expects
    // (every number is cast to int or float, and weight in daily[] is null before the first record)
    send_json_response([
        'status' => [
            'weight' => (float) $userProfile['weight_kg'],
            'height' => (float) $userProfile['height_cm'],
            'bmi' => $bodyNumbers['bmi'],
            'smm' => $bodyNumbers['muscle_mass'],
            'pbf' => $bodyNumbers['pbf'],
            'bfm' => $bodyNumbers['fat_mass'],
        ],
        'today' => [
            'consumed' => $todayConsumedCalories,
            'burned' => $todayBurnedCalories,
        ],
        'steps' => [
            'today' => $todayStepsCount,
            'goal' => (int) $userProfile['steps_goal'],
        ],
        'daily' => $dailyRows,
    ]);
} catch (Throwable $caughtException) {
    handle_server_error($caughtException);
}
```

### 13.18 `src/Backend/Diet/diet.php`

GET, no fields. Copies today's recommended meals once per day (in a transaction), then answers `{mode, targets:{calories,protein,carbohydrates,fats}, meals:[...]}`.

```php
<?php
// GET Diet/diet.php
// Returns the diet mode, today's targets and today's meals (both sources).

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/fitness.php';

// only GET is allowed here
require_request_method('GET');

// who is logged in? (sends 401 when nobody is)
$loggedInUserId = require_logged_in_user();

$isTransactionOpen = false;

try {
    $todayDate = get_today_date();

    // load the user's profile (body data, goal, modes ...)
    $userProfile = load_user_profile($databaseConnection, $loggedInUserId);

    // ---------- step 1: copy today's recommended meals (once per day) ----------
    // The copy and the "last copied" date are saved together in one transaction.
    mysqli_begin_transaction($databaseConnection);
    $isTransactionOpen = true;

    // Lock the profile row so two page loads at the same time can not copy twice.
    $selectProfileStatement = mysqli_prepare(
        $databaseConnection,
        "SELECT diet_mode, goal, recommended_meals_on FROM profiles WHERE user_id = ? FOR UPDATE"
    );
    mysqli_stmt_bind_param($selectProfileStatement, "i", $loggedInUserId);
    mysqli_stmt_execute($selectProfileStatement);
    $selectProfileResult = mysqli_stmt_get_result($selectProfileStatement);
    $lockedProfileRow = mysqli_fetch_assoc($selectProfileResult);
    mysqli_stmt_close($selectProfileStatement);

    $dietMode = $lockedProfileRow['diet_mode'];
    $userGoal = $lockedProfileRow['goal'];
    $lastCopiedDate = $lockedProfileRow['recommended_meals_on'];

    // do we need to copy the recommended meals today?
    $mustCopyRecommendedMeals = false;
    if ($dietMode === 'recommended') {
        if ($lastCopiedDate === null) {
            $mustCopyRecommendedMeals = true;
        } elseif ($lastCopiedDate !== $todayDate) {
            $mustCopyRecommendedMeals = true;
        }
    }

    if ($mustCopyRecommendedMeals) {
        // copy the meals that fit the goal (goal IS NULL means "fits any goal")
        $copyMealsStatement = mysqli_prepare(
            $databaseConnection,
            "INSERT INTO meals (user_id, name, protein_g, carbs_g, fats_g, calories, meal_date, source)
             SELECT ?, name, protein_g, carbs_g, fats_g, calories, ?, 'recommended'
             FROM recommended_meals
             WHERE goal = ? OR goal IS NULL"
        );
        mysqli_stmt_bind_param($copyMealsStatement, "iss", $loggedInUserId, $todayDate, $userGoal);
        mysqli_stmt_execute($copyMealsStatement);
        mysqli_stmt_close($copyMealsStatement);

        // remember that today's copy is done
        $updateCopiedDateStatement = mysqli_prepare(
            $databaseConnection,
            "UPDATE profiles SET recommended_meals_on = ? WHERE user_id = ?"
        );
        mysqli_stmt_bind_param($updateCopiedDateStatement, "si", $todayDate, $loggedInUserId);
        mysqli_stmt_execute($updateCopiedDateStatement);
        mysqli_stmt_close($updateCopiedDateStatement);
    }

    mysqli_commit($databaseConnection);
    $isTransactionOpen = false;

    // ---------- step 2: read today's meals (both sources) ----------
    $selectMealsStatement = mysqli_prepare(
        $databaseConnection,
        "SELECT id, name, protein_g, carbs_g, fats_g, calories, source
         FROM meals
         WHERE user_id = ? AND meal_date = ?
         ORDER BY id"
    );
    mysqli_stmt_bind_param($selectMealsStatement, "is", $loggedInUserId, $todayDate);
    mysqli_stmt_execute($selectMealsStatement);
    $selectMealsResult = mysqli_stmt_get_result($selectMealsStatement);

    $mealsList = [];
    while ($mealRow = mysqli_fetch_assoc($selectMealsResult)) {
        // MySQL gives numbers back as text, so cast them: diet.js adds them together (diet.js:157-162)
        $mealsList[] = [
            'id'            => (int) $mealRow['id'],
            'name'          => $mealRow['name'],
            'protein'       => (float) $mealRow['protein_g'],
            'carbohydrates' => (float) $mealRow['carbs_g'],
            'fats'          => (float) $mealRow['fats_g'],
            'calories'      => (int) $mealRow['calories'],
            'source'        => $mealRow['source']
        ];
    }
    mysqli_stmt_close($selectMealsStatement);

    // ---------- step 3: the daily targets ----------
    $dailyCalorieTarget = calculate_daily_calorie_target($userProfile);
    $weightInKilograms = (float) $userProfile['weight_kg'];
    $macroTargets = calculate_macro_targets($dailyCalorieTarget, $weightInKilograms, $userProfile['goal']);

    // ---------- step 4: answer with the keys diet.js expects ----------
    // (targets are whole numbers; the meal numbers above were cast to int or float)
    send_json_response([
        'mode'    => $dietMode,
        'targets' => [
            'calories'      => $dailyCalorieTarget,
            'protein'       => $macroTargets['protein'],
            'carbohydrates' => $macroTargets['carbohydrates'],
            'fats'          => $macroTargets['fats']
        ],
        'meals'   => $mealsList
    ]);
} catch (Throwable $caughtException) {
    // undo the half-finished copy, then send a friendly 500
    if ($isTransactionOpen) {
        mysqli_rollback($databaseConnection);
    }
    handle_server_error($caughtException);
}
```

### 13.19 `src/Backend/Diet/diet_mode.php`

POST, field `mode`. Saves the diet mode and answers `{message}`.

```php
<?php
// POST Diet/diet_mode.php
// Field: mode (recommended | custom). Saves the chosen diet mode, answers {"message": ...}.

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/validate.php';

require_request_method('POST');
$loggedInUserId = require_logged_in_user();

// read and check the field (400 if it is not one of the two values)
$chosenDietMode = read_post_choice('mode', 'Diet mode', ['recommended', 'custom']);

try {
    // save the choice on the user's profile
    $updateModeStatement = mysqli_prepare(
        $databaseConnection,
        "UPDATE profiles SET diet_mode = ? WHERE user_id = ?"
    );
    mysqli_stmt_bind_param($updateModeStatement, "si", $chosenDietMode, $loggedInUserId);
    mysqli_stmt_execute($updateModeStatement);
    mysqli_stmt_close($updateModeStatement);

    send_json_response(['message' => 'Diet mode saved']);
} catch (Throwable $caughtException) {
    handle_server_error($caughtException);
}
```

### 13.20 `src/Backend/Diet/meal_add.php`

POST, fields `meal-name`, `protein`, `carbohydrates`, `fats`, `calories`. Inserts a custom meal for today and answers `{message}`.

```php
<?php
// POST Diet/meal_add.php
// Fields: meal-name, protein, carbohydrates, fats, calories. Adds a custom meal for today.
//
// Chosen behaviour: after an add, diet.js switches the PAGE to the custom view
// (diet.js lines 488-490) but it does not call diet_mode.php. We keep it that way:
// adding a meal never changes the saved diet_mode. The new meal is saved with
// source = 'custom', so it is in the custom table after any reload, and the saved
// mode is used again on the next visit.

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/validate.php';
require __DIR__ . '/../includes/fitness.php';

require_request_method('POST');
$loggedInUserId = require_logged_in_user();

// read and validate every field (each helper sends 400 with a message when it is wrong)
$mealName = read_post_text('meal-name', 'Meal name', 1, 100);
$proteinInGrams = read_post_number('protein', 'Protein', 0, 500);
$carbohydratesInGrams = read_post_number('carbohydrates', 'Carbohydrates', 0, 500);
$fatsInGrams = read_post_number('fats', 'Fats', 0, 500);
$caloriesAmount = read_post_integer('calories', 'Calories', 0, 5000);

try {
    $todayDate = get_today_date();
    $mealSource = 'custom';

    // new meals added by the user always go to the custom table
    $insertMealStatement = mysqli_prepare(
        $databaseConnection,
        "INSERT INTO meals (user_id, name, protein_g, carbs_g, fats_g, calories, meal_date, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    mysqli_stmt_bind_param(
        $insertMealStatement,
        "isdddiss",
        $loggedInUserId,
        $mealName,
        $proteinInGrams,
        $carbohydratesInGrams,
        $fatsInGrams,
        $caloriesAmount,
        $todayDate,
        $mealSource
    );
    mysqli_stmt_execute($insertMealStatement);
    mysqli_stmt_close($insertMealStatement);

    send_json_response(['message' => 'Meal added']);
} catch (Throwable $caughtException) {
    handle_server_error($caughtException);
}
```

### 13.21 `src/Backend/Diet/meal_edit.php`

POST, `id` plus the meal_add fields. Updates the meal after checking ownership (404 if not found).

```php
<?php
// POST Diet/meal_edit.php
// Fields: id + meal-name, protein, carbohydrates, fats, calories. Edits one of the user's meals (404 if not theirs).

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/validate.php';

require_request_method('POST');
$loggedInUserId = require_logged_in_user();

// read and validate every field
$mealId = read_post_integer('id', 'Meal', 1, 2147483647);
$mealName = read_post_text('meal-name', 'Meal name', 1, 100);
$proteinInGrams = read_post_number('protein', 'Protein', 0, 500);
$carbohydratesInGrams = read_post_number('carbohydrates', 'Carbohydrates', 0, 500);
$fatsInGrams = read_post_number('fats', 'Fats', 0, 500);
$caloriesAmount = read_post_integer('calories', 'Calories', 0, 5000);

try {
    // first check that the meal exists AND belongs to this user
    // (affected_rows is also 0 when nothing changed, so it can not be used to detect "not found")
    $findMealStatement = mysqli_prepare(
        $databaseConnection,
        "SELECT id FROM meals WHERE id = ? AND user_id = ?"
    );
    mysqli_stmt_bind_param($findMealStatement, "ii", $mealId, $loggedInUserId);
    mysqli_stmt_execute($findMealStatement);
    $findMealResult = mysqli_stmt_get_result($findMealStatement);
    $foundMealRow = mysqli_fetch_assoc($findMealResult);
    mysqli_stmt_close($findMealStatement);

    if ($foundMealRow === null) {
        send_json_error('Meal not found', 404);
    }

    // now update it (any source, recommended meals can be edited too)
    $updateMealStatement = mysqli_prepare(
        $databaseConnection,
        "UPDATE meals
         SET name = ?, protein_g = ?, carbs_g = ?, fats_g = ?, calories = ?
         WHERE id = ? AND user_id = ?"
    );
    mysqli_stmt_bind_param(
        $updateMealStatement,
        "sdddiii",
        $mealName,
        $proteinInGrams,
        $carbohydratesInGrams,
        $fatsInGrams,
        $caloriesAmount,
        $mealId,
        $loggedInUserId
    );
    mysqli_stmt_execute($updateMealStatement);
    mysqli_stmt_close($updateMealStatement);

    send_json_response(['message' => 'Meal updated']);
} catch (Throwable $caughtException) {
    handle_server_error($caughtException);
}
```

### 13.22 `src/Backend/Diet/meal_delete.php`

POST, field `id`. Deletes the meal after checking ownership (404 if not found).

```php
<?php
// POST Diet/meal_delete.php
// Field: id. Deletes one of the user's meals (404 if it is not theirs).

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/validate.php';

require_request_method('POST');
$loggedInUserId = require_logged_in_user();

$mealId = read_post_integer('id', 'Meal', 1, 2147483647);

try {
    // check that the meal exists and belongs to this user
    $findMealStatement = mysqli_prepare(
        $databaseConnection,
        "SELECT id FROM meals WHERE id = ? AND user_id = ?"
    );
    mysqli_stmt_bind_param($findMealStatement, "ii", $mealId, $loggedInUserId);
    mysqli_stmt_execute($findMealStatement);
    $findMealResult = mysqli_stmt_get_result($findMealStatement);
    $foundMealRow = mysqli_fetch_assoc($findMealResult);
    mysqli_stmt_close($findMealStatement);

    if ($foundMealRow === null) {
        send_json_error('Meal not found', 404);
    }

    // delete it (the user_id check is repeated for safety)
    $deleteMealStatement = mysqli_prepare(
        $databaseConnection,
        "DELETE FROM meals WHERE id = ? AND user_id = ?"
    );
    mysqli_stmt_bind_param($deleteMealStatement, "ii", $mealId, $loggedInUserId);
    mysqli_stmt_execute($deleteMealStatement);
    mysqli_stmt_close($deleteMealStatement);

    send_json_response(['message' => 'Meal deleted']);
} catch (Throwable $caughtException) {
    handle_server_error($caughtException);
}
```

### 13.23 `src/Backend/Exercises/exercises.php`

GET, no fields. Answers `{mode, burned, steps, recommended:[...], custom:[...]}` for today.

```php
<?php
// GET Exercises/exercises.php
// Returns the mode, today's burned calories and steps, the recommended list and the user's custom list.

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/fitness.php';

require_request_method('GET');
$loggedInUserId = require_logged_in_user();

try {
    // keep today's exercise count up to date first
    save_today_activity($databaseConnection, $loggedInUserId);

    // the chosen schedule (recommended | custom)
    $userProfile = load_user_profile($databaseConnection, $loggedInUserId);
    $exerciseMode = $userProfile['exercise_mode'];

    // today's steps and exercise count (both 0 when there is no row yet)
    $todayActivity = load_today_activity($databaseConnection, $loggedInUserId);
    $stepsToday = $todayActivity['steps'];

    // calories burned today = exercises count x 50 + steps x 0.04
    $caloriesBurnedToday = calculate_calories_burned($todayActivity['exercises_count'], $stepsToday);

    // ---------- the recommended exercises (read-only, always in kg) ----------
    $selectRecommendedStatement = mysqli_prepare(
        $databaseConnection,
        "SELECT name, training_days, weight_kg FROM recommended_exercises ORDER BY id"
    );
    mysqli_stmt_execute($selectRecommendedStatement);
    $selectRecommendedResult = mysqli_stmt_get_result($selectRecommendedStatement);

    $recommendedList = [];
    while ($recommendedRow = mysqli_fetch_assoc($selectRecommendedResult)) {
        // "sunday,wednesday" -> ["sunday", "wednesday"] (an empty text means no days)
        $recommendedDays = [];
        if ($recommendedRow['training_days'] !== '') {
            $recommendedDays = explode(',', $recommendedRow['training_days']);
        }

        $recommendedList[] = [
            'name'   => $recommendedRow['name'],
            'days'   => $recommendedDays,
            // the column has 4 decimals, so round to 1 decimal only when sending
            'weight' => round((float) $recommendedRow['weight_kg'], 1),
            'unit'   => 'kg'
        ];
    }
    mysqli_stmt_close($selectRecommendedStatement);

    // ---------- the user's custom exercises (shown in the unit the user chose) ----------
    $selectCustomStatement = mysqli_prepare(
        $databaseConnection,
        "SELECT id, name, training_days, weight_kg, unit
         FROM exercises
         WHERE user_id = ?
         ORDER BY id"
    );
    mysqli_stmt_bind_param($selectCustomStatement, "i", $loggedInUserId);
    mysqli_stmt_execute($selectCustomStatement);
    $selectCustomResult = mysqli_stmt_get_result($selectCustomStatement);

    $customList = [];
    while ($customRow = mysqli_fetch_assoc($selectCustomResult)) {
        $customDays = [];
        if ($customRow['training_days'] !== '') {
            $customDays = explode(',', $customRow['training_days']);
        }

        // the weight is stored in kg, so convert it back when the user prefers pounds
        $weightToShow = (float) $customRow['weight_kg'];
        if ($customRow['unit'] === 'lb') {
            $weightToShow = convert_kilograms_to_pounds($weightToShow);
        }
        // round to 1 decimal only when sending (the database keeps 4 decimals)
        $weightToShow = round($weightToShow, 1);

        $customList[] = [
            'id'     => (int) $customRow['id'],
            'name'   => $customRow['name'],
            'days'   => $customDays,
            'weight' => $weightToShow,
            'unit'   => $customRow['unit']
        ];
    }
    mysqli_stmt_close($selectCustomStatement);

    send_json_response([
        'mode'        => $exerciseMode,
        'burned'      => $caloriesBurnedToday,
        'steps'       => $stepsToday,
        'recommended' => $recommendedList,
        'custom'      => $customList
    ]);
} catch (Throwable $caughtException) {
    handle_server_error($caughtException);
}
```

### 13.24 `src/Backend/Exercises/exercise_mode.php`

POST, field `mode`. Saves the schedule choice and refreshes today's exercise count.

```php
<?php
// POST Exercises/exercise_mode.php
// Field: mode (recommended | custom). Saves the chosen schedule and refreshes today's exercise count.

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/validate.php';
require __DIR__ . '/../includes/fitness.php';

require_request_method('POST');
$loggedInUserId = require_logged_in_user();

$chosenExerciseMode = read_post_choice('mode', 'Exercise mode', ['recommended', 'custom']);

try {
    // save the choice on the user's profile
    $updateModeStatement = mysqli_prepare(
        $databaseConnection,
        "UPDATE profiles SET exercise_mode = ? WHERE user_id = ?"
    );
    mysqli_stmt_bind_param($updateModeStatement, "si", $chosenExerciseMode, $loggedInUserId);
    mysqli_stmt_execute($updateModeStatement);
    mysqli_stmt_close($updateModeStatement);

    // today's exercises depend on the schedule, so save the new count
    save_today_activity($databaseConnection, $loggedInUserId);

    send_json_response(['message' => 'Exercise mode saved']);
} catch (Throwable $caughtException) {
    handle_server_error($caughtException);
}
```

### 13.25 `src/Backend/Exercises/exercise_add.php`

POST, fields `exercise-name`, `training-days[]`, `weight`, `unit`. Converts lb to kg, inserts the exercise, refreshes today's count.

```php
<?php
// POST Exercises/exercise_add.php
// Fields: exercise-name, training-days[], weight, unit (kg | lb). Adds a custom exercise.

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/validate.php';
require __DIR__ . '/../includes/fitness.php';

require_request_method('POST');
$loggedInUserId = require_logged_in_user();

// read and validate every field (each helper sends 400 with a message when it is wrong)
$exerciseName = read_post_text('exercise-name', 'Exercise name', 1, 100);
// PHP removes the [] from the field name, so it is read as 'training-days'
// (the label is singular: "Choose at least one training day")
$trainingDaysList = read_post_day_list('training-days', 'training day');
$enteredWeight = read_post_number('weight', 'Weight', 0, 500);
$weightUnit = read_post_choice('unit', 'Unit', ['kg', 'lb']);

// the database always stores kilograms
$weightInKilograms = $enteredWeight;
if ($weightUnit === 'lb') {
    $weightInKilograms = convert_pounds_to_kilograms($enteredWeight);
}

// the SET column takes the days as "sunday,tuesday" (no spaces)
$trainingDaysText = implode(',', $trainingDaysList);

try {
    // sets and reps are not on the page yet, so the table defaults (3 x 10) are used
    $insertExerciseStatement = mysqli_prepare(
        $databaseConnection,
        "INSERT INTO exercises (user_id, name, weight_kg, unit, training_days)
         VALUES (?, ?, ?, ?, ?)"
    );
    mysqli_stmt_bind_param(
        $insertExerciseStatement,
        "isdss",
        $loggedInUserId,
        $exerciseName,
        $weightInKilograms,
        $weightUnit,
        $trainingDaysText
    );
    mysqli_stmt_execute($insertExerciseStatement);
    mysqli_stmt_close($insertExerciseStatement);

    // today's exercise count may have changed
    save_today_activity($databaseConnection, $loggedInUserId);

    send_json_response(['message' => 'Exercise added']);
} catch (Throwable $caughtException) {
    handle_server_error($caughtException);
}
```

### 13.26 `src/Backend/Exercises/exercise_edit.php`

POST, `id` plus the exercise_add fields. Updates after an ownership check (404), refreshes today's count.

```php
<?php
// POST Exercises/exercise_edit.php
// Fields: id + exercise-name, training-days[], weight, unit. Edits one of the user's exercises (404 if not theirs).

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/validate.php';
require __DIR__ . '/../includes/fitness.php';

require_request_method('POST');
$loggedInUserId = require_logged_in_user();

// read and validate every field
$exerciseId = read_post_integer('id', 'Exercise', 1, 2147483647);
$exerciseName = read_post_text('exercise-name', 'Exercise name', 1, 100);
$trainingDaysList = read_post_day_list('training-days', 'training day');
$enteredWeight = read_post_number('weight', 'Weight', 0, 500);
$weightUnit = read_post_choice('unit', 'Unit', ['kg', 'lb']);

// the database always stores kilograms (4 decimals, so lb values do not drift)
$weightInKilograms = $enteredWeight;
if ($weightUnit === 'lb') {
    $weightInKilograms = convert_pounds_to_kilograms($enteredWeight);
}

$trainingDaysText = implode(',', $trainingDaysList);

try {
    // first check that the exercise exists AND belongs to this user
    // (affected_rows is also 0 when nothing changed, so it can not be used to detect "not found")
    $findExerciseStatement = mysqli_prepare(
        $databaseConnection,
        "SELECT id FROM exercises WHERE id = ? AND user_id = ?"
    );
    mysqli_stmt_bind_param($findExerciseStatement, "ii", $exerciseId, $loggedInUserId);
    mysqli_stmt_execute($findExerciseStatement);
    $findExerciseResult = mysqli_stmt_get_result($findExerciseStatement);
    $foundExerciseRow = mysqli_fetch_assoc($findExerciseResult);
    mysqli_stmt_close($findExerciseStatement);

    if ($foundExerciseRow === null) {
        send_json_error('Exercise not found', 404);
    }

    // now update it
    $updateExerciseStatement = mysqli_prepare(
        $databaseConnection,
        "UPDATE exercises
         SET name = ?, weight_kg = ?, unit = ?, training_days = ?
         WHERE id = ? AND user_id = ?"
    );
    mysqli_stmt_bind_param(
        $updateExerciseStatement,
        "sdssii",
        $exerciseName,
        $weightInKilograms,
        $weightUnit,
        $trainingDaysText,
        $exerciseId,
        $loggedInUserId
    );
    mysqli_stmt_execute($updateExerciseStatement);
    mysqli_stmt_close($updateExerciseStatement);

    // the training days may have changed today's count
    save_today_activity($databaseConnection, $loggedInUserId);

    send_json_response(['message' => 'Exercise updated']);
} catch (Throwable $caughtException) {
    handle_server_error($caughtException);
}
```

### 13.27 `src/Backend/Exercises/exercise_delete.php`

POST, field `id`. Deletes after an ownership check (404), refreshes today's count.

```php
<?php
// POST Exercises/exercise_delete.php
// Field: id. Deletes one of the user's exercises (404 if it is not theirs) and refreshes today's count.

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/validate.php';
require __DIR__ . '/../includes/fitness.php';

require_request_method('POST');
$loggedInUserId = require_logged_in_user();

$exerciseId = read_post_integer('id', 'Exercise', 1, 2147483647);

try {
    // check that the exercise exists and belongs to this user
    $findExerciseStatement = mysqli_prepare(
        $databaseConnection,
        "SELECT id FROM exercises WHERE id = ? AND user_id = ?"
    );
    mysqli_stmt_bind_param($findExerciseStatement, "ii", $exerciseId, $loggedInUserId);
    mysqli_stmt_execute($findExerciseStatement);
    $findExerciseResult = mysqli_stmt_get_result($findExerciseStatement);
    $foundExerciseRow = mysqli_fetch_assoc($findExerciseResult);
    mysqli_stmt_close($findExerciseStatement);

    if ($foundExerciseRow === null) {
        send_json_error('Exercise not found', 404);
    }

    // delete it (the user_id check is repeated for safety)
    $deleteExerciseStatement = mysqli_prepare(
        $databaseConnection,
        "DELETE FROM exercises WHERE id = ? AND user_id = ?"
    );
    mysqli_stmt_bind_param($deleteExerciseStatement, "ii", $exerciseId, $loggedInUserId);
    mysqli_stmt_execute($deleteExerciseStatement);
    mysqli_stmt_close($deleteExerciseStatement);

    // only today's count changes, past days keep their saved count
    save_today_activity($databaseConnection, $loggedInUserId);

    send_json_response(['message' => 'Exercise deleted']);
} catch (Throwable $caughtException) {
    handle_server_error($caughtException);
}
```

### 13.28 `src/Backend/Exercises/steps.php`

POST, field `steps`. Upserts today's steps into `daily_activity`.

```php
<?php
// POST Exercises/steps.php
// Field: steps (0 - 100000). Saves today's steps in daily_activity.

require __DIR__ . '/../includes/response.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/auth.php';
require __DIR__ . '/../includes/validate.php';
require __DIR__ . '/../includes/fitness.php';

require_request_method('POST');
$loggedInUserId = require_logged_in_user();

$stepsCount = read_post_integer('steps', 'Steps', 0, 100000);

try {
    $todayDate = get_today_date();

    // insert today's row, or update the steps when the row already exists.
    // Note: VALUES() is deprecated in MySQL 8.0.20+ but still works, and MariaDB needs it.
    $upsertStepsStatement = mysqli_prepare(
        $databaseConnection,
        "INSERT INTO daily_activity (user_id, activity_date, steps)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE steps = VALUES(steps)"
    );
    mysqli_stmt_bind_param($upsertStepsStatement, "isi", $loggedInUserId, $todayDate, $stepsCount);
    mysqli_stmt_execute($upsertStepsStatement);
    mysqli_stmt_close($upsertStepsStatement);

    // if this created today's row, make sure it also has the right exercise count
    save_today_activity($databaseConnection, $loggedInUserId);

    send_json_response(['message' => 'Steps saved']);
} catch (Throwable $caughtException) {
    handle_server_error($caughtException);
}
```
