<?php
header('Content-Type: application/json; charset=utf-8');

function sendJsonResponse($statusCode, $response)
{
    http_response_code($statusCode);
    echo json_encode($response);
    exit;
}

function fetchJson($url)
{
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_USERAGENT => 'CurrencyConverter/1.0',
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
    ]);

    $body = curl_exec($curl);
    $statusCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);

    if ($body === false || $statusCode < 200 || $statusCode >= 300) {
        sendJsonResponse(502, ['error' => 'Exchange rates are temporarily unavailable.']);
    }

    $data = json_decode($body, true);
    if (!is_array($data)) {
        sendJsonResponse(502, ['error' => 'The exchange-rate service returned invalid data.']);
    }

    return $data;
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
$supportedCurrencies = ['BTC', 'USD', 'GBP', 'EUR', 'GHS'];

if (!is_numeric($amountValue) || !is_finite((float) $amountValue) || (float) $amountValue <= 0) {
    sendJsonResponse(400, ['error' => 'Enter an amount greater than zero.']);
}

if (!in_array($fromCurrency, $supportedCurrencies, true) || !in_array($toCurrency, $supportedCurrencies, true)) {
    sendJsonResponse(400, ['error' => 'Choose a supported currency.']);
}

$amount = (float) $amountValue;
if ($fromCurrency === $toCurrency) {
    $rate = 1.0;
    $rateDate = date('Y-m-d');
} elseif ($fromCurrency === 'BTC' || $toCurrency === 'BTC') {
    $exchangeData = fetchJson('https://api.coingecko.com/api/v3/exchange_rates');
    $bitcoinRates = $exchangeData['rates'] ?? null;

    if (!is_array($bitcoinRates)) {
        sendJsonResponse(502, ['error' => 'The exchange-rate service returned invalid data.']);
    }

    $fromRate = $fromCurrency === 'BTC'
        ? 1.0
        : ($bitcoinRates[strtolower($fromCurrency)]['value'] ?? null);
    $toRate = $toCurrency === 'BTC'
        ? 1.0
        : ($bitcoinRates[strtolower($toCurrency)]['value'] ?? null);

    if (!is_numeric($fromRate) || !is_numeric($toRate) ||
        !is_finite((float) $fromRate) || !is_finite((float) $toRate) ||
        (float) $fromRate <= 0 || (float) $toRate <= 0) {
        sendJsonResponse(502, ['error' => 'The exchange-rate service returned invalid data.']);
    }

    $rate = (float) $toRate / (float) $fromRate;
    $rateDate = gmdate('Y-m-d');
} else {
    $exchangeData = fetchJson('https://open.er-api.com/v6/latest/USD');
    $fiatRates = $exchangeData['rates'] ?? null;
    $fromRate = is_array($fiatRates) ? ($fiatRates[$fromCurrency] ?? null) : null;
    $toRate = is_array($fiatRates) ? ($fiatRates[$toCurrency] ?? null) : null;

    if (($exchangeData['result'] ?? null) !== 'success' ||
        !is_numeric($fromRate) || !is_numeric($toRate) ||
        !is_finite((float) $fromRate) || !is_finite((float) $toRate) ||
        (float) $fromRate <= 0 || (float) $toRate <= 0 ||
        !isset($exchangeData['time_last_update_unix'])) {
        sendJsonResponse(502, ['error' => 'The exchange-rate service returned invalid data.']);
    }

    $rate = (float) $toRate / (float) $fromRate;
    $rateDate = gmdate('Y-m-d', (int) $exchangeData['time_last_update_unix']);
}

$converted = $amount * $rate;
if (!is_finite($converted)) {
    sendJsonResponse(400, ['error' => 'The converted amount is too large.']);
}

sendJsonResponse(200, [
    'from' => $fromCurrency,
    'to' => $toCurrency,
    'rate' => $rate,
    'converted' => $converted,
    'date' => $rateDate,
]);
