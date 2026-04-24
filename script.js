import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getDatabase, ref, get, set, push } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyD-ET-NddOEtiNvSt7787wxVbGoDj8-kas",
    authDomain: "website-cc7ff.firebaseapp.com",
    databaseURL: "https://website-cc7ff-default-rtdb.firebaseio.com",
    projectId: "website-cc7ff",
    storageBucket: "website-cc7ff.firebasestorage.app",
    messagingSenderId: "755069923532",
    appId: "1:755069923532:web:62384a64fb880100ff1269"
};

const firebaseApp = initializeApp(firebaseConfig);
const rtdb = getDatabase(firebaseApp);

const DB_ROOT = "website/profile";

/* =========================
   DB HELPERS
========================= */
async function dbGet(path) {
    try {
        const snapshot = await get(ref(rtdb, `${DB_ROOT}/${path}`));
        return snapshot.exists() ? snapshot.val() : null;
    } catch {
        return null;
    }
}

async function dbSet(path, value) {
    try {
        await set(ref(rtdb, `${DB_ROOT}/${path}`), value);
        return true;
    } catch {
        return false;
    }
}

async function dbPush(path, value) {
    try {
        return await push(ref(rtdb, `${DB_ROOT}/${path}`), value);
    } catch {
        return null;
    }
}

/* =========================
   SHA256 (PIN SYSTEM)
========================= */
async function sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(String(text || ''));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* =========================
   DIVISAS - CONFIG
========================= */
const CURRENCY_STORAGE_KEY = 'finanzas_currency_v1';

const DEFAULT_RATES = {
    EUR: 1,
    USD: 1.09,
    GBP: 0.85,
    JPY: 163.5,
    PEN: 4.05,
    PHP: 62.5
};

const CURRENCY_META = {
    EUR: { symbol: '€', flag: '🇪🇺', name: 'Euro' },
    USD: { symbol: '$', flag: '🇺🇸', name: 'Dólar' },
    GBP: { symbol: '£', flag: '🇬🇧', name: 'Libra' },
    JPY: { symbol: '¥', flag: '🇯🇵', name: 'Yen' },
    PEN: { symbol: 'S/', flag: '🇵🇪', name: 'Sol' },
    PHP: { symbol: '₱', flag: '🇵🇭', name: 'Peso' }
};

let ratesState = {
    rates: { ...DEFAULT_RATES },
    updatedAt: null,
    source: 'fallback'
};

/* =========================
   DOM CACHE
========================= */
let baseAmountInput, baseCurrencySelect, currencyGrid, refreshRatesBtn;

/* =========================
   INIT
========================= */
document.addEventListener('DOMContentLoaded', async function() {

    baseAmountInput = document.getElementById('baseAmount');
    baseCurrencySelect = document.getElementById('baseCurrency');
    currencyGrid = document.getElementById('currencyGrid');
    refreshRatesBtn = document.getElementById('refreshRatesBtn');

    await loadCurrencyState();
    renderCurrencyGrid();

    /* 🔥 AUTO REFRESH (TIEMPO REAL) */
    setInterval(() => {
        refreshRatesFromApi();
    }, 60000); // cada 60 segundos

    /* 🔥 refresh cuando vuelves a la pestaña */
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            refreshRatesFromApi();
        }
    });

    baseAmountInput?.addEventListener('input', renderCurrencyGrid);
    baseCurrencySelect?.addEventListener('change', renderCurrencyGrid);
    refreshRatesBtn?.addEventListener('click', refreshRatesFromApi);
});

/* =========================
   API LIVE RATES
========================= */
async function refreshRatesFromApi() {
    try {
        const res = await fetch(
            'https://api.exchangerate.host/latest?base=EUR&symbols=EUR,USD,GBP,JPY,PEN,PHP'
        );

        const data = await res.json();

        if (!res.ok || !data?.rates) throw new Error("API error");

        ratesState.rates = {
            ...DEFAULT_RATES,
            ...data.rates
        };

        ratesState.updatedAt = new Date().toISOString();
        ratesState.source = 'api';

        saveCurrencyState();
        renderCurrencyGrid();

    } catch (err) {
        ratesState.source = 'fallback';
        ratesState.updatedAt = new Date().toISOString();
        renderCurrencyGrid();
    }
}

/* =========================
   RENDER CURRENCY
========================= */
function renderCurrencyGrid() {
    if (!currencyGrid) return;

    const baseCode = baseCurrencySelect?.value || 'EUR';
    const baseAmount = Number(baseAmountInput?.value || 0);
    const baseRate = ratesState.rates[baseCode] || 1;

    currencyGrid.innerHTML = Object.keys(CURRENCY_META).map(code => {
        const rate = ratesState.rates[code] || 0;
        const converted = (baseAmount / baseRate) * rate;

        return `
            <div class="currency-item">
                <span>${CURRENCY_META[code].flag}</span>
                <div>
                    <strong>${code}</strong>
                    <p>${converted.toFixed(2)} ${CURRENCY_META[code].symbol}</p>
                </div>
            </div>
        `;
    }).join('');
}

/* =========================
   LOAD / SAVE
========================= */
async function loadCurrencyState() {
    const remote = await dbGet('currency');

    if (remote?.rates) {
        ratesState = remote;
        return;
    }
}

async function saveCurrencyState() {
    const payload = {
        rates: ratesState.rates,
        updatedAt: ratesState.updatedAt,
        source: ratesState.source
    };

    await dbSet('currency', payload);
}
