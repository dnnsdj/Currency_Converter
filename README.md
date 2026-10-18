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
- Refreshes the selected pair on startup and every 30 minutes, and provides a manual refresh button.
- Supports a persisted light/dark theme.
- Offers an animated light/dark switch and English/French interface; both preferences are saved locally.
- Stores successful currency-pair rates locally and in the service worker cache so previously loaded pairs remain available offline.
- Includes locally hosted Font Awesome Free 6.7.2 icons for offline use (see [`assets/fontawesome/LICENSE.txt`](assets/fontawesome/LICENSE.txt)).

The rates shown offline retain their original update time. Automatic and manual refreshes request the latest available server-side rates; upstream data is fetched again once its 45-second cache expires. A saved rate is used when a refresh cannot reach the network.

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
