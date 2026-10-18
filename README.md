# Currency Converter

A small PHP and browser-based currency converter for fiat and cryptocurrency rates.

## Requirements

- PHP 7.4 or newer with the cURL extension enabled
- The PDO SQLite extension
- A web server that runs PHP (the built-in PHP server is suitable for local use)
- Internet access for live rates from [CoinGecko](https://www.coingecko.com/) and [ExchangeRate-API](https://www.exchangerate-api.com/)
- A working PHP `mail()` setup and a scheduler for email alerts

## Run locally

From the project directory, start PHP's built-in web server:

```sh
php -S localhost:8000
```

Open <http://localhost:8000> in a browser. Service workers are available on localhost and HTTPS; opening `index.html` directly as a file does not support the offline features.

## Email rate alerts

Users can create one-time alerts for a selected currency pair:

- A target alert fires when a rate crosses above or below a target.
- A percentage alert fires when the rate moves up, down, or either way by a chosen percentage from the rate at signup.
- Alerts require email confirmation and are deactivated after the alert email is sent. The confirmation email also contains a cancellation link.

Set these environment variables for the PHP web server and scheduled task:

| Variable | Purpose |
| --- | --- |
| `CURRENCY_CONVERTER_BASE_URL` | Public application base URL, such as `https://example.com` (use `http://localhost:8000` for local development). |
| `CURRENCY_CONVERTER_MAIL_FROM` | Valid sender address for PHP `mail()`, such as `rates@example.com`. |
| `CURRENCY_CONVERTER_ALERT_DB` | Optional absolute path to a persistent SQLite database outside the public web root. If unset, the database is placed under the operating system's temporary directory. |

PHP `mail()` must be configured to deliver outgoing messages. The SQLite database directory and file are created with restricted permissions. Set `CURRENCY_CONVERTER_ALERT_DB` to a durable, private location in production; the default temporary directory may be cleared by the host.

Schedule `php /path/to/Currency_Converter/bin/check-rate-alerts.php` to run every five minutes. For example, a Unix cron entry is:

```cron
*/5 * * * * CURRENCY_CONVERTER_BASE_URL=https://example.com CURRENCY_CONVERTER_MAIL_FROM=rates@example.com CURRENCY_CONVERTER_ALERT_DB=/var/lib/currency-converter/alerts.sqlite /usr/bin/php /path/to/Currency_Converter/bin/check-rate-alerts.php
```

Configure the same variables for the web server process. The monitor checks the latest rate at each run, so alert timing depends on the scheduler and brief rate movements between checks may not be observed. Pending email confirmations expire after 24 hours.

## Features

- Converts among the currencies in [`config/currencies.json`](config/currencies.json). That file supplies both the browser's selector and the server's validation and crypto identifiers.
- Debounces amount input by 300 ms to avoid unnecessary conversion requests.
- Caches each upstream API response on the server for 45 seconds in the system temporary directory.
- Shows when the displayed rates were last fetched and provides a refresh button.
- Supports a persisted light/dark theme.
- Offers an animated light/dark switch and English/French interface; both preferences are saved locally.
- Uses a service worker to cache the app shell and the most recent successful rate for each currency pair. Previously requested pairs can still be converted offline; an uncached pair needs a network connection.
- Provides email alerts for target-rate crossings and percentage moves, with confirmation and scheduled checks.

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

`POST /api/alerts.php` accepts JSON with `action: "subscribe"`, `email`, `from`, `to`, `alertType` (`"target"` or `"percent"`), `direction` (`"above"`/`"below"` for target alerts; `"up"`/`"down"`/`"either"` for percentage alerts), and a positive `threshold`. New alerts are pending until the recipient confirms by email.
