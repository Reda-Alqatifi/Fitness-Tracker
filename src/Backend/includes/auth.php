<?php

//! to stop a second load
if (defined('AUTH_HELPERS_LOADED')) {
    return;
}
define('AUTH_HELPERS_LOADED', true);

//! include respone.php
require_once __DIR__ . '/response.php';

//! "Remember me" to keep the login for 30 days (in seconds).
const REMEMBER_SESSION = 60 * 60 * 24 * 30;

// //////////////////////

//! Start the session with safe cookie settings
//! Cookie settings only work BEFORE "session_start()", so call this before anything else.
function start_user_session(bool $rememberUser = false): void
{
    //! if already logged in
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $cookieLifetime = 0; //! it is in seconds - (0 = until the browser closed)
    if ($rememberUser) {
        $cookieLifetime = REMEMBER_SESSION;
    }

    // The server keeps session data for 30 days
    ini_set('session.gc_maxlifetime', (string) REMEMBER_SESSION);

    // to not accept session ids that the server did not create.
    ini_set('session.use_strict_mode', '1');

    session_set_cookie_params([
        'lifetime' => $cookieLifetime,
        'path' => '/',
        'httponly' => true, // JavaScript cannot read the cookie
        'samesite' => 'Lax', // basic protection against outside links oe something like
    ]);
    session_start();
}

// ////////////////////////

//! Save the user id in the session after a correct login or registration.
function log_in_user(int $userId, bool $rememberUser): void
{
    start_user_session($rememberUser);

    // New session id after login
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;

    // If the session was already started before this call, its cookie settings
    // could not be changed, so send the long-lived cookie by hand.
    if ($rememberUser) {
        setcookie(session_name(), session_id(), [
            'expires'  => time() + REMEMBER_SESSION,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
}

// ////////////////////////

//! Return the logged-in user id, or stop with 401 { "message": ... }.
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

// /////////////////////

//! to forget the user completely: session data, cookie and server-side session
function log_out_user(): void
{
    start_user_session();

    //! Remove the data from the session.
    $_SESSION = [];

    //! tell the browser to delete the session cookie
    $cookieSettings = session_get_cookie_params();
    setcookie(
        session_name(), 
        '', 
        [
        'expires' => time() - 42000,
        'path' => $cookieSettings['path'],
        'domain' => $cookieSettings['domain'],
        'secure' => $cookieSettings['secure'],
        'httponly' => true,
        'samesite' => 'Lax',
        ]
    );

    //! Destroy the session on the server.
    session_destroy();
}
