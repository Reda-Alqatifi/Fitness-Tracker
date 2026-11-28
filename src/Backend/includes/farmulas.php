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
/*
function calculate_age_in_years(string $birthdate): int
{
    $birthdateObject = new DateTime($birthdate);
    $todayObject = new DateTime(get_today_date());
    $difference = $birthdateObject->diff($todayObject);

    return (int) $difference->y;
}
*/

// ---------- body numbers ----------

// BMI = weight / height(m)^2, NOT rounded (used inside the other formulas).
function calculate_body_mass_not_rounded(float $weightInKilograms, float $heightInCentimeters): float
{
    $heightInMeters = $heightInCentimeters / 100;

    return $weightInKilograms / ($heightInMeters * $heightInMeters);
}

// BMI rounded to 1 decimal (the number we show).
function calculate_body_mass_rounded(float $weightInKilograms, float $heightInCentimeters): float
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
function calculate_muscle_mass(float $weightInKilograms, float $bodyFatMass): float
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
function calories_burned_without_doing_anything(float $weightInKilograms, float $heightInCentimeters, int $ageInYears, string $gender): float
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
function calculate_protein_fats_carbs_targets(int $dailyCalorieTarget, float $weightInKilograms, string $goal): array
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
