<?php

//! Opens the database connection and puts it in the global variable $DBConnection

//! to stop a second load
if (defined('DB_HELPERS_LOADED')) {
    return;
}
define('DB_HELPERS_LOADED', true);

//! includes response.php (once)
require_once __DIR__ . '/response.php';

// ////////////////

$configPath = __DIR__ . '/../config/config.php'; //! config.php must exist

if (!file_exists($configPath)) {
    error_log('Missing config/config.php. Copy config.example.php to config.php.');
    send_json_error('Server is not configured', 500);
}

//! includes configPath (once)
require_once $configPath;

// ////////////////

//! make sure the config file defined everything we need
if (!defined('DB_HOST') || !defined('DB_NAME') || !defined('DB_USER') || !defined('DB_PASSWORD')) {
    error_log('config/config.php is missing DB_HOST, DB_NAME, DB_USER or DB_PASSWORD.');
    send_json_error('Server is not configured', 500);
}

// ////////////////

//! setting the timezone. "Today" in PHP now means today in this timezone (to match the DB)
$appTimezone = 'Asia/Riyadh';
if (defined('APP_TIMEZONE')) {
    $appTimezone = APP_TIMEZONE;
}
date_default_timezone_set($appTimezone);

//! turn mysqli errors into exceptions, so we can catch them with try & catch
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// ///////////////////

//!: connecting
try {
    $DBConnection = mysqli_connect(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);

    // to include arabic if the user name in arabic
    mysqli_set_charset($DBConnection, 'utf8mb4');

    // Make MySQL use the same clock format as PHP (ex: "+03:00")
    $phpTimezoneFormat = date('P');
    mysqli_query($DBConnection, "SET time_zone = '" . $phpTimezoneFormat . "'");
} catch (Throwable $connectionException) {
    error_log('Database connection failed: ' . $connectionException->getMessage());
    send_json_error('Could not connect to the database', 500);
}
