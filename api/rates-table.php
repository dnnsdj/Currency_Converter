<?php
require_once __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=utf-8');

function sendRateTableJsonResponse($statusCode, $response)
{
    http_response_code($statusCode);
    echo json_encode($response);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    sendRateTableJsonResponse(405, ['error' => 'Only GET requests are supported.']);
}

try {
    require_once __DIR__ . '/rates.php';
    $currencyConfig = getCurrencyConfig();
    $rateTable = getExchangeRateTable($currencyConfig);
} catch (RuntimeException $error) {
    error_log($error->getMessage());
    sendRateTableJsonResponse(502, ['error' => $error->getMessage()]);
}

sendRateTableJsonResponse(200, $rateTable);
