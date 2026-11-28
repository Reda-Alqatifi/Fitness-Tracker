<?php

//! to stop a second load
if (defined('RESPONSE_HELPERS_LOADED')) {
    return;
}
define('RESPONSE_HELPERS_LOADED', true);

// Never print PHP errors or warnings into the page (they may break the JSON)
ini_set('display_errors', '0');

// ///////////////////

//! Send any data as JSON and stop the script.
//! "never" needs PHP update > 8.1 to work
function send_json_response($responseData, int $httpStatusCode = 200): never
{
    http_response_code($httpStatusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($responseData, JSON_UNESCAPED_UNICODE);
    exit;
}

// ///////////////////

//! Send { "message": "..." } with an error status code and stop the script.
//! "never" needs PHP update > 8.1 to work
function send_json_error(string $errorMessage, int $httpStatusCode = 400): never
{
    send_json_response(['message' => $errorMessage], $httpStatusCode);
}

// ////////////////

//! Stop with when the request uses a wrong method (ex: GET on a POST endpoint).
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

// /////////////////

//! print/log the server error.
//! "never" needs PHP update > 8.1 to work
function handle_server_error(Throwable $caughtException): never
{
    error_log(
        $caughtException->getMessage()
        . ' in ' . $caughtException->getFile()
        . ':' . $caughtException->getLine()
    );
    send_json_error('Server error, please try again later', 500);
}

//! for safty, any error that no try/catch caught becomes a JSON (not a HTML error)
set_exception_handler('handle_server_error');
