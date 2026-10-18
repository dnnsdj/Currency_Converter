const amountInput = document.querySelector("#amount");
const resultInput = document.querySelector("#result");
const fromCurrency = document.querySelector("#from-currency");
const toCurrency = document.querySelector("#to-currency");
const swapButton = document.querySelector(".converter__swap-btn");
const rateInfoFrom = document.querySelector("#rate-info-from");
const rateInfoTo = document.querySelector("#rate-info-to");
const errorNotification = document.querySelector("#error-notification");
const errorMessage = document.querySelector("#error-message");
const currentDate = document.querySelector("#current-date");
const currentTime = document.querySelector("#current-time");
const fromSymbol = document.querySelector("#from-symbol");
const toSymbol = document.querySelector("#to-symbol");
const lastUpdated = document.querySelector("#last-updated");
const refreshButton = document.querySelector("#refresh-rates");
const themeLightButton = document.querySelector("#theme-light");
const themeDarkButton = document.querySelector("#theme-dark");
const languageSelect = document.querySelector("#language-select");
const RATE_STORAGE_KEY = "currency-converter-rates";
const CURRENCY_STORAGE_KEY = "currency-converter-currencies";
const RATE_REFRESH_INTERVAL = 30 * 60 * 1000;
const CONVERSION_API_URL = window.location.hostname === "dnnsdj.github.io"
    ? "https://currency-converter-api.onrender.com/api/convert.php"
    : "api/convert.php";

let requestId = 0;
let debounceTimer;
let latestUpdatedAt = null;
let latestWasOffline = false;
let latestRate = null;
let latestError = null;
let savedRates = {};
let currencyPrecision = {};
let currencySymbols = {};
let currentLanguage = "en";
let currencyPickers = [];

const translations = {
    en: {
        clockLabel: "Current date and time",
        themeLabel: "Color theme",
        light: "Light",
        dark: "Dark",
        language: "Language",
        ratesTitle: "Today's Rates",
        alertTitle: "Alert",
        converterSubtitle: "Convert currencies instantly",
        from: "From:",
        to: "To:",
        fromCurrency: "From currency",
        toCurrency: "To currency",
        amountLabel: "Amount to convert",
        amountPlaceholder: "Enter amount",
        resultLabel: "Converted amount",
        resultPlaceholder: "Converted amount",
        swap: "Swap currencies",
        refresh: "Refresh rates",
        rateDate: "Rate date",
        lastUpdated: "Last updated",
        offlineRates: "Offline rates.",
        lessThanMinute: "less than a minute ago",
        minuteAgo: "minute",
        minutesAgo: "minutes",
        converting: "Converting...",
        enterAmount: "Enter an amount greater than zero.",
        conversionFailed: "Conversion failed.",
        invalidResponse: "Received an invalid response from the server.",
        connectionError: "Unable to connect to the server.",
        initializeError: "Unable to initialize the currency converter.",
        loadCurrenciesError: "Unable to load the currency list.",
        invalidCurrencies: "The currency list is invalid."
    },
    fr: {
        clockLabel: "Date et heure actuelles",
        themeLabel: "Thème de couleur",
        light: "Clair",
        dark: "Sombre",
        language: "Langue",
        ratesTitle: "Taux du jour",
        alertTitle: "Alerte",
        converterSubtitle: "Convertissez des devises instantanément",
        from: "De :",
        to: "Vers :",
        fromCurrency: "Devise de départ",
        toCurrency: "Devise d'arrivée",
        amountLabel: "Montant à convertir",
        amountPlaceholder: "Saisissez un montant",
        resultLabel: "Montant converti",
        resultPlaceholder: "Montant converti",
        swap: "Inverser les devises",
        refresh: "Actualiser les taux",
        rateDate: "Date du taux",
        lastUpdated: "Dernière mise à jour",
        offlineRates: "Taux hors ligne.",
        lessThanMinute: "il y a moins d'une minute",
        minuteAgo: "minute",
        minutesAgo: "minutes",
        converting: "Conversion en cours...",
        enterAmount: "Saisissez un montant supérieur à zéro.",
        conversionFailed: "Échec de la conversion.",
        invalidResponse: "Le serveur a renvoyé une réponse invalide.",
        connectionError: "Impossible de se connecter au serveur.",
        initializeError: "Impossible d'initialiser le convertisseur.",
        loadCurrenciesError: "Impossible de charger la liste des devises.",
        invalidCurrencies: "La liste des devises est invalide."
    }
};

function translate(key) {
    return translations[currentLanguage][key] || translations.en[key] || key;
}

function setErrorMessage(message) {
    errorMessage.textContent = message;
    errorNotification.hidden = !message;
}

function translateServerMessage(message) {
    const frenchMessages = {
        "Enter an amount greater than zero.": "Saisissez un montant supérieur à zéro.",
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

    languageSelect.value = currentLanguage;
    updateHeaderClock();
    updatePickerLanguage();
    updateLastUpdated();
    updateRateInfo();
    setErrorMessage(latestError
        ? translateServerMessage(latestError)
        : "");
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

    const options = Array.from(select.options).map((option) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "currency-picker__option";
        item.setAttribute("role", "option");
        item.dataset.value = option.value;

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

    function closePicker(returnFocus = false) {
        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
        if (returnFocus) trigger.focus();
    }

    function openPicker() {
        menu.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
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

function updateConversionResult(rate) {
    const amount = Number(amountInput.value.trim());
    if (!amountInput.value.trim() || !Number.isFinite(amount) || amount <= 0) {
        resultInput.value = "";
        return;
    }

    const precision = currencyPrecision[toCurrency.value] || 2;
    resultInput.value = (amount * rate).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: precision
    });
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
        lastUpdated.textContent = "";
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
    const offlinePrefix = latestWasOffline ? `${translate("offlineRates")} ` : "";
    lastUpdated.textContent = `${offlinePrefix}${translate("lastUpdated")} ${age}`;
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
    const amount = amountInput.value.trim();
    const hasAmount = amount !== "";
    const from = fromCurrency.value;
    const to = toCurrency.value;
    const cachedRate = getSavedRate(from, to);
    if (cachedRate) {
        displayRate({ from, to, ...cachedRate }, true);
    } else if (latestRate && (latestRate.from !== from || latestRate.to !== to)) {
        latestRate = null;
        latestUpdatedAt = null;
        updateRateInfo();
        updateLastUpdated();
        resultInput.value = "";
    }
    latestError = null;
    setErrorMessage("");

    if (!rateOnly && hasAmount && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) {
        latestError = translate("enterAmount");
        setErrorMessage(translateServerMessage(latestError));
        return;
    }

    if (!cachedRate) {
        resultInput.value = "";
    }
    resultInput.placeholder = translate("converting");

    try {
        const response = await fetch(CONVERSION_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                amount: !rateOnly && hasAmount ? amount : "1",
                from,
                to
            })
        });

        const responseBody = await response.text();
        let data;
        try {
            data = JSON.parse(responseBody);
        } catch {
            throw new Error(translate("invalidResponse"));
        }

        if (currentRequest !== requestId) return;

        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new Error(translate("invalidResponse"));
        }

        if (!response.ok) {
            throw new Error(translateServerMessage(data.error || translate("conversionFailed")));
        }

        const converted = Number(data.converted);
        const rate = Number(data.rate);
        const updatedAt = Number(data.updatedAt);
        if (!Number.isFinite(converted) || !Number.isFinite(rate) ||
            !Number.isFinite(updatedAt) || typeof data.date !== "string" ||
            data.from !== from || data.to !== to || rate <= 0) {
            throw new Error(translate("invalidResponse"));
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
        latestError = null;
    } catch (error) {
        if (currentRequest !== requestId) return;

        const fallbackRate = getSavedRate(from, to);
        if (fallbackRate) {
            displayRate({ from, to, ...fallbackRate }, true);
            latestError = null;
            setErrorMessage("");
        } else {
            latestError = error instanceof Error ? error.message : translate("connectionError");
            setErrorMessage(translateServerMessage(latestError));
        }
    } finally {
        if (currentRequest === requestId) {
            resultInput.placeholder = translate("resultPlaceholder");
        }
    }
}

function scheduleConversion() {
    window.clearTimeout(debounceTimer);
    requestId += 1;
    debounceTimer = window.setTimeout(convertCurrency, 300);
}

function updatePickerAvailability(currencyPickers) {
    currencyPickers[0].setUnavailable(toCurrency.value);
    currencyPickers[1].setUnavailable(fromCurrency.value);
}

async function initialize() {
    updateHeaderClock();
    window.setInterval(updateHeaderClock, 1000);
    window.setInterval(updateLastUpdated, 60_000);
    initializeTheme();
    initializeLanguage();
    loadSavedRates();

    await loadCurrencies();

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

    amountInput.addEventListener("input", scheduleConversion);
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
    window.addEventListener("online", () => convertCurrency(true));

    swapButton.addEventListener("click", () => {
        const previousFrom = fromCurrency.value;
        fromCurrency.value = toCurrency.value;
        toCurrency.value = previousFrom;

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
    const message = error instanceof Error
        ? error.message
        : translate("initializeError");
    setErrorMessage(message);
    console.error("Currency converter initialization failed:", error);
});
