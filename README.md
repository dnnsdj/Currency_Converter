# Currency Converter

A small PHP and browser-based currency converter for fiat and cryptocurrency rates.

## Requirements

- PHP 7.4 or newer with the cURL extension enabled
- A web server that runs PHP (the built-in PHP server is suitable for local use)
- Internet access for live rates from [CoinGecko](https://www.coingecko.com/) and [ExchangeRate-API](https://www.exchangerate-api.com/)

## Run locally

From the project directory, start PHP's built-in web server:

```sh
php -S localhost:8000
```

Open <http://localhost:8000> in a browser. Service workers are available on localhost and HTTPS; opening `index.html` directly as a file does not support the offline features.

## Features

- Converts among the currencies in [`config/currencies.json`](config/currencies.json). That file supplies both the browser's selector and the server's validation and crypto identifiers.
- Debounces amount input by 300 ms to avoid unnecessary conversion requests.
- Caches each upstream API response on the server for 45 seconds in the system temporary directory.
- Shows when the displayed rates were last fetched and provides a refresh button.
- Supports a persisted light/dark theme.
- Uses a service worker to cache the app shell and the most recent successful rate for each currency pair. Previously requested pairs can still be converted offline; an uncached pair needs a network connection.

The rates shown offline retain their original update time. Refreshing requests the latest available server-side cached rates; upstream data is fetched again once its 45-second cache expires.

## API

`POST /api/convert.php` accepts a JSON body:

```json
{
  "amount": "10",
  "from": "GHS",
  "to": "USD"
}
```

Successful responses contain `from`, `to`, `rate`, `converted`, `date`, and the Unix timestamp `updatedAt`. Invalid amounts or unsupported currency codes return a JSON error and an appropriate HTTP status.
