<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Currency Converter</title>
    <link rel="stylesheet" href="css/style.css" />
  </head>

  <body>
    <header class="site-header">
      <div class="site-header__brand" aria-label="Dez">Dez</div>
      <h1 class="site-header__title">Currency_Converter</h1>
      <div class="site-header__meta" aria-label="Current date and time">
        <time class="site-header__time-pill" id="current-date"></time>
        <time class="site-header__time-pill" id="current-time"></time>
      </div>
    </header>

    <main class="page">
      <div class="converter">
        <div class="converter__intro">
          <h2 class="converter__title">Today's Rates</h2>
          <p class="converter__subtitle">Convert currencies instantly</p>
        </div>

        <div class="converter__panels">
          <div class="converter__panel converter__panel--from">
            <h3 class="converter__label">From:</h3>

            <div class="converter__field">
              <span class="converter__currency-symbol" id="from-symbol" aria-hidden="true"></span>
              <input
                type="number"
                name="amount"
                id="amount"
                placeholder="Enter amount"
                class="converter__input"
                min="0"
                step="any"
              />

              <select
                name="from-currency"
                id="from-currency"
                class="converter__select"
                aria-label="From currency"
              >
                <option value="BTC" data-icon="assets/currencies/btc.svg">BTC</option>
                <option value="USD" data-icon="assets/currencies/usd.svg">USD</option>
                <option value="GBP" data-icon="assets/currencies/gbp.svg">GBP</option>
                <option value="EUR" data-icon="assets/currencies/eur.svg">EUR</option>
                <option value="GHS" data-icon="assets/currencies/ghs.svg" selected>GHS</option>
              </select>
            </div>
          </div>

          <div class="converter__panel converter__panel--to">
            <h3 class="converter__label">To:</h3>

            <div class="converter__field">
              <span class="converter__currency-symbol" id="to-symbol" aria-hidden="true"></span>
              <input
                type="text"
                id="result"
                placeholder="Converted amount"
                class="converter__input"
                readonly
              />

              <select
                name="to-currency"
                id="to-currency"
                class="converter__select"
                aria-label="To currency"
              >
                <option value="BTC" data-icon="assets/currencies/btc.svg">BTC</option>
                <option value="USD" data-icon="assets/currencies/usd.svg" selected>USD</option>
                <option value="GBP" data-icon="assets/currencies/gbp.svg">GBP</option>
                <option value="EUR" data-icon="assets/currencies/eur.svg">EUR</option>
                <option value="GHS" data-icon="assets/currencies/ghs.svg">GHS</option>
              </select>
            </div>
          </div>

          <div class="converter__swap">
            <button type="button" class="converter__swap-btn" aria-label="Swap currencies">&#8645;</button>
          </div>
        </div>

        <p id="rate-info" class="converter__message converter__message--rate" aria-live="polite"></p>
        <p id="error-message" class="converter__message converter__message--error" role="alert"></p>
      </div>
    </main>
    <script src="js/script.js"></script>
  </body>
</html>
