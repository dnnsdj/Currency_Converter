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

let requestId = 0;
const currencySymbols = {
    BTC: "\u20bf",
    USD: "$",
    GBP: "\u00a3",
    EUR: "\u20ac",
    GHS: "GH\u20b5"
};

function updateCurrencySymbols() {
    fromSymbol.textContent = currencySymbols[fromCurrency.value];
    toSymbol.textContent = currencySymbols[toCurrency.value];
}

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

updateHeaderClock();
setInterval(updateHeaderClock, 1000);

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
    trigger.className = "currency-picker__trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", label);
    picker.append(trigger);

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
        options.find(({ option }) => option.value === select.value)?.item.focus();
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

const currencyPickers = [
    initializeCurrencyPicker(fromCurrency, "From currency"),
    initializeCurrencyPicker(toCurrency, "To currency")
];

function updatePickerAvailability() {
    currencyPickers[0].setUnavailable(toCurrency.value);
    currencyPickers[1].setUnavailable(fromCurrency.value);
}

fromCurrency.addEventListener("change", updatePickerAvailability);
toCurrency.addEventListener("change", updatePickerAvailability);
updatePickerAvailability();
updateCurrencySymbols();

document.addEventListener("click", (event) => {
    currencyPickers.forEach(({ picker, closePicker }) => {
        if (!picker.contains(event.target)) closePicker();
    });
});

async function convertCurrency() {
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

        // Ignore outdated responses.
        if (currentRequest !== requestId) return;

        if (!response.ok) {
            throw new Error(data.error || "Conversion failed.");
        }

        const converted = Number(data.converted);
        const rate = Number(data.rate);
        if (!Number.isFinite(converted) || !Number.isFinite(rate) || typeof data.date !== "string") {
            throw new Error("Received an invalid response from the server.");
        }

        if (hasAmount) {
            resultInput.value = converted.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: data.to === "BTC" ? 8 : 2
            });
        }

        rateInfo.textContent =
            `1 ${data.from} = ${rate.toFixed(data.to === "BTC" ? 8 : 4)} ${data.to}` +
            ` | Rate date: ${data.date}`;

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

amountInput.addEventListener("input", convertCurrency);
fromCurrency.addEventListener("change", convertCurrency);
toCurrency.addEventListener("change", convertCurrency);
fromCurrency.addEventListener("change", updateCurrencySymbols);
toCurrency.addEventListener("change", updateCurrencySymbols);
convertCurrency();

swapButton.addEventListener("click", () => {
    const previousFrom = fromCurrency.value;
    fromCurrency.value = toCurrency.value;
    toCurrency.value = previousFrom;

    currencyPickers.forEach(({ updatePicker }) => updatePicker());
    updatePickerAvailability();
    updateCurrencySymbols();
    convertCurrency();
});
