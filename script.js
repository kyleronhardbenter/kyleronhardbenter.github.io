import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getDatabase, ref, get, set, push } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

/* =========================
   FIREBASE INIT
========================= */
const firebaseConfig = {
    apiKey: "AIzaSyD-ET-NddOEtiNvSt7787wxVbGoDj8-kas",
    authDomain: "website-cc7ff.firebaseapp.com",
    databaseURL: "https://website-cc7ff-default-rtdb.firebaseio.com",
    projectId: "website-cc7ff",
    storageBucket: "website-cc7ff.firebasestorage.app",
    messagingSenderId: "755069923532",
    appId: "1:755069923532:web:62384a64fb880100ff1269"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const ROOT = "website/profile";

/* =========================
   UTIL: SHA256
========================= */
async function sha256(text) {
    const data = new TextEncoder().encode(String(text || ""));
    const hash = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(hash)]
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

/* =========================
   DB HELPERS
========================= */
const dbGet = async (p) => (await get(ref(db, `${ROOT}/${p}`))).val() ?? null;
const dbSet = async (p, v) => set(ref(db, `${ROOT}/${p}`), v);
const dbPush = async (p, v) => push(ref(db, `${ROOT}/${p}`), v);

/* =========================
   STATE GLOBAL
========================= */
let state = {
    pinConfig: {},
    incomes: [],
    docs: {},
    currency: {},
    pinLock: {
        attempts: 0,
        lockedUntil: 0,
        level: 0
    }
};

/* =========================
   LOAD INIT DATA
========================= */
async function init() {
    state.pinConfig = await dbGet("pinConfig") || {};
    state.incomes = await dbGet("incomes") || [];
    state.docs = await dbGet("docsStore") || {};
    state.currency = await dbGet("currency") || {};
}

/* =========================
   PIN SYSTEM (REAL SAFE)
========================= */
async function verifyPIN(input, context) {
    const hash = await sha256(input);
    return hash === state.pinConfig?.[context];
}

/* =========================
   PIN MODAL LOGIC
========================= */
let currentContext = "general";
let pendingAction = null;

const pinModal = document.getElementById("passwordModal");
const pinInput = document.getElementById("pinInput");
const pinMsg = document.getElementById("pinMessage");

function showPIN(context, action) {
    currentContext = context;
    pendingAction = action;
    pinModal.style.display = "flex";
    pinInput.value = "";
    pinInput.focus();
}

function closePIN() {
    pinModal.style.display = "none";
    pinInput.value = "";
    pinMsg.textContent = "";
}

async function submitPIN() {
    const value = pinInput.value;

    const ok = await verifyPIN(value, currentContext);

    if (!ok) {
        pinMsg.textContent = "PIN incorrecto";
        pinMsg.className = "error";
        return;
    }

    pinMsg.textContent = "Acceso permitido";
    pinMsg.className = "success";

    setTimeout(() => {
        closePIN();
        if (typeof pendingAction === "function") pendingAction();
    }, 200);
}

/* =========================
   NAVIGATION
========================= */
function setupNav() {
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.onclick = () => {
            const section = btn.dataset.section;

            if (section === "finanzas") {
                showPIN("general", () => switchSection(section));
                return;
            }

            switchSection(section);
        };
    });
}

function switchSection(id) {
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    document.getElementById(id)?.classList.add("active");
}

/* =========================
   FINANZAS
========================= */
function renderFinance() {
    const list = document.getElementById("incomeTableBody");
    if (!list) return;

    list.innerHTML = state.incomes.map(i => `
        <tr>
            <td>${i.date}</td>
            <td>${i.type}</td>
            <td>${i.concept}</td>
            <td>${i.amount}€</td>
        </tr>
    `).join("");
}

/* =========================
   DOCUMENTOS (PROTECTED)
========================= */
function uploadDoc(type) {
    showPIN("general", () => {
        document.getElementById(`fileInput-${type}`).click();
    });
}

function downloadDoc(type) {
    showPIN("doc-download", () => {
        const doc = state.docs[type];
        if (!doc) return;
        const a = document.createElement("a");
        a.href = doc.content;
        a.download = doc.name;
        a.click();
    });
}

/* =========================
   EVENTS
========================= */
document.addEventListener("DOMContentLoaded", async () => {

    await init();

    setupNav();
    renderFinance();

    pinInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submitPIN();
        if (e.key === "Escape") closePIN();
    });

    document.querySelectorAll(".doc-btn").forEach(btn => {
        btn.onclick = () => {
            const type = btn.dataset.docType;
            const action = btn.dataset.docAction;

            if (action === "upload") uploadDoc(type);
            if (action === "download") downloadDoc(type);
        };
    });
});
