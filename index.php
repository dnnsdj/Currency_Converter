<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Currency Converter</title>
    <link rel="stylesheet" href="css/style.css" />
  </head>

  <body>
    <main class="page">
      <div class="converter">
        <div class="converter__brand">
          <h2 class="converter__title">Currency Converter</h2>
          <p class="converter__subtitle">Convert currencies instantly</p>
        </div>

        <div class="converter__panel converter__panel--from">
          <h3 class="converter__label">From:</h3>

          <div class="converter__field">
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
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>

        <div class="converter__swap">
          <button type="button" class="converter__swap-btn">&#8645;</button>
        </div>

        <div class="converter__panel converter__panel--to">
          <h3 class="converter__label">To:</h3>

          <div class="converter__field">
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
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>

        <p id="rate-info" aria-live="polite"></p>
        <p id="error-message" role="alert"></p>
      </div>
    </main>
    <script src="js/script.js"></script>
  </body>
</html>
