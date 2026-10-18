<?php
header('Content-Type: application/json; charset=utf-8');

function sendJsonResponse($statusCode, $response)
{
    http_response_code($statusCode);
    echo json_encode($response);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    sendJsonResponse(405, ['error' => 'Only POST requests are supported.']);
}

$request = json_decode(file_get_contents('php://input'), true);
if (!is_array($request)) {
    sendJsonResponse(400, ['error' => 'Request body must be valid JSON.']);
}

$amountValue = $request['amount'] ?? null;
$fromCurrency = $request['from'] ?? null;
$toCurrency = $request['to'] ?? null;

try {
    require_once __DIR__ . '/rates.php';
    $currencyConfig = getCurrencyConfig();
} catch (RuntimeException $error) {
    error_log($error->getMessage());
    sendJsonResponse(500, ['error' => 'Currency configuration is unavailable.']);
}

$supportedCurrencies = array_column($currencyConfig, 'code');
if (!is_numeric($amountValue) || !is_finite((float) $amountValue) || (float) $amountValue <= 0) {
    sendJsonResponse(400, ['error' => 'Enter an amount greater than zero.']);
}

if (!in_array($fromCurrency, $supportedCurrencies, true) ||
    !in_array($toCurrency, $supportedCurrencies, true)) {
    sendJsonResponse(400, ['error' => 'Choose a supported currency.']);
}

$amount = (float) $amountValue;
try {
    $rateData = getExchangeRate($fromCurrency, $toCurrency, $currencyConfig);
} catch (RuntimeException $error) {
    error_log($error->getMessage());
    sendJsonResponse(502, ['error' => $error->getMessage()]);
}

$converted = $amount * $rateData['rate'];
if (!is_finite($converted)) {
    sendJsonResponse(400, ['error' => 'The converted amount is too large.']);
}

sendJsonResponse(200, [
    'from' => $fromCurrency,
    'to' => $toCurrency,
    'rate' => $rateData['rate'],
    'converted' => $converted,
    'date' => $rateData['date'],
    'updatedAt' => $rateData['updatedAt'],
]);
