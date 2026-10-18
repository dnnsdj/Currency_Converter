const SHELL_CACHE = "currency-converter-shell-v9";
const RATE_CACHE = "currency-converter-rates-v2";
const APP_CACHE_PREFIX = "currency-converter-";

self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        const shellCache = await caches.open(SHELL_CACHE);
        const configResponse = await fetch("config/currencies.json");
        if (!configResponse.ok) throw new Error("Could not cache the currency configuration.");
        const currencies = await configResponse.json();
        const assets = currencies.map((currency) => currency.icon);

        await shellCache.addAll([
            "./",
            "index.html",
            "css/style.css",
            "assets/fontawesome/css/all.min.css",
            "assets/fontawesome/webfonts/fa-solid-900.woff2",
            "assets/brand/logo-mark.svg",
            "assets/brand/favicon.svg",
            "assets/fonts/ibm-plex-sans-latin.woff2",
            "js/script.js",
            "config/currencies.json",
            ...assets
        ]);
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames
            .filter((name) => name.startsWith(APP_CACHE_PREFIX) &&
                name !== SHELL_CACHE && name !== RATE_CACHE)
            .map((name) => caches.delete(name)));
        await self.clients.claim();
    })());
});

function getRateCacheKey(url, from, to) {
    const key = new URL(url);
    key.search = "";
    key.searchParams.set("from", from);
    key.searchParams.set("to", to);
    return new Request(key.toString());
}

async function serveCachedRate(cache, key, amount) {
    const cachedResponse = await cache.match(key);
    if (!cachedResponse) return null;

    let data;
    try {
        data = await cachedResponse.json();
    } catch (error) {
        console.error("The cached currency rate contains invalid JSON:", error);
        await cache.delete(key);
        return null;
    }
    const from = new URL(key.url).searchParams.get("from");
    const to = new URL(key.url).searchParams.get("to");
    if (!data || typeof data !== "object" || Array.isArray(data) ||
        data.from !== from || data.to !== to ||
        !Number.isFinite(Number(data.rate)) || Number(data.rate) <= 0 ||
        !Number.isFinite(Number(data.converted)) ||
        !Number.isFinite(Number(data.updatedAt)) ||
        typeof data.date !== "string") {
        console.error("The cached currency rate has an invalid response shape.");
        await cache.delete(key);
        return null;
    }

    const converted = Number(amount) * Number(data.rate);
    if (!Number.isFinite(converted)) return null;

    return new Response(JSON.stringify({ ...data, converted }), {
        status: 200,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "X-Offline-Cache": "true"
        }
    });
}

function createConversionErrorResponse(message) {
    return new Response(JSON.stringify({ error: message }), {
        status: 502,
        headers: { "Content-Type": "application/json; charset=utf-8" }
    });
}

async function handleConversion(request) {
    let body;
    try {
        body = await request.clone().json();
    } catch {
        return fetch(request);
    }
    if (typeof body.from !== "string" || typeof body.to !== "string" ||
        !Number.isFinite(Number(body.amount))) {
        return fetch(request);
    }

    const key = getRateCacheKey(request.url, body.from, body.to);
    const cache = await caches.open(RATE_CACHE);

    try {
        const response = await fetch(request.clone());
        if (response.ok) {
            let data;
            try {
                data = await response.clone().json();
            } catch (error) {
                console.error("The conversion API returned invalid JSON:", error);
                const offlineResponse = await serveCachedRate(cache, key, body.amount);
                return offlineResponse ||
                    createConversionErrorResponse("The conversion service returned an invalid response.");
            }

            if (!data || typeof data !== "object" || Array.isArray(data) ||
                data.from !== body.from || data.to !== body.to ||
                !Number.isFinite(Number(data.rate)) || Number(data.rate) <= 0 ||
                !Number.isFinite(Number(data.converted)) ||
                !Number.isFinite(Number(data.updatedAt)) || typeof data.date !== "string") {
                console.error("The conversion API returned an invalid response.");
                const offlineResponse = await serveCachedRate(cache, key, body.amount);
                return offlineResponse ||
                    createConversionErrorResponse("The conversion service returned an invalid response.");
            }

            try {
                await cache.put(key, response.clone());
                const keys = await cache.keys();
                while (keys.length > 100) {
                    await cache.delete(keys.shift());
                }
            } catch (error) {
                console.error("Could not store the latest currency rate offline:", error);
            }
            return response;
        }

        if (response.status >= 500) {
            const offlineResponse = await serveCachedRate(cache, key, body.amount);
            if (offlineResponse) return offlineResponse;
        }
        return response;
    } catch (error) {
        const offlineResponse = await serveCachedRate(cache, key, body.amount);
        if (offlineResponse) return offlineResponse;
        throw error;
    }
}

self.addEventListener("fetch", (event) => {
    const requestUrl = new URL(event.request.url);

    if (event.request.method === "POST" &&
        requestUrl.pathname.endsWith("/api/convert.php")) {
        event.respondWith(handleConversion(event.request));
        return;
    }

    const appUrl = new URL(self.registration.scope);
    if (requestUrl.origin !== appUrl.origin) return;

    if (event.request.method === "GET") {
        event.respondWith((async () => {
            const shellCache = await caches.open(SHELL_CACHE);
            const cachedResponse = await shellCache.match(event.request);
            if (cachedResponse) return cachedResponse;
            return fetch(event.request);
        })());
    }
});
