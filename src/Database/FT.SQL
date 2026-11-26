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

-- Make sure this import itself including arabic latters
SET NAMES utf8mb4;

-- !---------- users ----------

CREATE TABLE IF NOT EXISTS users (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(50)  NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,   -- UNIQUE = no two accounts with one email
    password_hash   VARCHAR(255) NOT NULL,          -- from password_hash()
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- /////////////////////////

-- !---------- profiles (1:1 with users) ----------

CREATE TABLE IF NOT EXISTS profiles (
    user_id               INT UNSIGNED PRIMARY KEY, -- same id as the user (1:1)
    birthdate             DATE NOT NULL,
    gender                ENUM('male','female') NOT NULL,
    height_cm             DECIMAL(5,1) NOT NULL,    -- 50 .. 250
    weight_kg             DECIMAL(5,1) NOT NULL,    -- 20 .. 300
    target_weight_kg      DECIMAL(5,1) NULL,
    goal                  ENUM('lose','gain','maintain') NOT NULL,
    activity              ENUM('sedentary','light','moderate','very') NOT NULL,
    diet_mode             ENUM('recommended','custom') NOT NULL DEFAULT 'recommended',
    exercise_mode         ENUM('recommended','custom') NOT NULL DEFAULT 'recommended',
    steps_goal            INT UNSIGNED NOT NULL DEFAULT 10000,
    recommended_meals_on  DATE NULL,                -- last day the recommended meals were copied
    updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- /////////////////////////

-- !---------- weight history ----------

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

-- /////////////////////////

-- !---------- recommended meals (catalog) ----------

CREATE TABLE IF NOT EXISTS recommended_meals (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    protein_g   DECIMAL(6,1) NOT NULL,
    carbs_g     DECIMAL(6,1) NOT NULL,
    fats_g      DECIMAL(6,1) NOT NULL,
    calories    INT UNSIGNED NOT NULL,
    goal        ENUM('lose','gain','maintain') NULL -- NULL = fits any goal
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- /////////////////////////

-- !---------- meals (both tables of the diet page) ----------

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
    INDEX idx_meals_user_date (user_id, meal_date), -- fast "meals of this user on this day"
    CONSTRAINT fk_meals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- /////////////////////////

-- !---------- recommended exercises (catalog, read-only) ----------

CREATE TABLE IF NOT EXISTS recommended_exercises (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    sets           TINYINT UNSIGNED NOT NULL DEFAULT 3,
    reps           TINYINT UNSIGNED NOT NULL DEFAULT 10,
    weight_kg      DECIMAL(8,4) NOT NULL DEFAULT 0, -- "the least weight" (4 decimals, same as exercises)
    training_days  SET('sunday','monday','tuesday','wednesday','thursday','friday','saturday') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- /////////////////////////

-- !---------- exercises (the user's custom schedule) ----------

CREATE TABLE IF NOT EXISTS exercises (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id        INT UNSIGNED NOT NULL,
    name           VARCHAR(100) NOT NULL,
    sets           TINYINT UNSIGNED NOT NULL DEFAULT 3,     -- no input on the page yet, default used
    reps           TINYINT UNSIGNED NOT NULL DEFAULT 10,    -- no input on the page yet, default used
    -- always stored in kg. 4 decimals, so a weight typed in lb (for example 10 lb = 4.5359 kg)
    -- converts back to 10.0 lb. The API rounds it to 1 decimal only when it SENDS the number.
    weight_kg      DECIMAL(8,4) NOT NULL DEFAULT 0,
    unit           ENUM('kg','lb') NOT NULL DEFAULT 'kg',   -- how the user prefers to see it
    training_days  SET('sunday','monday','tuesday','wednesday','thursday','friday','saturday') NOT NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ex_user (user_id),
    CONSTRAINT fk_ex_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- /////////////////////////

-- !---------- exercise history (steps and number of exercises per day) ----------

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

-- /////////////////////////

-- !=========================================================
-- !  Seed data (the same items as the demo rows in the HTML)
-- !=========================================================

DELETE FROM recommended_meals;
DELETE FROM recommended_exercises;

INSERT INTO recommended_meals (name, protein_g, carbs_g, fats_g, calories, goal) VALUES
('Oatmeal with Milk', 15, 50, 10, 350, NULL),
('Grilled Chicken', 40, 30, 12, 400, NULL),
('Greek Yogurt', 20, 15, 5, 185, NULL),
('Tuna Salad', 30, 10, 12, 270, 'lose'),
('Peanut Butter Sandwich', 14, 45, 18, 400, 'gain');

INSERT INTO recommended_exercises (name, sets, reps, weight_kg, training_days) VALUES
('Bench Press', 3, 10, 20, 'sunday,wednesday'),
('Squat', 3, 10, 30, 'monday,thursday'),
('Deadlift', 3, 8,  40, 'tuesday');
