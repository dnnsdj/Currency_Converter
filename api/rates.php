<?php

function getCurrencyConfig()
{
    $configContents = file_get_contents(__DIR__ . '/../config/currencies.json');
    if ($configContents === false) {
        throw new RuntimeException('Currency configuration is unavailable.');
    }

    $currencyConfig = json_decode($configContents, true);
    if (!is_array($currencyConfig) || count($currencyConfig) === 0) {
        throw new RuntimeException('Currency configuration is invalid.');
    }

    foreach ($currencyConfig as $currency) {
        if (!is_array($currency) ||
            !isset($currency['code']) ||
            !is_string($currency['code']) ||
            !preg_match('/^[A-Z]{3,5}$/', $currency['code'])) {
            throw new RuntimeException('Currency configuration is invalid.');
        }
    }

    return $currencyConfig;
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
        if ($lockHandle !== null) {
            flock($lockHandle, LOCK_UN);
            fclose($lockHandle);
        }
        throw new RuntimeException('Exchange rates are temporarily unavailable.');
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
        if ($lockHandle !== null) {
            flock($lockHandle, LOCK_UN);
            fclose($lockHandle);
        }
        throw new RuntimeException('Exchange rates are temporarily unavailable.');
    }

    $data = json_decode($body, true);
    if (!is_array($data)) {
        if ($lockHandle !== null) {
            flock($lockHandle, LOCK_UN);
            fclose($lockHandle);
        }
        throw new RuntimeException('The exchange-rate service returned invalid data.');
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

function getExchangeRate($fromCurrency, $toCurrency, $currencyConfig)
{
    $cryptoIds = [];
    foreach ($currencyConfig as $currency) {
        if (isset($currency['cryptoId']) && is_string($currency['cryptoId'])) {
            $cryptoIds[$currency['code']] = $currency['cryptoId'];
        }
    }

    if ($fromCurrency === $toCurrency) {
        return [
            'rate' => 1.0,
            'date' => gmdate('Y-m-d'),
            'updatedAt' => time(),
        ];
    }

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
        foreach ($cryptoIds as $currency => $coinId) {
            $price = $cryptoResponse['data'][$coinId]['usd'] ?? null;
            if (!is_numeric($price) || !is_finite((float) $price) || (float) $price <= 0) {
                throw new RuntimeException('The exchange-rate service returned invalid data.');
            }
            $cryptoUsdPrices[$currency] = (float) $price;
        }
        $rateUpdatedAt = $cryptoResponse['updatedAt'];
    }

    if ($needsFiatRates) {
        $exchangeResponse = fetchJson('https://open.er-api.com/v6/latest/USD');
        $exchangeData = $exchangeResponse['data'];
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
            throw new RuntimeException('The exchange-rate service returned invalid data.');
        }

        $fiatRates = [
            $fromCurrency => (float) $fromFiatRate,
            $toCurrency => (float) $toFiatRate,
        ];
        $rateUpdatedAt = $rateUpdatedAt === null
            ? $exchangeResponse['updatedAt']
            : min($rateUpdatedAt, $exchangeResponse['updatedAt']);
        $rateDate = gmdate('Y-m-d', (int) $exchangeData['time_last_update_unix']);
    } else {
        $rateDate = gmdate('Y-m-d');
    }

    $fromUsd = isset($cryptoIds[$fromCurrency])
        ? $cryptoUsdPrices[$fromCurrency]
        : 1 / $fiatRates[$fromCurrency];
    $toUnitsPerUsd = isset($cryptoIds[$toCurrency])
        ? 1 / $cryptoUsdPrices[$toCurrency]
        : $fiatRates[$toCurrency];
    $rate = $fromUsd * $toUnitsPerUsd;

    if (!is_finite($rate) || $rate <= 0) {
        throw new RuntimeException('The exchange-rate service returned invalid data.');
    }

    return [
        'rate' => $rate,
        'date' => $rateDate,
        'updatedAt' => $rateUpdatedAt ?? time(),
    ];
}
