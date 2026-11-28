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
/*function count_text_characters(string $text): int
{
    if (function_exists('mb_strlen')) {
        return mb_strlen($text, 'UTF-8');
    }
    return strlen($text);
}
*/
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
