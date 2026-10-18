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
const themeToggle = document.querySelector("#theme-toggle");

let requestId = 0;
let debounceTimer;
let latestUpdatedAt = null;
let latestWasOffline = false;
let currencyPrecision = {};
let currencySymbols = {};

function updateHeaderClock() {
    const now = new Date();
    const dateFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });
    const timeFormatter = new Intl.DateTimeFormat("en-US", {
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
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
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

    themeToggle.addEventListener("click", () => {
        const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        applyTheme(nextTheme, true);
    });
}

function initializeCurrencyPicker(select, label) {
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
    menu.setAttribute("aria-label", label);
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
        trigger.setAttribute("aria-label", `${label}: ${selectedOption.textContent}`);
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
    updatePicker();
    return { picker, closePicker, setUnavailable, updatePicker };
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
    const age = minutes === 0
        ? "less than a minute ago"
        : `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    lastUpdated.textContent = `${latestWasOffline ? "Offline rates. " : ""}Last updated ${age}`;
}

async function loadCurrencies() {
    const response = await fetch("config/currencies.json");
    if (!response.ok) throw new Error("Unable to load the currency list.");

    const currencies = await response.json();
    if (!Array.isArray(currencies) || currencies.length === 0) {
        throw new Error("The currency list is invalid.");
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
    resultInput.placeholder = "Converted amount";
    rateInfo.textContent = "";
    errorMessage.textContent = "";

    if (hasAmount && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) {
        errorMessage.textContent = "Enter an amount greater than zero.";
        return;
    }

    resultInput.placeholder = "Converting...";

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
            throw new Error(data.error || "Conversion failed.");
        }

        const converted = Number(data.converted);
        const rate = Number(data.rate);
        const updatedAt = Number(data.updatedAt);
        if (!Number.isFinite(converted) || !Number.isFinite(rate) ||
            !Number.isFinite(updatedAt) || typeof data.date !== "string") {
            throw new Error("Received an invalid response from the server.");
        }

        if (hasAmount) {
            const precision = currencyPrecision[data.to] || 2;
            resultInput.value = converted.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: precision
            });
        }

        const ratePrecision = currencyPrecision[data.to] || 4;
        rateInfo.textContent =
            `1 ${data.from} = ${rate.toFixed(ratePrecision)} ${data.to}` +
            ` | Rate date: ${data.date}`;
        latestUpdatedAt = updatedAt;
        latestWasOffline = response.headers.get("X-Offline-Cache") === "true";
        updateLastUpdated();
    } catch (error) {
        if (currentRequest !== requestId) return;

        errorMessage.textContent = error instanceof Error
            ? error.message
            : "Unable to connect to the server.";
    } finally {
        if (currentRequest === requestId) {
            resultInput.placeholder = "Converted amount";
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

    await loadCurrencies();

    const currencyPickers = [
        initializeCurrencyPicker(fromCurrency, "From currency"),
        initializeCurrencyPicker(toCurrency, "To currency")
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
    refreshButton.addEventListener("click", convertCurrency);

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
        : "Unable to initialize the currency converter.";
    console.error("Currency converter initialization failed:", error);
});
