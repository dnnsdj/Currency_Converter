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
    $cacheDirectory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'currency-converter-cache';
    $cacheFile = null;
    $lockHandle = null;

    if ((is_dir($cacheDirectory) || mkdir($cacheDirectory, 0700, true)) && is_writable($cacheDirectory)) {
        $cacheFile = $cacheDirectory . DIRECTORY_SEPARATOR . hash('sha256', $url) . '.json';
        $lockHandle = fopen($cacheFile . '.lock', 'c');
        if ($lockHandle === false) {
            error_log('Currency converter could not lock the upstream cache.');
            $lockHandle = null;
            $cacheFile = null;
        } elseif (!flock($lockHandle, LOCK_EX)) {
            error_log('Currency converter could not lock the upstream cache.');
            fclose($lockHandle);
            $lockHandle = null;
            $cacheFile = null;
        } else {
            $cachedContents = is_file($cacheFile) ? file_get_contents($cacheFile) : false;
            $cachedEntry = $cachedContents === false ? null : json_decode($cachedContents, true);
            if (is_array($cachedEntry) &&
                is_array($cachedEntry['data'] ?? null) &&
                is_int($cachedEntry['updatedAt'] ?? null) &&
                time() - $cachedEntry['updatedAt'] >= 0 &&
                time() - $cachedEntry['updatedAt'] < 45) {
                flock($lockHandle, LOCK_UN);
                fclose($lockHandle);
                return $cachedEntry;
            }
        }
    } else {
        error_log('Currency converter upstream cache directory is unavailable.');
    }

    $curl = curl_init($url);
    if ($curl === false) {
        sendJsonResponse(502, ['error' => 'Exchange rates are temporarily unavailable.']);
    }

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

    $cacheEntry = ['data' => $data, 'updatedAt' => time()];
    if ($cacheFile !== null && $lockHandle !== null) {
        $encodedEntry = json_encode($cacheEntry);
        $temporaryFile = $cacheFile . '.tmp';
        if ($encodedEntry === false ||
            file_put_contents($temporaryFile, $encodedEntry, LOCK_EX) === false ||
            !rename($temporaryFile, $cacheFile)) {
            error_log('Currency converter could not write the upstream cache.');
            if (is_file($temporaryFile)) {
                unlink($temporaryFile);
            }
        }
        flock($lockHandle, LOCK_UN);
        fclose($lockHandle);
    }

    return $cacheEntry;
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
$currencyConfigPath = __DIR__ . '/../config/currencies.json';
$currencyConfigContents = file_get_contents($currencyConfigPath);
if ($currencyConfigContents === false) {
    sendJsonResponse(500, ['error' => 'Currency configuration is unavailable.']);
}

$currencyConfig = json_decode($currencyConfigContents, true);
if (!is_array($currencyConfig)) {
    sendJsonResponse(500, ['error' => 'Currency configuration is invalid.']);
}

$supportedCurrencies = [];
$cryptoIds = [];
foreach ($currencyConfig as $currency) {
    if (!is_array($currency) || !isset($currency['code']) || !is_string($currency['code'])) {
        sendJsonResponse(500, ['error' => 'Currency configuration is invalid.']);
    }
    $supportedCurrencies[] = $currency['code'];
    if (isset($currency['cryptoId']) && is_string($currency['cryptoId'])) {
        $cryptoIds[$currency['code']] = $currency['cryptoId'];
    }
}

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
    $rateUpdatedAt = time();
} else {
    $needsCryptoRates = isset($cryptoIds[$fromCurrency]) || isset($cryptoIds[$toCurrency]);
    $needsFiatRates = !isset($cryptoIds[$fromCurrency]) || !isset($cryptoIds[$toCurrency]);
    $cryptoUsdPrices = [];
    $fiatRates = [];
    $rateUpdatedAt = null;

    if ($needsCryptoRates) {
        $cryptoIdsQuery = implode(',', array_unique(array_values($cryptoIds)));
        $cryptoResponse = fetchJson(
            'https://api.coingecko.com/api/v3/simple/price?ids=' . $cryptoIdsQuery . '&vs_currencies=usd'
        );
        $cryptoData = $cryptoResponse['data'];
        $rateUpdatedAt = $cryptoResponse['updatedAt'];

        foreach ($cryptoIds as $currency => $coinId) {
            $price = $cryptoData[$coinId]['usd'] ?? null;
            if (!is_numeric($price) || !is_finite((float) $price) || (float) $price <= 0) {
                sendJsonResponse(502, ['error' => 'The exchange-rate service returned invalid data.']);
            }
            $cryptoUsdPrices[$currency] = (float) $price;
        }
    }

    if ($needsFiatRates) {
        $exchangeResponse = fetchJson('https://open.er-api.com/v6/latest/USD');
        $exchangeData = $exchangeResponse['data'];
        $rateUpdatedAt = $rateUpdatedAt === null
            ? $exchangeResponse['updatedAt']
            : min($rateUpdatedAt, $exchangeResponse['updatedAt']);
        $rates = $exchangeData['rates'] ?? null;
        $fromFiatRate = isset($cryptoIds[$fromCurrency])
            ? 1.0
            : (is_array($rates) ? ($rates[$fromCurrency] ?? null) : null);
        $toFiatRate = isset($cryptoIds[$toCurrency])
            ? 1.0
            : (is_array($rates) ? ($rates[$toCurrency] ?? null) : null);

        if (($exchangeData['result'] ?? null) !== 'success' ||
            !is_numeric($fromFiatRate) || !is_numeric($toFiatRate) ||
            !is_finite((float) $fromFiatRate) || !is_finite((float) $toFiatRate) ||
            (float) $fromFiatRate <= 0 || (float) $toFiatRate <= 0 ||
            !isset($exchangeData['time_last_update_unix'])) {
            sendJsonResponse(502, ['error' => 'The exchange-rate service returned invalid data.']);
        }

        $fiatRates = [
            $fromCurrency => (float) $fromFiatRate,
            $toCurrency => (float) $toFiatRate,
        ];
        $rateDate = gmdate('Y-m-d', (int) $exchangeData['time_last_update_unix']);
    } else {
        $rateDate = gmdate('Y-m-d');
    }

    if ($rateUpdatedAt === null) {
        $rateUpdatedAt = time();
    }

    $fromUsd = isset($cryptoIds[$fromCurrency])
        ? $cryptoUsdPrices[$fromCurrency]
        : 1 / $fiatRates[$fromCurrency];
    $toUnitsPerUsd = isset($cryptoIds[$toCurrency])
        ? 1 / $cryptoUsdPrices[$toCurrency]
        : $fiatRates[$toCurrency];
    $rate = $fromUsd * $toUnitsPerUsd;
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
    'updatedAt' => $rateUpdatedAt,
]);
