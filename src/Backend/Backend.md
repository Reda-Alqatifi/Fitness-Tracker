# Backend Plan (PHP & MySQL)

This is a suggested design for the backend of the Fitness Tracker. It is based on:

- the SRS (`docs/SRS - FT.docx`)
- the API contracts already written in the frontend JS (`Forms.js`, `home.js`, `profile.js`, `reports.js`, `main.js`)
- the forms already in `diet.html` and `exercises.html`, even though those pages aren't finished

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
10. [Frontend fixes needed for the backend](#10-frontend-fixes-needed-for-the-backend)
11. [Suggested tasks (T11 – T18)](#11-suggested-tasks-t11--t18)
12. [Who does what (team split)](#12-who-does-what-team-split)

---

## 1. What the backend is responsible for

| Area | What the backend does |
|---|---|
| **Accounts** | Register, log in (with "remember me"), log out, change password, delete account |
| **Sessions** | Know who the logged-in user is on every request, and return `401` when no one is logged in |
| **Profile** | Store and update body data (birthdate, gender, height, weight, target weight, goal, activity level) |
| **Weight history** | Save a record every time the weight changes, for the weight chart in Reports |
| **Calculations** | BMI, PBF, BFM, SMM, daily calorie target, macro targets, calories burned |
| **Diet** | Recommended or custom diet, add, edit, and delete meals, daily totals compared to targets |
| **Exercises** | Recommended or custom schedule, add, edit, and delete exercises, weights in kg/lb, training days, "done" logs, steps |
| **Reports** | Combine the data into daily series (weight, consumed, burned, steps) for a week, month, year, or custom range |
| **Validation and privacy** | Validate every input, and make sure each user can only read and change their own rows |

Things that **don't need the backend**:

- **Dark mode**: already handled in the frontend.
- **PDF export**: do it in the frontend with `window.print()` (plus a print CSS) or a library like `jsPDF`/`html2pdf`. The charts are already drawn in the browser, so it's much easier there than in PHP.

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

The frontend already calls `../../../Backend/<file>.php` from `Frontend/Pages/<page>/`, which resolves to `src/Backend/<file>.php`. So when you build an endpoint, **replace `[login.php]` with `login.php`** (remove the brackets) in the JS.

Import the database with phpMyAdmin (Import → `src/Database/FT.SQL`) or:

```bash
mysql -u root < src/Database/FT.SQL
```

---

## 3. Folder structure

Use one PHP file per action, kept flat, so the paths match what the frontend already uses. Shared code goes in `includes/`.

```
src/Backend/
    |
    |---- index.php                 -> redirect to the welcome page (or a simple "API is running" check)
    |---- Backend.md                -> this file
    |
    |---- config/
    |       |---- config.example.php    -> DB host/name/user/password template (committed)
    |       |---- config.php            -> real values (add to .gitignore)
    |
    |---- includes/
    |       |---- db.php            -> mysqli connection ($conn)
    |       |---- response.php      -> json_response(), json_error()
    |       |---- auth.php          -> start_session(), require_login(), current_user_id()
    |       |---- validate.php      -> helpers to read and validate $_POST / $_GET
    |       |---- fitness.php       -> all formulas (BMI, PBF, BMR, TDEE, macros, burned calories)
    |
    |---- register.php          POST
    |---- login.php             POST
    |---- logout.php            POST
    |
    |---- home.php              GET
    |
    |---- profile.php           GET
    |---- edit_profile.php      POST
    |---- change_password.php   POST
    |---- delete_account.php    POST
    |
    |---- reports.php           GET
    |
    |---- diet.php              GET
    |---- diet_mode.php         POST
    |---- meal_add.php          POST
    |---- meal_edit.php         POST
    |---- meal_delete.php       POST
    |
    |---- exercises.php         GET
    |---- exercise_mode.php     POST
    |---- exercise_add.php      POST
    |---- exercise_edit.php     POST
    |---- exercise_delete.php   POST
    |---- exercise_done.php     POST
    |---- steps.php             POST
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
   | `401` | Not logged in or the session expired. **Every protected page redirects to login on 401**, so always return it for protected endpoints. |
   | `403` | Trying to change a row that belongs to another user |
   | `404` | The meal or exercise doesn't exist |
   | `405` | Wrong method (GET on a POST endpoint) |
   | `409` | The email is already registered |
   | `500` | Database error (log the real error, send a generic message) |

4. **Inputs come as form data**, so read them with `$_POST` (the frontend sends `new FormData(form)`). GET endpoints use `$_GET`.
5. **Each protected endpoint starts with `require_login()`**. It returns the user id from the session or sends `401`.
6. **Never trust a `user_id` sent by the client.** Always use the one in the session.
7. **Every query uses mysqli prepared statements** (`mysqli_prepare` + `mysqli_stmt_bind_param`). Never build SQL by joining strings.
8. **Each row that belongs to a user is checked with `WHERE id = ? AND user_id = ?`.** This covers the SRS "Data Privacy" requirement.
9. **Store numbers in metric** (kg, cm). Convert lb → kg on input (`kg = lb × 0.45359237`).
10. **Dates** go over the API as `YYYY-MM-DD` strings. Set the timezone once: `date_default_timezone_set('Asia/Riyadh');`.

---

## 5. Database design

The SRS architecture lists: *Users, Profiles, Weight History, Diets, Foods, Exercises, Exercise History*. The design below keeps the same idea, with a few additions that the reports and the recommended options need.

### 5.1 Overview (ER)

```
users 1───1 profiles
  │
  ├──< weight_history          (one row per day the weight changes)
  ├──< meals                   (the "Foods" of the SRS, each with a date)
  ├──< exercises               (the user's schedule)
  │        └──< exercise_logs  (the "Exercise History": done on a date, with the weight used)
  └──< daily_activity          (steps per day)

recommended_meals              (catalog, copied into meals when the user picks "recommended")
recommended_exercises          (catalog, copied into exercises when the user picks "recommended")
```

All user tables use `ON DELETE CASCADE`, so **deleting a user deletes all their data** automatically (SRS: Account Deletion and Database Integrity).

### 5.2 Tables

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Login account | `id`, `name`, `email` (unique), `password_hash`, `created_at` |
| `profiles` | Body data and settings (1:1 with users) | `birthdate`, `gender`, `height_cm`, `weight_kg`, `target_weight_kg`, `goal`, `activity`, `diet_mode`, `exercise_mode`, `steps_goal` |
| `weight_history` | Weight over time (Reports weight chart) | `user_id`, `weight_kg`, `recorded_on` (unique per user per day) |
| `meals` | Meals the user ate or planned on a date | `user_id`, `name`, `protein_g`, `carbs_g`, `fats_g`, `calories`, `meal_date`, `source` |
| `recommended_meals` | Catalog of ready meals | `name`, macros, `calories`, `goal` |
| `exercises` | The user's training schedule | `user_id`, `name`, `sets`, `reps`, `weight_kg`, `unit`, `training_days` (SET), `source` |
| `recommended_exercises` | Catalog of ready exercises | `name`, `sets`, `reps`, `weight_kg`, `training_days` |
| `exercise_logs` | "I did this exercise on this date", with the weight used | `exercise_id`, `user_id`, `log_date`, `weight_kg` |
| `daily_activity` | Steps per day | `user_id`, `activity_date`, `steps` |

Why some of these choices:

- **Age isn't stored.** It's calculated from `birthdate`, so it's always correct.
- **BMI, PBF, BFM, and SMM aren't stored.** They're calculated from weight, height, age, and gender each time (see [section 6](#6-calculations)), so they can't get out of sync.
- **Meals have a `meal_date`.** Without a date, Reports can't show "consumed per day this month".
- **`exercise_logs` exists** because Reports needs burned calories *per past day*. If you only had the schedule, changing it today would also change last month's numbers.
- **`training_days` uses MySQL's `SET` type**, so one column holds several days, for example `'sun,tue,thu'`. You can filter with `FIND_IN_SET('mon', training_days)`.

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
    user_id           INT UNSIGNED PRIMARY KEY,
    birthdate         DATE NOT NULL,
    gender            ENUM('male','female') NOT NULL,
    height_cm         DECIMAL(5,1) NOT NULL,               -- 50 .. 250
    weight_kg         DECIMAL(5,1) NOT NULL,               -- 20 .. 300
    target_weight_kg  DECIMAL(5,1) NULL,
    goal              ENUM('lose','gain','maintain') NOT NULL,
    activity          ENUM('sedentary','light','moderate','very') NOT NULL,
    diet_mode         ENUM('none','recommended','custom') NOT NULL DEFAULT 'none',
    exercise_mode     ENUM('none','recommended','custom') NOT NULL DEFAULT 'none',
    steps_goal        INT UNSIGNED NOT NULL DEFAULT 10000,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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

-- ---------- meals (user's food log) ----------
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

-- ---------- recommended exercises (catalog) ----------
CREATE TABLE recommended_exercises (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    sets           TINYINT UNSIGNED NOT NULL DEFAULT 3,
    reps           TINYINT UNSIGNED NOT NULL DEFAULT 10,
    weight_kg      DECIMAL(5,1) NOT NULL DEFAULT 0,          -- "the least weight"
    training_days  SET('sun','mon','tue','wed','thu','fri','sat') NOT NULL
) ENGINE=InnoDB;

-- ---------- exercises (user's schedule) ----------
CREATE TABLE exercises (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id        INT UNSIGNED NOT NULL,
    name           VARCHAR(100) NOT NULL,
    sets           TINYINT UNSIGNED NOT NULL DEFAULT 3,
    reps           TINYINT UNSIGNED NOT NULL DEFAULT 10,
    weight_kg      DECIMAL(5,1) NOT NULL DEFAULT 0,          -- always stored in kg
    unit           ENUM('kg','lb') NOT NULL DEFAULT 'kg',     -- how the user prefers to see it
    training_days  SET('sun','mon','tue','wed','thu','fri','sat') NOT NULL,
    source         ENUM('recommended','custom') NOT NULL DEFAULT 'custom',
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ex_user (user_id),
    CONSTRAINT fk_ex_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- exercise history ----------
CREATE TABLE exercise_logs (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      INT UNSIGNED NOT NULL,
    exercise_id  INT UNSIGNED NULL,                          -- NULL if the exercise was deleted later
    name         VARCHAR(100) NOT NULL,                      -- copy, so history survives deletion
    weight_kg    DECIMAL(5,1) NOT NULL DEFAULT 0,
    log_date     DATE NOT NULL,
    UNIQUE KEY uq_log (exercise_id, log_date),
    INDEX idx_log_user_date (user_id, log_date),
    CONSTRAINT fk_log_user FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
    CONSTRAINT fk_log_ex   FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- steps per day ----------
CREATE TABLE daily_activity (
    user_id        INT UNSIGNED NOT NULL,
    activity_date  DATE NOT NULL,
    steps          INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, activity_date),
    CONSTRAINT fk_act_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================================================
--  Seed data (change freely)
-- =========================================================
INSERT INTO recommended_meals (name, protein_g, carbs_g, fats_g, calories, goal) VALUES
('Oats with milk and banana',   15, 60, 8,  370, NULL),
('Grilled chicken with rice',   40, 55, 10, 470, NULL),
('Greek yogurt with berries',   18, 20, 4,  190, 'lose'),
('Tuna salad',                  30, 10, 12, 270, 'lose'),
('Salmon with sweet potato',    35, 40, 18, 460, NULL),
('Peanut butter sandwich',      14, 45, 18, 400, 'gain'),
('Eggs and whole-wheat toast',  20, 30, 14, 330, NULL);

INSERT INTO recommended_exercises (name, sets, reps, weight_kg, training_days) VALUES
('Bench Press',     3, 10, 20, 'sun,wed'),
('Squat',           3, 10, 20, 'mon,thu'),
('Deadlift',        3, 8,  30, 'tue'),
('Shoulder Press',  3, 10, 8,  'sun,wed'),
('Lat Pulldown',    3, 12, 25, 'mon,thu'),
('Plank',           3, 1,  0,  'tue,sat');
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
| **Carbs target** | `(calorie target − protein×4 − fats×9) / 4` (grams) |
| **Burned (exercises)** | `number of exercises done that day × 50 kcal`. The SRS says to use the *count*, not the type. Keep `50` as one constant. |
| **Burned (steps)** | `steps × 0.04 kcal` |
| **Burned (total for a day)** | exercises burned + steps burned |
| **Meal calories, if empty** | `protein×4 + carbs×4 + fats×9` (useful as a default) |

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
```

---

## 7. Endpoints, page by page

Request fields below use the **exact `name=` attributes** already in the HTML forms.

### 7.1 Auth (login and register forms, navbar)

#### `POST register.php`
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
  3. `INSERT profiles`.
  4. `INSERT weight_history` (the first weight, today).
  5. Log the user in (`session_regenerate_id(true)`, `$_SESSION['user_id'] = ...`).
- **Response:** `200 { "message": "Account created" }` → the frontend goes to home.

#### `POST login.php`
- **Fields:** `email`, `password`, `remember` (`"yes"` when checked)
- **Logic:**
  1. Find the user by email.
  2. Check with `password_verify()`.
  3. If it fails, return `401 { "message": "Wrong email or password" }`. Use the same message for "email not found", so attackers can't learn which emails exist.
  4. On success, call `session_regenerate_id(true)` and set `$_SESSION['user_id']`.
  5. If `remember === "yes"`, make the session cookie last 30 days (see the skeleton in [section 8](#8-code-skeletons)).

#### `POST logout.php`
- **Logic:** `$_SESSION = []`, delete the session cookie, then `session_destroy()`.
- **Response:** `200`.

### 7.2 Home page

#### `GET home.php`
Already defined in `home.js`:
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
- `exercises` = the user's exercises where `FIND_IN_SET(<today 3-letter>, training_days)`. Use `strtolower(date('D'))` → `sun`, `mon` ...
- `calories.consumed` = `SUM(calories)` from `meals` for today.
- `calories.goal` = `calorie_target()`.
- `calories.burned` = burned today (exercise logs + steps).
- `weight` is in kg. If an exercise's `unit` is `lb`, convert it back for display or send `unit` too.

### 7.3 Profile page

#### `GET profile.php`
Already defined in `profile.js`:
```json
{ "name": "Flan", "gender": "male", "birthdate": "2004-05-17", "age": 22,
  "height": 175, "weight": 78, "targetWeight": 72, "goal": "lose",
  "activity": "moderate", "created": "2026-10-07" }
```

#### `POST edit_profile.php`
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

#### `POST change_password.php`
- **Fields:** `old-password`, `new-password`, `confirm-new-password`
- **Logic:**
  1. `password_verify(old)`. If wrong, return `400 { "message": "Wrong password" }`.
  2. Check the new password is ≥ 8 chars and equals the confirmation.
  3. Store `password_hash(new)`.

#### `POST delete_account.php`
- **Fields:** `email`, `password`, `confirm-password`
- **Logic:**
  1. The email must equal the logged-in user's email.
  2. `password_verify()`.
  3. `DELETE FROM users WHERE id = ?`. The cascade removes everything else.
  4. Destroy the session.

### 7.4 Reports page

#### `GET reports.php?range=week|month|year|custom[&from=YYYY-MM-DD&to=YYYY-MM-DD]`
Already defined in `reports.js`. Add a `status` object for the SRS status card (weight, height, BMI, SMM, PBF, BFM):
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
   - custom = validate both dates, with `from ≤ to` and at most about 1 year apart
2. Run **one grouped query per table**, not one query per day:
   - `SELECT meal_date, SUM(calories) FROM meals WHERE user_id=? AND meal_date BETWEEN ? AND ? GROUP BY meal_date`
   - `SELECT log_date, COUNT(*) FROM exercise_logs ... GROUP BY log_date`
   - `SELECT activity_date, steps FROM daily_activity ...`
   - `SELECT recorded_on, weight_kg FROM weight_history ...`
3. Loop over each date from `from` to `to` in PHP and fill the missing days with `0`. For **weight**, carry the last known value forward instead of using 0.
4. For `year`, it's a good idea to group by week or month (about 52 or 12 points), so the chart stays readable.

**PDF export:** do it in the frontend (see [section 1](#1-what-the-backend-is-responsible-for)).

### 7.5 Diet page (suggested contract, since the page isn't finished)

#### `GET diet.php?date=YYYY-MM-DD` (date is optional, the default is today)
```json
{
  "mode": "recommended",
  "date": "2026-11-18",
  "targets":  { "calories": 2400, "protein": 140, "carbs": 280, "fats": 67 },
  "consumed": { "calories": 1650, "protein": 95,  "carbs": 180, "fats": 50 },
  "meals": [
    { "id": 12, "name": "Grilled chicken with rice", "protein": 40, "carbs": 55, "fats": 10, "calories": 470, "source": "recommended" }
  ]
}
```
This covers the macro bars (consumed vs targets) and "daily calories vs target".

#### `POST diet_mode.php`
- **Fields:** `mode` = `recommended` | `custom`
- **Logic:** update `profiles.diet_mode`. If it's `recommended` and today has no meals yet, copy the `recommended_meals` that fit the user's goal (`goal = ? OR goal IS NULL`) into `meals` for today with `source='recommended'`. For `custom`, the frontend opens the add-meal form.

#### `POST meal_add.php`
- **Fields** (already in `diet.html`): `meal-name`, `protein`, `carbohydrates`, `fats`, `calories`, and optionally `date`
- **Validation:** name 1–100 chars, numbers ≥ 0 with sensible maximums (for example protein ≤ 500 g, calories ≤ 5000). If calories are empty, calculate them from the macros.

#### `POST meal_edit.php`
- **Fields:** `id`, plus the same fields as add
- **Logic:** `UPDATE meals SET ... WHERE id = ? AND user_id = ?`. If 0 rows match, return `404`.

#### `POST meal_delete.php`
- **Fields:** `id`
- **Logic:** `DELETE FROM meals WHERE id = ? AND user_id = ?`

### 7.6 Exercises page (suggested contract, since the page isn't finished)

#### `GET exercises.php?day=sun|mon|...` (the default is today)
```json
{
  "mode": "custom",
  "day": "wed",
  "burned": 250,
  "exercises": [
    { "id": 5, "name": "Bench Press", "sets": 3, "reps": 10,
      "weight": 40, "unit": "kg", "days": ["sun", "wed"], "done": true }
  ]
}
```
- This returns the exercises whose `training_days` include `day` (SRS: "filtering by the current day or a day specified by the user").
- `done` = whether an `exercise_logs` row exists for today.
- `burned` = done count × 50, plus today's steps × 0.04.

#### `POST exercise_mode.php`
- **Fields:** `mode` = `recommended` | `custom`
- **Logic:** like diet. For `recommended`, copy `recommended_exercises` into `exercises` (if the user has none yet).

#### `POST exercise_add.php`
- **Fields** (already in `exercises.html`): `exercise-name`, `training-days[]` (see [section 10](#10-frontend-fixes-needed-for-the-backend)), `weight`, `unit`, and optionally `sets` and `reps`
- **Validation:**
  - name 1–100 chars
  - at least 1 day, and every day in `sun..sat`
  - weight 0–500
  - unit `kg`|`lb`
- **Logic:**
  1. Convert lb → kg before saving.
  2. Store the days as `implode(',', $days)` (that's the format the `SET` column takes).

#### `POST exercise_edit.php`
- **Fields:** `id`, plus the same fields as add (the SRS requires being able to edit the weight)
- **Logic:** update with `WHERE id = ? AND user_id = ?`. If it was done today, also update today's `exercise_logs.weight_kg`.

#### `POST exercise_delete.php`
- **Fields:** `id`
- **Logic:** delete it. Its logs stay (the exercise id becomes NULL), so the reports history isn't lost.

#### `POST exercise_done.php`
- **Fields:** `id`, `done` (`1`/`0`), and optionally `date`
- **Logic:**
  - `done=1` → `INSERT IGNORE INTO exercise_logs (user_id, exercise_id, name, weight_kg, log_date)`
  - `done=0` → delete that log
- **Why this is needed:** it's what makes "calories burned per day" in Reports real. Without it, the only option is to assume every scheduled exercise was done (simpler, but less correct).

#### `POST steps.php`
- **Fields:** `steps` (0–100000), and optionally `date` (the default is today, and it can't be in the future)
- **Logic:** `INSERT INTO daily_activity ... ON DUPLICATE KEY UPDATE steps = VALUES(steps)`
- **Where:** the SRS says steps are "entered by the user into the exercises page", so add a small "Today's steps" input there.

---

## 8. Code skeletons

These show the patterns. Every endpoint follows the same shape.

They use **procedural mysqli**, the same style as the course (`mysqli_connect(...)`).

### `config/config.example.php`
```php
<?php
$server   = "localhost";
$user     = "root";
$password = "";               // XAMPP default is empty
$database = "fitness_tracker";
```

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

**Transactions** (register, "choose recommended"):

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

### `login.php` (an example endpoint)
```php
<?php
require __DIR__ . '/includes/response.php';
require __DIR__ . '/includes/db.php';
require __DIR__ . '/includes/auth.php';

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

### A protected endpoint (pattern)
```php
<?php
require __DIR__ . '/includes/response.php';
require __DIR__ . '/includes/db.php';
require __DIR__ . '/includes/auth.php';

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
- [ ] **XSS**: the frontend already uses `textContent` (good). Keep it that way and never put API data into `innerHTML`.
- [ ] **Transactions**: register and "choose recommended" write several tables, so wrap them in `mysqli_begin_transaction()` / `mysqli_commit()` (*Integrity*)
- [ ] **Foreign keys** with `ON DELETE CASCADE` (*Integrity, Account Deletion*)
- [ ] **Config**: `config.php` with the DB password is in `.gitignore`
- [ ] **Performance**: indexes on `(user_id, date)` columns, and grouped queries in reports instead of loops (*Performance < 3 s*)

---

## 10. Frontend fixes needed for the backend

1. **Remove the brackets** in the API constants once each PHP file exists, for example `"../../../Backend/[login.php]"` → `"../../../Backend/login.php"`.
2. **`exercises.html` → `training-days` checkboxes:** rename to `name="training-days[]"`. PHP only keeps the *last* value when several inputs share a name without `[]`.
3. **Exercises page:** add a "done today" checkbox per exercise (→ `exercise_done.php`) and a "today's steps" input (→ `steps.php`).
4. **Reports page:** `reports.html` has a `custom` option, but `reports.js` doesn't send `from`/`to` yet. Add two date inputs and send them.
5. **Reports status card:** read the new `status` object (weight, height, BMI, SMM, PBF, BFM).
6. **Edit/delete forms for meals and exercises:** add a hidden `<input type="hidden" name="id">` so the backend knows which row to change.
7. **Test through the PHP server** (XAMPP or `php -S`), not Live Server.

---

## 11. Suggested tasks (T11 – T18)

These fit the empty backend rows in the SRS task table, in dependency order:

| No | Task | Depends on | Output |
|---|---|---|---|
| T11 | Database schema and seed data | - | `src/Database/FT.SQL` |
| T12 | Core includes (db, response, auth/session, validation, fitness formulas) and config | T11 | `includes/*`, `config/*` |
| T13 | Auth: register, login (remember me), logout | T12 | `register.php`, `login.php`, `logout.php` |
| T14 | Profile: get, edit (and weight history), change password, delete account | T13 | `profile.php`, `edit_profile.php`, `change_password.php`, `delete_account.php` |
| T15 | Home dashboard data | T14 | `home.php` |
| T16 | Diet: get, mode, add, edit, and delete meals | T13 | `diet.php`, `diet_mode.php`, `meal_*.php` |
| T17 | Exercises: get, mode, add, edit, delete, done, and steps | T13 | `exercises.php`, `exercise_*.php`, `steps.php` |
| T18 | Reports and full integration testing (all pages talking to the backend) | T14–T17 | `reports.php`, bug fixes |

After T13 is done, T16 and T17 can be worked on **at the same time** by different members, since they don't touch the same files.

---

## 12. Who does what (team split)

**Each member builds the backend of the pages they built in the frontend.** They already know those pages' forms and JS. Reda also builds the shared parts (the database and `includes/`), because everyone else depends on them.

### 12.1 Overview

| Member | Backend files | Tables they query | Tasks |
|---|---|---|---|
| **Reda** | `FT.SQL`, `config/*`, `includes/db.php`, `response.php`, `auth.php`, `validate.php`, `index.php`, `home.php` | all (creates them), reads in `home.php` | T11, T12, T15 |
| **Mohammed** | `register.php`, `login.php`, `logout.php`, `profile.php`, `edit_profile.php`, `change_password.php`, `delete_account.php` | `users`, `profiles`, `weight_history` | T13, T14 |
| **Hassan** | `includes/fitness.php`, `reports.php` | reads `meals`, `exercise_logs`, `daily_activity`, `weight_history`, `profiles` | T18 (and the formulas in T12) |
| **Redwan** | `diet.php`, `diet_mode.php`, `meal_add.php`, `meal_edit.php`, `meal_delete.php` | `meals`, `recommended_meals`, `profiles` | T16 |
| **Ahmed** | `exercises.php`, `exercise_mode.php`, `exercise_add.php`, `exercise_edit.php`, `exercise_delete.php`, `exercise_done.php`, `steps.php` | `exercises`, `exercise_logs`, `recommended_exercises`, `daily_activity`, `profiles` | T17 |

### 12.2 Order of work

```
Phase 1:  Reda      -> FT.SQL + config + includes (db, response, auth, validate)
          Hassan    -> includes/fitness.php (only needs the formulas, no DB)
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
- [ ] Write `config/config.example.php` and add `config/config.php` to `.gitignore`.
- [ ] Write `includes/response.php`, `includes/db.php`, and `includes/auth.php` (see [section 8](#8-code-skeletons)).
- [ ] Write `includes/validate.php` with small helpers everyone uses, for example `post_int()`, `post_float()`, `post_enum()`, `post_date()`.
- [ ] Write `index.php` (redirect to the welcome page).
- [ ] Write `home.php` ([section 7.2](#72-home-page)) and remove the brackets from `HOME_API` in `home.js`. Today's burned calories can use the same function Hassan writes in `fitness.php`.
- [ ] Remove the brackets from `LOGOUT_API` in `main.js` once Mohammed's `logout.php` exists.
- [ ] **Owns `FT.SQL`:** if anyone needs a new column or table, they ask Reda, so the schema stays in one place.
- [ ] Review the pull requests to `main`.

#### Mohammed: accounts and profile
- [ ] `register.php`: validation, then one transaction that inserts into `users`, `profiles`, and `weight_history`, then logs the user in ([section 7.1](#71-auth-login-and-register-forms-navbar)).
- [ ] `login.php` (with "remember me") and `logout.php`.
- [ ] `profile.php`: return the profile, with `age` calculated from `birthdate` ([section 7.3](#73-profile-page)).
- [ ] `edit_profile.php`: check the target weight against the goal again in PHP, and save today's weight in `weight_history` when it changes.
- [ ] `change_password.php` and `delete_account.php` (the delete relies on `ON DELETE CASCADE`).
- [ ] In `Forms.js` and `profile.js`, remove the brackets from the API constants.

#### Hassan: formulas and Reports
- [ ] `includes/fitness.php`: age, BMI, PBF, BFM, SMM, BMR, TDEE, calorie target, macro targets, and burned calories ([section 6](#6-calculations)). **Do this in Phase 1**, because Home, Diet, and Exercises use it.
- [ ] `reports.php`: the `week`, `month`, `year`, and `custom` ranges, one grouped query per table, filling missing days (weight carries forward), plus the `status` object ([section 7.4](#74-reports-page)).
- [ ] In `reports.js`: remove the brackets from `REPORTS_API`, send `from`/`to` for the custom range, and show the `status` card.
- [ ] PDF export in the frontend (`window.print()` or `jsPDF`).

#### Redwan: Diet
- [ ] `diet.php`: the day's meals, the totals, and the targets from `fitness.php` ([section 7.5](#75-diet-page-suggested-contract-since-the-page-isnt-finished)).
- [ ] `diet_mode.php`: save the mode. For "recommended", copy the matching `recommended_meals` into today's meals (in a transaction).
- [ ] `meal_add.php`, `meal_edit.php`, and `meal_delete.php`, always with `AND user_id = ?`.
- [ ] Write `diet.js` to call these endpoints, and add the hidden `id` input to the edit form.

#### Ahmed: Exercises and steps
- [ ] In `exercises.html`, rename the checkboxes to `name="training-days[]"`.
- [ ] `exercises.php`: the exercises for a day, with `done` and `burned` ([section 7.6](#76-exercises-page-suggested-contract-since-the-page-isnt-finished)).
- [ ] `exercise_mode.php`: save the mode. For "recommended", copy `recommended_exercises` (in a transaction).
- [ ] `exercise_add.php`, `exercise_edit.php`, and `exercise_delete.php` (convert lb → kg before saving).
- [ ] `exercise_done.php` (the "done today" checkbox) and `steps.php` (the "today's steps" input).
- [ ] Write `exercises.js` to call these endpoints.

### 12.4 Rules for everyone
- Work in **your own branch** and open a pull request when you finish, as described in the SRS notes.
- **Don't edit someone else's files.** If you need a change in `includes/` or `FT.SQL`, ask the owner.
- Follow [section 4](#4-general-rules-for-every-endpoint) and the patterns in [section 8](#8-code-skeletons), so every file looks the same.
- Before opening your pull request, test your page through XAMPP with a real logged-in user, including the error cases (wrong input, not logged in).
