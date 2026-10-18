const amountInput = document.querySelector("#amount");
const resultInput = document.querySelector("#result");
const fromCurrency = document.querySelector("#from-currency");
const toCurrency = document.querySelector("#to-currency");
const swapButton = document.querySelector(".converter__swap-btn");
const rateInfo = document.querySelector("#rate-info");
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
const alertForm = document.querySelector("#alert-form");
const alertType = document.querySelector("#alert-type");
const alertDirection = document.querySelector("#alert-direction");
const alertThreshold = document.querySelector("#alert-threshold");
const alertThresholdDescription = document.querySelector("#alert-threshold-description");
const alertStatus = document.querySelector("#alert-status");

let requestId = 0;
let debounceTimer;
let latestUpdatedAt = null;
let latestWasOffline = false;
let latestRate = null;
let latestError = null;
let alertSubmissionError = null;
let alertSubmissionSucceeded = false;
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
        alertTitle: "Email me a rate alert",
        alertIntro: "Get one email when a rate crosses your target or moves by a chosen percentage.",
        email: "Email address",
        alertType: "Alert type",
        targetType: "Target exchange rate",
        percentType: "Percentage move",
        alertCondition: "Alert condition",
        targetRate: "Target rate (in the selected To currency)",
        percentChange: "Percentage change (from the current rate)",
        targetAbove: "Rises to or above the target",
        targetBelow: "Falls to or below the target",
        percentEither: "Moves up or down",
        percentUp: "Moves up",
        percentDown: "Moves down",
        consent: "Email me one alert for this condition. I understand I need to confirm my email.",
        createAlert: "Create email alert",
        rateDate: "Rate date",
        lastUpdated: "Last updated",
        offlineRates: "Offline rates.",
        lessThanMinute: "less than a minute ago",
        minuteAgo: "minute ago",
        minutesAgo: "minutes ago",
        converting: "Converting...",
        enterAmount: "Enter an amount greater than zero.",
        conversionFailed: "Conversion failed.",
        invalidResponse: "Received an invalid response from the server.",
        connectionError: "Unable to connect to the server.",
        initializeError: "Unable to initialize the currency converter.",
        loadCurrenciesError: "Unable to load the currency list.",
        invalidCurrencies: "The currency list is invalid.",
        alertSuccess: "Check your email to confirm this rate alert.",
        alertFailure: "Could not create the email alert.",
        alertConnectionError: "Unable to create the email alert."
    },
    fr: {
        clockLabel: "Date et heure actuelles",
        themeLabel: "Thème de couleur",
        light: "Clair",
        dark: "Sombre",
        language: "Langue",
        ratesTitle: "Taux du jour",
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
        alertTitle: "Recevoir une alerte par e-mail",
        alertIntro: "Recevez un e-mail lorsque le taux atteint votre objectif ou varie du pourcentage choisi.",
        email: "Adresse e-mail",
        alertType: "Type d'alerte",
        targetType: "Taux de change cible",
        percentType: "Variation en pourcentage",
        alertCondition: "Condition de l'alerte",
        targetRate: "Taux cible (dans la devise sélectionnée)",
        percentChange: "Variation en pourcentage (depuis le taux actuel)",
        targetAbove: "Atteint ou dépasse le taux cible",
        targetBelow: "Atteint ou passe sous le taux cible",
        percentEither: "Augmente ou diminue",
        percentUp: "Augmente",
        percentDown: "Diminue",
        consent: "M'envoyer une alerte pour cette condition. Je comprends que je dois confirmer mon adresse e-mail.",
        createAlert: "Créer une alerte par e-mail",
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
        invalidCurrencies: "La liste des devises est invalide.",
        alertSuccess: "Consultez votre e-mail pour confirmer cette alerte de taux.",
        alertFailure: "Impossible de créer l'alerte par e-mail.",
        alertConnectionError: "Impossible de créer l'alerte par e-mail."
    }
};

function translate(key) {
    return translations[currentLanguage][key] || translations.en[key] || key;
}

function translateServerMessage(message) {
    const frenchMessages = {
        "Enter an amount greater than zero.": "Saisissez un montant supérieur à zéro.",
        "Choose a supported currency.": "Choisissez une devise prise en charge.",
        "Choose supported currencies.": "Choisissez des devises prises en charge.",
        "Choose two different supported currencies and an alert type.":
            "Choisissez deux devises différentes et un type d'alerte.",
        "Enter a valid email address.": "Saisissez une adresse e-mail valide.",
        "Enter a threshold greater than zero.": "Saisissez un seuil supérieur à zéro.",
        "Choose a valid alert direction and threshold.": "Choisissez une direction et un seuil valides.",
        "The current rate is unavailable. Please try again.": "Le taux actuel est indisponible. Réessayez.",
        "Exchange rates are temporarily unavailable.": "Les taux de change sont temporairement indisponibles.",
        "The exchange-rate service returned invalid data.":
            "Le service de change a renvoyé des données invalides.",
        "The converted amount is too large.": "Le montant converti est trop élevé.",
        "Request body must be valid JSON.": "Le corps de la requête doit être un JSON valide.",
        "Only POST requests are supported.": "Seules les requêtes POST sont acceptées.",
        "Choose two different currencies and an alert type.":
            "Choisissez deux devises différentes et un type d'alerte.",
        "Choose a valid alert direction and threshold.":
            "Choisissez une direction et un seuil valides.",
        "Too many alert requests. Please try again in an hour.":
            "Trop de demandes d'alerte. Réessayez dans une heure.",
        "Too many alerts have been requested for this email address today.":
            "Trop d'alertes ont été demandées pour cette adresse aujourd'hui."
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
    updateAlertOptions();
    updateLastUpdated();
    updateRateInfo();
    errorMessage.textContent = latestError
        ? translateServerMessage(latestError)
        : "";
    alertStatus.textContent = alertSubmissionSucceeded
        ? translate("alertSuccess")
        : alertSubmissionError
            ? translateServerMessage(alertSubmissionError)
            : "";

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
        rateInfo.textContent = "";
        return;
    }

    const ratePrecision = currencyPrecision[latestRate.to] || 4;
    const formattedDate = new Intl.DateTimeFormat(
        currentLanguage === "fr" ? "fr-FR" : "en-US",
        { timeZone: "UTC", dateStyle: "medium" }
    ).format(new Date(`${latestRate.date}T00:00:00Z`));
    rateInfo.textContent =
        `1 ${latestRate.from} = ${latestRate.rate.toFixed(ratePrecision)} ${latestRate.to}` +
        ` | ${translate("rateDate")}: ${formattedDate}`;
}

async function loadCurrencies() {
    const response = await fetch("config/currencies.json");
    if (!response.ok) throw new Error(translate("loadCurrenciesError"));

    const currencies = await response.json();
    if (!Array.isArray(currencies) || currencies.length === 0) {
        throw new Error(translate("invalidCurrencies"));
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

async function convertCurrency() {
    window.clearTimeout(debounceTimer);
    const currentRequest = ++requestId;
    const amount = amountInput.value.trim();
    const hasAmount = amount !== "";

    resultInput.value = "";
    resultInput.placeholder = translate("resultPlaceholder");
    latestRate = null;
    latestError = null;
    updateRateInfo();
    errorMessage.textContent = "";

    if (hasAmount && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) {
        latestError = translate("enterAmount");
        errorMessage.textContent = latestError;
        return;
    }

    resultInput.placeholder = translate("converting");

    try {
        const response = await fetch("api/convert.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                amount: hasAmount ? amount : "1",
                from: fromCurrency.value,
                to: toCurrency.value
            })
        });

        const data = await response.json();

        if (currentRequest !== requestId) return;

        if (!response.ok) {
            throw new Error(translateServerMessage(data.error || translate("conversionFailed")));
        }

        const converted = Number(data.converted);
        const rate = Number(data.rate);
        const updatedAt = Number(data.updatedAt);
        if (!Number.isFinite(converted) || !Number.isFinite(rate) ||
            !Number.isFinite(updatedAt) || typeof data.date !== "string") {
            throw new Error(translate("invalidResponse"));
        }

        if (hasAmount) {
            const precision = currencyPrecision[data.to] || 2;
            resultInput.value = converted.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: precision
            });
        }

        latestRate = {
            from: data.from,
            to: data.to,
            rate,
            date: data.date
        };
        latestError = null;
        updateRateInfo();
        latestUpdatedAt = updatedAt;
        latestWasOffline = response.headers.get("X-Offline-Cache") === "true";
        updateLastUpdated();
    } catch (error) {
        if (currentRequest !== requestId) return;

        latestError = error instanceof Error ? error.message : translate("connectionError");
        errorMessage.textContent = translateServerMessage(latestError);
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

function updateAlertOptions() {
    const isPercent = alertType.value === "percent";
    const options = isPercent
        ? [
            ["either", translate("percentEither")],
            ["up", translate("percentUp")],
            ["down", translate("percentDown")]
        ]
        : [
            ["above", translate("targetAbove")],
            ["below", translate("targetBelow")]
        ];

    alertDirection.replaceChildren(...options.map(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        return option;
    }));
    alertThresholdDescription.textContent = isPercent
        ? translate("percentChange")
        : translate("targetRate");
    alertThreshold.min = isPercent ? "0.01" : "0.000000000001";
    alertThreshold.max = isPercent ? "10000" : "";
    alertThreshold.step = isPercent ? "0.01" : "any";
}

async function createRateAlert(event) {
    event.preventDefault();
    alertSubmissionError = null;
    alertSubmissionSucceeded = false;
    alertStatus.textContent = "";
    const submitButton = alertForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        const response = await fetch("api/alerts.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "subscribe",
                email: document.querySelector("#alert-email").value.trim(),
                from: fromCurrency.value,
                to: toCurrency.value,
                alertType: alertType.value,
                direction: alertDirection.value,
                threshold: alertThreshold.value
            })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(translateServerMessage(data.error || translate("alertFailure")));
        }

        alertSubmissionSucceeded = true;
        alertStatus.textContent = translate("alertSuccess");
        alertForm.reset();
        updateAlertOptions();
    } catch (error) {
        alertSubmissionError = error instanceof Error
            ? error.message
            : translate("alertConnectionError");
        alertStatus.textContent = translateServerMessage(alertSubmissionError);
    } finally {
        submitButton.disabled = false;
    }
}

async function initialize() {
    updateHeaderClock();
    window.setInterval(updateHeaderClock, 1000);
    window.setInterval(updateLastUpdated, 60_000);
    initializeTheme();
    initializeLanguage();

    await loadCurrencies();

    currencyPickers = [
        initializeCurrencyPicker(fromCurrency, "fromCurrency"),
        initializeCurrencyPicker(toCurrency, "toCurrency")
    ];

    fromCurrency.addEventListener("change", () => updatePickerAvailability(currencyPickers));
    toCurrency.addEventListener("change", () => updatePickerAvailability(currencyPickers));
    updatePickerAvailability(currencyPickers);
    updateCurrencySymbols();
    updateAlertOptions();

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
    refreshButton.addEventListener("click", convertCurrency);
    alertType.addEventListener("change", updateAlertOptions);
    alertForm.addEventListener("submit", createRateAlert);

    swapButton.addEventListener("click", () => {
        const previousFrom = fromCurrency.value;
        fromCurrency.value = toCurrency.value;
        toCurrency.value = previousFrom;

        currencyPickers.forEach(({ updatePicker }) => updatePicker());
        updatePickerAvailability(currencyPickers);
        updateCurrencySymbols();
        convertCurrency();
    });

    convertCurrency();

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("service-worker.js")
            .catch((error) => console.error("Service worker registration failed:", error));
    }
}

initialize().catch((error) => {
    errorMessage.textContent = error instanceof Error
        ? error.message
        : translate("initializeError");
    console.error("Currency converter initialization failed:", error);
});
