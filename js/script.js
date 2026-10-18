const amountInput = document.querySelector("#amount");
const resultInput = document.querySelector("#result");
const fromCurrency = document.querySelector("#from-currency");
const toCurrency = document.querySelector("#to-currency");
const swapButton = document.querySelector(".converter__swap-btn");
const rateInfoFrom = document.querySelector("#rate-info-from");
const rateInfoTo = document.querySelector("#rate-info-to");
const errorNotification = document.querySelector("#error-notification");
const errorMessage = document.querySelector("#error-message");
const dismissErrorButton = document.querySelector("#dismiss-error");
const currentDate = document.querySelector("#current-date");
const currentTime = document.querySelector("#current-time");
const fromSymbol = document.querySelector("#from-symbol");
const toSymbol = document.querySelector("#to-symbol");
const lastUpdated = document.querySelector("#last-updated");
const rateRow = document.querySelector(".converter__rate-row");
const refreshButton = document.querySelector("#refresh-rates");
const copyButton = document.querySelector("#copy-result");
const copyLabel = document.querySelector("#copy-label");
const exportRatesButton = document.querySelector("#export-rates");
const importRatesButton = document.querySelector("#import-rates");
const importRatesFile = document.querySelector("#import-rates-file");
const themeLightButton = document.querySelector("#theme-light");
const themeDarkButton = document.querySelector("#theme-dark");
const languageSelect = document.querySelector("#language-select");
const headerMenuToggle = document.querySelector("#header-menu-toggle");
const headerTools = document.querySelector("#header-tools");
const RATE_STORAGE_KEY = "currency-converter-rates";
const RATE_TABLE_STORAGE_KEY = "currency-converter-rate-table";
const RATE_DATABASE_NAME = "currency-converter";
const RATE_DATABASE_STORE = "rate-tables";
const CURRENCY_STORAGE_KEY = "currency-converter-currencies";
const RATE_REFRESH_INTERVAL = 30 * 60 * 1000;
const CONVERSION_API_URL = window.location.hostname === "dnnsdj.github.io"
    ? "https://currency-converter-api-nvun.onrender.com/api/convert.php"
    : "api/convert.php";
const RATE_TABLE_API_URL = CONVERSION_API_URL.replace(/convert\.php$/, "rates-table.php");

let requestId = 0;
let debounceTimer;
let latestUpdatedAt = null;
let latestWasOffline = false;
let latestRate = null;
let latestError = null;
let savedRates = {};
let savedRateTable = null;
let configuredCurrencyCodes = [];
let lastRateTableAttemptAt = 0;
let rateTableRefreshUnavailable = false;
let currencyPrecision = {};
let currencySymbols = {};
let currentLanguage = "en";
let currencyPickers = [];
let editedSide = "from";
let copyResetTimer;
let errorTimer;
let errorTimerStartedAt;
let errorTimeRemaining = 10_000;
let errorTimerPaused = false;
let errorHovered = false;
let errorFocused = false;

const translations = {
    en: {
        clockLabel: "Current date and time",
        themeLabel: "Color theme",
        openSettings: "Open settings",
        light: "Light",
        dark: "Dark",
        language: "Language",
        ratesTitle: "Make every cedi count",
        alertTitle: "Alert",
        converterSubtitle: "Fast, clear conversions between the cedi, major currencies and crypto.",
        eyebrow: "Live rates · Fiat & crypto",
        quickAmounts: "Quick amounts",
        copy: "Copy result",
        copied: "Copied",
        exportRates: "Export rates",
        importRates: "Import rates",
        rateBackup: "Rate backup",
        liveRates: "Live now — your money at today's rate.",
        footerNote: "Indicative rates for information only. Sources: ExchangeRate-API and CoinGecko.",
        from: "Base currency",
        to: "Quote currency",
        fromCurrency: "Base currency",
        toCurrency: "Quote currency",
        amountLabel: "Amount in base currency",
        amountPlaceholder: "0.00",
        resultLabel: "Converted amount in quote currency",
        resultPlaceholder: "0.00",
        swap: "Swap base and quote currencies",
        refresh: "Refresh rates",
        rateDate: "Rate date",
        lastUpdated: "Last updated",
        offlineRates: "Offline - rates from",
        lessThanMinute: "less than a minute ago",
        minuteAgo: "minute",
        minutesAgo: "minutes",
        converting: "Converting...",
        enterAmount: "Enter an amount greater than or equal to zero.",
        dismiss: "Dismiss",
        conversionFailed: "Conversion failed.",
        invalidResponse: "Received an invalid response from the server.",
        connectionError: "Unable to connect to the server.",
        initializeError: "Unable to initialize the currency converter.",
        loadCurrenciesError: "Unable to load the currency list.",
        invalidCurrencies: "The currency list is invalid.",
        rateTableUnavailable: "Full rates are not available yet.",
        invalidRateTable: "The rates file is invalid or does not include every configured currency.",
        importRatesError: "Could not import the rates file.",
        exportRatesError: "No saved rate table is available to export."
    },
    fr: {
        clockLabel: "Date et heure actuelles",
        themeLabel: "Thème de couleur",
        openSettings: "Ouvrir les paramètres",
        light: "Clair",
        dark: "Sombre",
        language: "Langue",
        ratesTitle: "Faites compter chaque cedi",
        alertTitle: "Alerte",
        converterSubtitle: "Des conversions rapides et claires entre le cedi, les grandes devises et la crypto.",
        eyebrow: "Taux en direct · Devises & crypto",
        quickAmounts: "Montants rapides",
        copy: "Copier le résultat",
        copied: "Copié",
        exportRates: "Exporter les taux",
        importRates: "Importer les taux",
        rateBackup: "Sauvegarde des taux",
        liveRates: "En direct — votre argent au taux du jour.",
        footerNote: "Taux indicatifs, à titre d'information. Sources : ExchangeRate-API et CoinGecko.",
        from: "Devise de base",
        to: "Devise de cotation",
        fromCurrency: "Devise de base",
        toCurrency: "Devise de cotation",
        amountLabel: "Montant en devise de base",
        amountPlaceholder: "0.00",
        resultLabel: "Montant converti en devise de cotation",
        resultPlaceholder: "0.00",
        swap: "Inverser les devises de base et de cotation",
        refresh: "Actualiser les taux",
        rateDate: "Date du taux",
        lastUpdated: "Dernière mise à jour",
        offlineRates: "Hors ligne - taux du",
        lessThanMinute: "il y a moins d'une minute",
        minuteAgo: "minute",
        minutesAgo: "minutes",
        converting: "Conversion en cours...",
        enterAmount: "Saisissez un montant supérieur ou égal à zéro.",
        dismiss: "Fermer",
        conversionFailed: "Échec de la conversion.",
        invalidResponse: "Le serveur a renvoyé une réponse invalide.",
        connectionError: "Impossible de se connecter au serveur.",
        initializeError: "Impossible d'initialiser le convertisseur.",
        loadCurrenciesError: "Impossible de charger la liste des devises.",
        invalidCurrencies: "La liste des devises est invalide.",
        rateTableUnavailable: "Les taux complets ne sont pas encore disponibles.",
        invalidRateTable: "Le fichier des taux est invalide ou incomplet.",
        importRatesError: "Impossible d'importer le fichier des taux.",
        exportRatesError: "Aucune table de taux enregistrée à exporter."
    }
};

function translate(key) {
    return translations[currentLanguage][key] || translations.en[key] || key;
}

function translateErrorMessage(message) {
    const key = Object.keys(translations.en).find((translationKey) =>
        translations.en[translationKey] === message ||
        translations.fr[translationKey] === message
    );
    return key ? translate(key) : translateServerMessage(message);
}

function clearErrorTimer() {
    window.clearTimeout(errorTimer);
    errorTimer = null;
    errorTimerStartedAt = null;
}

function startErrorTimer() {
    if (errorTimer || errorTimerPaused || errorNotification.hidden) return;

    errorTimerStartedAt = Date.now();
    errorTimer = window.setTimeout(() => {
        errorNotification.hidden = true;
        clearErrorTimer();
        errorTimeRemaining = 10_000;
    }, errorTimeRemaining);
}

function pauseErrorTimer() {
    if (errorTimerPaused) return;
    errorTimerPaused = true;
    if (errorTimer) {
        errorTimeRemaining = Math.max(0, errorTimeRemaining - (Date.now() - errorTimerStartedAt));
        clearErrorTimer();
    }
}

function resumeErrorTimer() {
    if (!errorTimerPaused) return;
    errorTimerPaused = false;
    startErrorTimer();
}

function updateErrorTimerPause() {
    if (errorHovered || errorFocused) pauseErrorTimer();
    else resumeErrorTimer();
}

function setErrorMessage(message) {
    clearErrorTimer();
    errorTimeRemaining = 10_000;
    if (!message) {
        errorTimerPaused = false;
        errorHovered = false;
        errorFocused = false;
    }
    errorMessage.textContent = message;
    errorNotification.hidden = !message;
    if (message) startErrorTimer();
}

function translateServerMessage(message) {
    const frenchMessages = {
        "Enter an amount greater than zero.": "Saisissez un montant supérieur à zéro.",
        "Enter an amount greater than or equal to zero.":
            "Saisissez un montant supérieur ou égal à zéro.",
        "Choose a supported currency.": "Choisissez une devise prise en charge.",
        "The current rate is unavailable. Please try again.": "Le taux actuel est indisponible. Réessayez.",
        "Exchange rates are temporarily unavailable.": "Les taux de change sont temporairement indisponibles.",
        "The exchange-rate service returned invalid data.":
            "Le service de change a renvoyé des données invalides.",
        "The converted amount is too large.": "Le montant converti est trop élevé.",
        "Request body must be valid JSON.": "Le corps de la requête doit être un JSON valide.",
        "Only POST requests are supported.": "Seules les requêtes POST sont acceptées."
    };
    return currentLanguage === "fr" ? (frenchMessages[message] || message) : message;
}

function applyLanguage(language, persist = false) {
    currentLanguage = language === "fr" ? "fr" : "en";
    document.documentElement.lang = currentLanguage;
    document.title = currentLanguage === "fr" ? "Convertisseur de devises" : "Currency Converter";

    document.querySelectorAll("[data-i18n]").forEach((element) => {
        element.textContent = translate(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
        element.setAttribute("aria-label", translate(element.dataset.i18nAriaLabel));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
        element.placeholder = translate(element.dataset.i18nPlaceholder);
    });
    window.clearTimeout(copyResetTimer);
    copyLabel.textContent = translate("copy");

    languageSelect.value = currentLanguage;
    updateHeaderClock();
    updatePickerLanguage();
    updateLastUpdated();
    updateRateInfo();
    if (!errorNotification.hidden && latestError) {
        errorMessage.textContent = translateErrorMessage(latestError);
    }
    if (persist) {
        try {
            localStorage.setItem("currency-converter-language", currentLanguage);
        } catch (error) {
            console.error("Could not save the language preference:", error);
        }
    }
}

function updatePickerLanguage() {
    currencyPickers.forEach(({ updateLanguage }) => updateLanguage());
}

function initializeLanguage() {
    let savedLanguage = "en";
    try {
        savedLanguage = localStorage.getItem("currency-converter-language") || "en";
    } catch (error) {
        console.error("Could not load the saved language preference:", error);
    }
    applyLanguage(savedLanguage);
    languageSelect.addEventListener("change", () => applyLanguage(languageSelect.value, true));
}

function updateHeaderClock() {
    const now = new Date();
    const locale = currentLanguage === "fr" ? "fr-FR" : "en-US";
    const dateFormatter = new Intl.DateTimeFormat(locale, {
        timeZone: "UTC",
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });
    const timeFormatter = new Intl.DateTimeFormat(locale, {
        timeZone: "UTC",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h12"
    });

    currentDate.textContent = dateFormatter.format(now);
    currentDate.dateTime = now.toISOString().slice(0, 10);
    currentTime.textContent = `${timeFormatter.format(now)} GMT`;
    currentTime.dateTime = now.toISOString();
}

function applyTheme(theme, persist = false) {
    const isDark = theme === "dark";
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    themeLightButton.setAttribute("aria-pressed", String(!isDark));
    themeDarkButton.setAttribute("aria-pressed", String(isDark));
    if (persist) {
        try {
            localStorage.setItem("currency-converter-theme", theme);
        } catch (error) {
            console.error("Could not save the theme preference:", error);
        }
    }
}

function initializeTheme() {
    let savedTheme = null;
    try {
        savedTheme = localStorage.getItem("currency-converter-theme");
    } catch (error) {
        console.error("Could not load the saved theme preference:", error);
    }
    const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    applyTheme(savedTheme === "dark" || savedTheme === "light" ? savedTheme : preferredTheme);

    themeLightButton.addEventListener("click", () => applyTheme("light", true));
    themeDarkButton.addEventListener("click", () => applyTheme("dark", true));
}

function initializeHeaderMenu() {
    const closeMenu = () => {
        headerTools.classList.remove("is-open");
        headerMenuToggle.setAttribute("aria-expanded", "false");
    };

    headerMenuToggle.addEventListener("click", () => {
        const isOpen = headerTools.classList.toggle("is-open");
        headerMenuToggle.setAttribute("aria-expanded", String(isOpen));
    });
    document.addEventListener("click", (event) => {
        if (!headerTools.contains(event.target) && !headerMenuToggle.contains(event.target)) {
            closeMenu();
        }
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && headerTools.classList.contains("is-open")) {
            closeMenu();
            headerMenuToggle.focus();
        }
    });
}

function initializeCurrencyPicker(select, labelKey) {
    const picker = document.createElement("div");
    picker.className = "currency-picker";
    select.before(picker);
    picker.append(select);
    select.classList.add("converter__select--enhanced");
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.id = `${select.id}-control`;
    trigger.className = "currency-picker__trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    picker.append(trigger);

    const fieldLabel = document.querySelector(`label[for="${select.id}"]`);
    if (fieldLabel) fieldLabel.htmlFor = trigger.id;

    const menu = document.createElement("div");
    menu.className = "currency-picker__menu";
    menu.id = `${select.id}-options`;
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", translate(labelKey));
    menu.hidden = true;
    trigger.setAttribute("aria-controls", menu.id);
    picker.append(menu);

    const options = Array.from(select.options).map((option, index) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "currency-picker__option";
        item.setAttribute("role", "option");
        item.dataset.value = option.value;
        item.style.setProperty("--option-index", String(Math.min(index, 5)));

        const icon = document.createElement("img");
        icon.src = option.dataset.icon;
        icon.alt = "";
        icon.width = 24;
        icon.height = 24;
        icon.setAttribute("aria-hidden", "true");

        const code = document.createElement("span");
        code.textContent = option.textContent;
        item.append(icon, code);
        menu.append(item);

        item.addEventListener("click", () => {
            if (item.disabled) return;

            select.value = option.value;
            select.dispatchEvent(new Event("change", { bubbles: true }));
            updatePicker();
            closePicker(true);
        });

        return { item, option };
    });

    function updatePicker() {
        const selectedOption = select.selectedOptions[0];
        const icon = document.createElement("img");
        icon.src = selectedOption.dataset.icon;
        icon.alt = "";
        icon.width = 24;
        icon.height = 24;
        icon.setAttribute("aria-hidden", "true");

        const code = document.createElement("span");
        code.textContent = selectedOption.textContent;
        const arrow = document.createElement("span");
        arrow.className = "currency-picker__arrow";
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = "\u25BE";

        trigger.replaceChildren(icon, code, arrow);
        trigger.setAttribute("aria-label", `${translate(labelKey)}: ${selectedOption.textContent}`);
        options.forEach(({ item, option }) => {
            const isSelected = option.value === select.value;
            item.setAttribute("aria-selected", String(isSelected));
            item.tabIndex = isSelected && !item.disabled ? 0 : -1;
        });
    }

    function setUnavailable(value) {
        options.forEach(({ item, option }) => {
            const unavailable = option.value === value;
            option.disabled = unavailable;
            item.disabled = unavailable;
            item.setAttribute("aria-disabled", String(unavailable));
            if (unavailable) item.tabIndex = -1;
        });
    }

    let closeTimer;

    function closePicker(returnFocus = false) {
        window.clearTimeout(closeTimer);
        menu.classList.remove("is-open");
        menu.classList.add("is-closing");
        trigger.setAttribute("aria-expanded", "false");
        closeTimer = window.setTimeout(() => {
            menu.hidden = true;
            menu.classList.remove("is-closing");
        }, 120);
        if (returnFocus) trigger.focus();
    }

    function openPicker() {
        window.clearTimeout(closeTimer);
        menu.hidden = false;
        menu.classList.remove("is-closing");
        trigger.setAttribute("aria-expanded", "true");
        window.requestAnimationFrame(() => menu.classList.add("is-open"));
        const selectedOption = options.find(({ option }) => option.value === select.value);
        if (selectedOption && !selectedOption.item.disabled) selectedOption.item.focus();
    }

    trigger.addEventListener("click", () => {
        if (menu.hidden) {
            openPicker();
        } else {
            closePicker();
        }
    });

    menu.addEventListener("keydown", (event) => {
        const focusedIndex = options.findIndex(({ item }) => item === document.activeElement);
        if (event.key === "Escape") {
            event.preventDefault();
            closePicker(true);
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const offset = event.key === "ArrowDown" ? 1 : -1;
            let nextIndex = focusedIndex;
            do {
                nextIndex = (nextIndex + offset + options.length) % options.length;
            } while (options[nextIndex].item.disabled);
            options[nextIndex].item.focus();
        } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            const availableOptions = options.filter(({ item }) => !item.disabled);
            const index = event.key === "Home" ? 0 : availableOptions.length - 1;
            availableOptions[index].item.focus();
        }
    });

    select.addEventListener("change", updatePicker);
    function updateLanguage() {
        menu.setAttribute("aria-label", translate(labelKey));
        updatePicker();
    }

    updatePicker();
    return { picker, closePicker, setUnavailable, updatePicker, updateLanguage };
}

function updateCurrencySymbols() {
    fromSymbol.textContent = currencySymbols[fromCurrency.value];
    toSymbol.textContent = currencySymbols[toCurrency.value];
}

function rateKey(from, to) {
    return `${from}:${to}`;
}

function validateRateTable(table) {
    if (!table || typeof table !== "object" || Array.isArray(table) ||
        typeof table.base !== "string" || !configuredCurrencyCodes.includes(table.base) ||
        !table.rates || typeof table.rates !== "object" || Array.isArray(table.rates) ||
        typeof table.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(table.date) ||
        !Number.isFinite(Date.parse(`${table.date}T00:00:00Z`)) ||
        new Date(`${table.date}T00:00:00Z`).toISOString().slice(0, 10) !== table.date ||
        !Number.isFinite(Number(table.updatedAt)) || Number(table.updatedAt) <= 0 ||
        !configuredCurrencyCodes.every((code) =>
            Number.isFinite(Number(table.rates[code])) && Number(table.rates[code]) > 0
        )) {
        throw new Error(translate("invalidRateTable"));
    }

    return {
        base: table.base,
        rates: Object.fromEntries(configuredCurrencyCodes.map((code) =>
            [code, Number(table.rates[code])]
        )),
        date: table.date,
        updatedAt: Number(table.updatedAt)
    };
}

function openRateDatabase() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error("IndexedDB is unavailable."));
            return;
        }

        const request = window.indexedDB.open(RATE_DATABASE_NAME, 1);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(RATE_DATABASE_STORE)) {
                database.createObjectStore(RATE_DATABASE_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Could not open the rate database."));
        request.onblocked = () => reject(new Error("Opening the rate database was blocked."));
    });
}

async function loadSavedRateTable() {
    try {
        const database = await openRateDatabase();
        try {
            const table = await new Promise((resolve, reject) => {
                const transaction = database.transaction(RATE_DATABASE_STORE, "readonly");
                const request = transaction.objectStore(RATE_DATABASE_STORE).get("latest");
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error || new Error("Could not read saved rates."));
            });
            if (table) {
                savedRateTable = validateRateTable(table);
                return;
            }
        } finally {
            database.close();
        }
    } catch (error) {
        console.error("Could not load rates from IndexedDB; trying localStorage:", error);
    }

    try {
        const storedTable = localStorage.getItem(RATE_TABLE_STORAGE_KEY);
        if (storedTable) savedRateTable = validateRateTable(JSON.parse(storedTable));
    } catch (error) {
        console.error("Could not load the saved full rate table:", error);
    }
}

async function storeRateTable(table) {
    const validatedTable = validateRateTable(table);

    try {
        const database = await openRateDatabase();
        try {
            await new Promise((resolve, reject) => {
                const transaction = database.transaction(RATE_DATABASE_STORE, "readwrite");
                transaction.objectStore(RATE_DATABASE_STORE).put(validatedTable, "latest");
                transaction.oncomplete = resolve;
                transaction.onerror = () =>
                    reject(transaction.error || new Error("Could not store rates in IndexedDB."));
                transaction.onabort = () =>
                    reject(transaction.error || new Error("Storing rates in IndexedDB was aborted."));
            });
            savedRateTable = validatedTable;
            return;
        } finally {
            database.close();
        }
    } catch (error) {
        console.error("Could not save rates in IndexedDB; falling back to localStorage:", error);
    }

    try {
        localStorage.setItem(RATE_TABLE_STORAGE_KEY, JSON.stringify(validatedTable));
        savedRateTable = validatedTable;
    } catch (error) {
        console.error("Could not save the full rate table for offline use:", error);
        throw new Error("Could not persist the full rate table for offline use.");
    }
}

function getTableRate(from, to) {
    if (!savedRateTable) return null;
    const fromRate = savedRateTable.rates[from];
    const toRate = savedRateTable.rates[to];
    const rate = toRate / fromRate;
    return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function loadSavedRates() {
    try {
        const storedRates = JSON.parse(localStorage.getItem(RATE_STORAGE_KEY) || "{}");
        if (!storedRates || typeof storedRates !== "object" || Array.isArray(storedRates)) {
            throw new Error("The saved currency rates are invalid.");
        }

        savedRates = Object.fromEntries(Object.entries(storedRates).filter(([, rate]) =>
            rate && typeof rate === "object" &&
            Number.isFinite(Number(rate.rate)) && Number(rate.rate) > 0 &&
            typeof rate.date === "string" &&
            Number.isFinite(Number(rate.updatedAt))
        ));
    } catch (error) {
        console.error("Could not load saved currency rates:", error);
        savedRates = {};
    }
}

function getSavedRate(from, to) {
    return savedRates[rateKey(from, to)] || null;
}

function saveRate(rateData) {
    savedRates[rateKey(rateData.from, rateData.to)] = {
        rate: rateData.rate,
        date: rateData.date,
        updatedAt: rateData.updatedAt
    };

    try {
        localStorage.setItem(RATE_STORAGE_KEY, JSON.stringify(savedRates));
    } catch (error) {
        console.error("Could not save currency rates for offline use:", error);
    }
}

function parseAmount(value) {
    const trimmedValue = value.trim();
    if (!trimmedValue) return null;
    const numberParts = new Intl.NumberFormat().formatToParts(12345.6);
    const groupSeparator = numberParts.find(({ type }) => type === "group")?.value;
    const decimalSeparator = numberParts.find(({ type }) => type === "decimal")?.value || ".";
    let normalizedValue = trimmedValue.replace(/[\s\u00a0\u202f]/g, "");
    if (groupSeparator) normalizedValue = normalizedValue.split(groupSeparator).join("");
    normalizedValue = normalizedValue.replace(decimalSeparator, ".");
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalizedValue)) {
        return Number.NaN;
    }
    return Number(normalizedValue);
}

function formatAmount(amount, currency, minimumFractionDigits = 2) {
    const precision = currencyPrecision[currency] ?? 2;
    return amount.toLocaleString(undefined, {
        minimumFractionDigits: Math.min(minimumFractionDigits, precision),
        maximumFractionDigits: precision
    });
}

function updateConversionResult(rate) {
    const sourceInput = editedSide === "from" ? amountInput : resultInput;
    const targetInput = editedSide === "from" ? resultInput : amountInput;
    const targetCurrency = editedSide === "from" ? toCurrency.value : fromCurrency.value;
    const amount = parseAmount(sourceInput.value);
    if (amount === null || !Number.isFinite(amount) || amount <= 0) {
        targetInput.value = "0.00";
        copyButton.disabled = true;
        return;
    }

    const converted = editedSide === "from" ? amount * rate : amount / rate;
    if (!Number.isFinite(converted)) {
        targetInput.value = "0.00";
        copyButton.disabled = true;
        return;
    }
    targetInput.value = formatAmount(converted, targetCurrency);
    copyButton.disabled = false;
}

function clearConversionResult() {
    (editedSide === "from" ? resultInput : amountInput).value = "0.00";
    copyButton.disabled = true;
}

function displayRate(rateData, isOffline) {
    latestRate = {
        from: rateData.from,
        to: rateData.to,
        rate: Number(rateData.rate),
        date: rateData.date
    };
    latestUpdatedAt = Number(rateData.updatedAt);
    latestWasOffline = isOffline;
    updateRateInfo();
    updateLastUpdated();
    updateConversionResult(latestRate.rate);
}

function updateLastUpdated() {
    if (latestUpdatedAt === null) {
        rateRow.dataset.state = "idle";
        lastUpdated.textContent = "";
        return;
    }

    rateRow.dataset.state = latestWasOffline ? "offline" : "live";
    if (latestWasOffline) {
        lastUpdated.textContent = `${translate("offlineRates")} ${latestRate.date}`;
        return;
    }

    const minutes = Math.max(0, Math.floor((Date.now() / 1000 - latestUpdatedAt) / 60));
    let age;
    if (currentLanguage === "fr") {
        age = minutes === 0
            ? translate("lessThanMinute")
            : `il y a ${minutes} ${minutes === 1 ? translate("minuteAgo") : translate("minutesAgo")}`;
    } else {
        age = minutes === 0
            ? translate("lessThanMinute")
            : `${minutes} ${minutes === 1 ? translate("minuteAgo") : translate("minutesAgo")} ago`;
    }
    const statusPrefix = `${translate("liveRates")} `;
    lastUpdated.textContent = `${statusPrefix}${translate("lastUpdated")} ${age}`;
}

async function fetchAndSaveRateTable() {
    const response = await fetch(RATE_TABLE_API_URL, {
        headers: { Accept: "application/json" }
    });
    const responseText = await response.text();
    let data;
    try {
        data = JSON.parse(responseText);
    } catch {
        throw new Error(translations.en.invalidResponse);
    }

    if (!response.ok) {
        throw new Error(data?.error || translate("rateTableUnavailable"));
    }
    const rateTable = validateRateTable(data);
    await storeRateTable(rateTable);
    return rateTable;
}

async function requestStoragePersistence() {
    if (!navigator.onLine || !navigator.storage ||
        typeof navigator.storage.persist !== "function") return;

    try {
        const isPersisted = await navigator.storage.persist();
        if (!isPersisted) {
            console.info("The browser did not grant persistent storage for offline rates.");
        }
    } catch (error) {
        console.error("Could not request persistent storage for offline rates:", error);
    }
}

function exportRateTable() {
    if (!savedRateTable) {
        latestError = translations.en.exportRatesError;
        setErrorMessage(translateErrorMessage(latestError));
        return;
    }

    const file = new Blob([JSON.stringify({ version: 1, ...savedRateTable }, null, 2)], {
        type: "application/json"
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rates.json";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function importRateTable(file) {
    try {
        const importedTable = validateRateTable(JSON.parse(await file.text()));
        await storeRateTable(importedTable);
        const rate = getTableRate(fromCurrency.value, toCurrency.value);
        if (rate) {
            displayRate({
                from: fromCurrency.value,
                to: toCurrency.value,
                rate,
                date: importedTable.date,
                updatedAt: importedTable.updatedAt
            }, true);
        }
        latestError = null;
        setErrorMessage("");
    } catch (error) {
        console.error("Could not import the rates file:", error);
        latestError = error instanceof Error
            ? error.message
            : translations.en.importRatesError;
        setErrorMessage(translateErrorMessage(latestError));
    } finally {
        importRatesFile.value = "";
    }
}

async function copyConversionResult() {
    const fromAmount = parseAmount(amountInput.value);
    const toAmount = parseAmount(resultInput.value);
    if (copyButton.disabled || !Number.isFinite(fromAmount) || fromAmount <= 0 ||
        !Number.isFinite(toAmount) || toAmount <= 0) return;
    const formatCopyAmount = (amount) => amount.toLocaleString(undefined, {
        maximumFractionDigits: 20
    });
    const text = `${formatCopyAmount(fromAmount)} ${fromCurrency.value} = ` +
        `${formatCopyAmount(toAmount)} ${toCurrency.value}`;

    let copied = false;
    let clipboardError;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            copied = true;
        }
    } catch (error) {
        clipboardError = error;
    }

    if (!copied) {
        const previousFocus = document.activeElement;
        const copyInput = document.createElement("textarea");
        copyInput.value = text;
        copyInput.setAttribute("readonly", "");
        copyInput.style.position = "fixed";
        copyInput.style.opacity = "0";
        document.body.append(copyInput);
        copyInput.select();
        try {
            copied = document.execCommand("copy");
        } catch (error) {
            clipboardError = error;
        } finally {
            copyInput.remove();
            if (previousFocus instanceof HTMLElement) previousFocus.focus();
        }
    }

    if (!copied) {
        console.error("Could not copy the conversion result:",
            clipboardError || new Error("The clipboard copy command was unavailable."));
        return;
    }

    copyLabel.textContent = translate("copied");
    window.clearTimeout(copyResetTimer);
    copyResetTimer = window.setTimeout(() => {
        copyLabel.textContent = translate("copy");
    }, 1800);
}

function updateRateInfo() {
    if (!latestRate) {
        rateInfoFrom.textContent = "";
        rateInfoTo.textContent = "";
        return;
    }

    const fromPrecision = currencyPrecision[latestRate.from] || 4;
    const toPrecision = currencyPrecision[latestRate.to] || 4;
    rateInfoFrom.textContent =
        `1 ${latestRate.from} = ${latestRate.rate.toFixed(toPrecision)} ${latestRate.to}`;
    rateInfoTo.textContent =
        `1 ${latestRate.to} = ${(1 / latestRate.rate).toFixed(fromPrecision)} ${latestRate.from}`;
}

async function loadCurrencies() {
    let currencies;
    try {
        const response = await fetch("config/currencies.json");
        if (!response.ok) throw new Error(translate("loadCurrenciesError"));
        currencies = await response.json();
    } catch (error) {
        console.warn("Could not fetch the currency list; trying the saved offline copy:", error);
        try {
            currencies = JSON.parse(localStorage.getItem(CURRENCY_STORAGE_KEY) || "null");
        } catch (storageError) {
            console.error("Could not load the saved currency list:", storageError);
        }
    }

    if (!Array.isArray(currencies) || currencies.length === 0 ||
        currencies.some((currency) =>
            !currency || typeof currency.code !== "string" ||
            typeof currency.symbol !== "string" || typeof currency.icon !== "string" ||
            !Number.isFinite(Number(currency.precision))
        )) {
        throw new Error(translate("invalidCurrencies"));
    }

    try {
        localStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(currencies));
    } catch (error) {
        console.error("Could not save the currency list for offline use:", error);
    }

    currencyPrecision = Object.fromEntries(currencies.map(({ code, precision }) => [code, precision]));
    currencySymbols = Object.fromEntries(currencies.map(({ code, symbol }) => [code, symbol]));
    configuredCurrencyCodes = currencies.map(({ code }) => code);

    for (const currency of currencies) {
        for (const [select, isDefault] of [
            [fromCurrency, currency.defaultFrom],
            [toCurrency, currency.defaultTo]
        ]) {
            const option = document.createElement("option");
            option.value = currency.code;
            option.textContent = currency.code;
            option.dataset.icon = currency.icon;
            option.selected = isDefault;
            select.append(option);
        }
    }
}

async function convertCurrency(rateOnly = false) {
    window.clearTimeout(debounceTimer);
    const currentRequest = ++requestId;
    const sourceInput = editedSide === "from" ? amountInput : resultInput;
    const amountText = sourceInput.value.trim();
    const amount = parseAmount(amountText);
    const hasAmount = amountText !== "";
    const from = fromCurrency.value;
    const to = toCurrency.value;
    const cachedRate = getSavedRate(from, to);
    let tableRate = getTableRate(from, to);
    if (tableRate) {
        displayRate({
            from,
            to,
            rate: tableRate,
            date: savedRateTable.date,
            updatedAt: savedRateTable.updatedAt
        }, !navigator.onLine || rateTableRefreshUnavailable);
    } else if (cachedRate) {
        displayRate({ from, to, ...cachedRate }, true);
    } else if (latestRate && (latestRate.from !== from || latestRate.to !== to)) {
        latestRate = null;
        latestUpdatedAt = null;
        updateRateInfo();
        updateLastUpdated();
        clearConversionResult();
    }
    latestError = null;
    setErrorMessage("");

    if (!rateOnly && (hasAmount && (!Number.isFinite(amount) || amount < 0))) {
        clearConversionResult();
        latestError = translations.en.enterAmount;
        setErrorMessage(translateErrorMessage(latestError));
        return;
    }

    const now = Date.now() / 1000;
    const rateTableAge = savedRateTable ? now - savedRateTable.updatedAt : Infinity;
    const shouldRefreshRateTable = navigator.onLine &&
        (rateOnly || lastRateTableAttemptAt === 0 || (now - lastRateTableAttemptAt >= 45 &&
            (!savedRateTable || rateTableAge >= RATE_REFRESH_INTERVAL / 1000)));
    if (shouldRefreshRateTable) {
        lastRateTableAttemptAt = now;
        try {
            await fetchAndSaveRateTable();
            rateTableRefreshUnavailable = false;
        } catch (error) {
            if (currentRequest !== requestId) return;
            rateTableRefreshUnavailable = true;
            console.warn("Could not fetch the full rate table:", error);
        }
        if (currentRequest !== requestId) return;
        tableRate = getTableRate(from, to);
    }

    if (!tableRate && !cachedRate) {
        clearConversionResult();
    }

    if (tableRate) {
        displayRate({
            from,
            to,
            rate: tableRate,
            date: savedRateTable.date,
            updatedAt: savedRateTable.updatedAt
        }, !navigator.onLine || rateTableRefreshUnavailable);
        return;
    }

    try {
        const response = await fetch(CONVERSION_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                amount: !rateOnly && hasAmount && amount > 0 ? String(amount) : "1",
                from,
                to
            })
        });

        const responseBody = await response.text();
        let data;
        try {
            data = JSON.parse(responseBody);
        } catch {
            throw new Error(translations.en.invalidResponse);
        }

        if (currentRequest !== requestId) return;

        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new Error(translations.en.invalidResponse);
        }

        if (!response.ok) {
            throw new Error(data.error || translations.en.conversionFailed);
        }

        const converted = Number(data.converted);
        const rate = Number(data.rate);
        const updatedAt = Number(data.updatedAt);
        if (!Number.isFinite(converted) || !Number.isFinite(rate) ||
            !Number.isFinite(updatedAt) || typeof data.date !== "string" ||
            data.from !== from || data.to !== to || rate <= 0) {
            throw new Error(translations.en.invalidResponse);
        }

        const rateData = {
            from: data.from,
            to: data.to,
            rate,
            date: data.date,
            updatedAt
        };
        saveRate(rateData);
        displayRate(rateData, response.headers.get("X-Offline-Cache") === "true");
        if (rateTableRefreshUnavailable) {
            latestError = translations.en.rateTableUnavailable;
            setErrorMessage(translateErrorMessage(latestError));
        } else {
            latestError = null;
        }
    } catch (error) {
        if (currentRequest !== requestId) return;

        const fallbackRate = getSavedRate(from, to);
        if (fallbackRate) {
            displayRate({ from, to, ...fallbackRate }, true);
            if (rateTableRefreshUnavailable) {
                latestError = translations.en.rateTableUnavailable;
                setErrorMessage(translateErrorMessage(latestError));
            } else {
                latestError = null;
                setErrorMessage("");
            }
        } else {
            latestError = error instanceof TypeError
                ? translations.en.connectionError
                : error instanceof Error
                    ? error.message
                    : translations.en.connectionError;
            setErrorMessage(translateErrorMessage(latestError));
        }
    }
}

function scheduleConversion(side = "from") {
    editedSide = side;
    window.clearTimeout(debounceTimer);
    requestId += 1;
    const sourceInput = editedSide === "from" ? amountInput : resultInput;
    const amount = parseAmount(sourceInput.value);
    if (amount !== null && Number.isFinite(amount) && amount > 0 &&
        latestRate?.from === fromCurrency.value && latestRate?.to === toCurrency.value) {
        updateConversionResult(latestRate.rate);
    } else {
        clearConversionResult();
    }
    debounceTimer = window.setTimeout(convertCurrency, 300);
}

function updatePickerAvailability(currencyPickers) {
    currencyPickers[0].setUnavailable(toCurrency.value);
    currencyPickers[1].setUnavailable(fromCurrency.value);
}

async function initialize() {
    errorNotification.addEventListener("mouseenter", () => {
        errorHovered = true;
        updateErrorTimerPause();
    });
    errorNotification.addEventListener("mouseleave", () => {
        errorHovered = false;
        updateErrorTimerPause();
    });
    errorNotification.addEventListener("focusin", () => {
        errorFocused = true;
        updateErrorTimerPause();
    });
    errorNotification.addEventListener("focusout", (event) => {
        if (!errorNotification.contains(event.relatedTarget)) {
            errorFocused = false;
            updateErrorTimerPause();
        }
    });
    dismissErrorButton.addEventListener("click", () => setErrorMessage(""));

    updateHeaderClock();
    window.setInterval(updateHeaderClock, 1000);
    window.setInterval(updateLastUpdated, 60_000);
    initializeTheme();
    initializeLanguage();
    initializeHeaderMenu();
    loadSavedRates();

    await loadCurrencies();
    await loadSavedRateTable();
    await requestStoragePersistence();

    currencyPickers = [
        initializeCurrencyPicker(fromCurrency, "fromCurrency"),
        initializeCurrencyPicker(toCurrency, "toCurrency")
    ];

    fromCurrency.addEventListener("change", () => updatePickerAvailability(currencyPickers));
    toCurrency.addEventListener("change", () => updatePickerAvailability(currencyPickers));
    updatePickerAvailability(currencyPickers);
    updateCurrencySymbols();

    document.addEventListener("click", (event) => {
        currencyPickers.forEach(({ picker, closePicker }) => {
            if (!picker.contains(event.target)) closePicker();
        });
    });

    amountInput.addEventListener("input", () => scheduleConversion("from"));
    resultInput.addEventListener("input", () => scheduleConversion("to"));
    document.querySelectorAll(".chip").forEach((chip) => {
        chip.addEventListener("click", () => {
            const side = chip.dataset.side || "from";
            const input = side === "from" ? amountInput : resultInput;
            input.value = chip.dataset.amount;
            scheduleConversion(side);
            input.focus();
        });
    });
    copyButton.addEventListener("click", copyConversionResult);
    exportRatesButton.addEventListener("click", exportRateTable);
    importRatesButton.addEventListener("click", () => importRatesFile.click());
    importRatesFile.addEventListener("change", () => {
        const [file] = importRatesFile.files;
        if (file) importRateTable(file);
    });
    fromCurrency.addEventListener("change", () => {
        updateCurrencySymbols();
        convertCurrency();
    });
    toCurrency.addEventListener("change", () => {
        updateCurrencySymbols();
        convertCurrency();
    });
    refreshButton.addEventListener("click", () => convertCurrency(true));
    window.setInterval(() => convertCurrency(true), RATE_REFRESH_INTERVAL);
    window.addEventListener("online", () => {
        requestStoragePersistence();
        convertCurrency(true);
    });

    swapButton.addEventListener("click", () => {
        const previousAmount = amountInput.value;
        amountInput.value = resultInput.value;
        resultInput.value = previousAmount;
        const previousFrom = fromCurrency.value;
        fromCurrency.value = toCurrency.value;
        toCurrency.value = previousFrom;
        editedSide = "from";

        currencyPickers.forEach(({ updatePicker }) => updatePicker());
        updatePickerAvailability(currencyPickers);
        updateCurrencySymbols();
        convertCurrency();
    });

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("service-worker.js")
            .catch((error) => console.error("Service worker registration failed:", error));
    }

    convertCurrency();
}

initialize().catch((error) => {
    latestError = error instanceof Error
        ? error.message
        : translations.en.initializeError;
    setErrorMessage(translateErrorMessage(latestError));
    console.error("Currency converter initialization failed:", error);
});
