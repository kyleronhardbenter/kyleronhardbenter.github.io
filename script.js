// ===============================
// 🔥 FIREBASE INIT
// ===============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

// 🔑 CONFIGURA ESTO
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_AUTH_DOMAIN",
    projectId: "TU_PROJECT_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ===============================
// 🔐 LOGIN STATE
// ===============================
let isLogin = true;

// ===============================
// 🔐 LOGIN / REGISTER UI
// ===============================
window.toggleMode = function () {
    isLogin = !isLogin;
    document.getElementById("authTitle").innerText = isLogin ? "Login" : "Registro";
};

window.authAction = function () {
    const email = document.getElementById("email").value;
    const pass = document.getElementById("password").value;

    if (!email || !pass) return alert("Completa los campos");

    if (isLogin) {
        signInWithEmailAndPassword(auth, email, pass)
            .catch(err => alert("Error login: " + err.message));
    } else {
        createUserWithEmailAndPassword(auth, email, pass)
            .catch(err => alert("Error registro: " + err.message));
    }
};

// ===============================
// 🔐 SESSION CONTROL
// ===============================
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById("authScreen").style.display = "none";
        document.getElementById("app").style.display = "block";
    } else {
        document.getElementById("authScreen").style.display = "flex";
        document.getElementById("app").style.display = "none";
    }
});

// ===============================
// 🚪 LOGOUT
// ===============================
window.logout = function () {
    signOut(auth);
};

// ===============================
// 🔒 PIN SYSTEM (TU SISTEMA ORIGINAL MEJORADO)
// ===============================
let currentUnlockTarget = null;

window.checkPassword = function (target) {
    currentUnlockTarget = target;
    document.getElementById("passwordModal").style.display = "flex";
};

window.closeModal = function () {
    document.getElementById("passwordModal").style.display = "none";
    currentUnlockTarget = null;
};

// SHA256 seguro
async function sha256(text) {
    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", enc.encode(text));
    return [...new Uint8Array(hashBuffer)]
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

// PIN VERIFICACIÓN
window.verifyPin = async function () {
    const input = document.getElementById("pinInput").value;
    const msg = document.getElementById("pinMessage");

    const inputHash = await sha256(input);
    const validHash = await sha256("1234"); // 🔐 CAMBIA TU PIN

    if (inputHash === validHash) {
        msg.style.color = "lime";
        msg.innerText = "Acceso correcto";

        unlockMetric(currentUnlockTarget);
        setTimeout(closeModal, 500);
    } else {
        msg.style.color = "red";
        msg.innerText = "PIN incorrecto";
    }
};

function unlockMetric(target) {
    if (!target) return;

    document.querySelectorAll(".metric-" + target).forEach(el => {
        el.classList.remove("censored");
        const small = el.querySelector("small");
        if (small) small.innerText = "€0.00";
    });
}

// ===============================
// 💱 DIVISAS EN TIEMPO REAL
// ===============================
const currencyGrid = document.getElementById("currencyGrid");
const baseAmount = document.getElementById("baseAmount");
const baseCurrency = document.getElementById("baseCurrency");

const currencies = ["USD", "GBP", "JPY", "PEN", "PHP"];

async function getRates(base = "EUR") {
    try {
        const res = await fetch(`https://api.frankfurter.app/latest?from=${base}`);
        return await res.json();
    } catch {
        return {
            rates: {
                USD: 1.08,
                GBP: 0.85,
                JPY: 160,
                PEN: 4.0,
                PHP: 62
            }
        };
    }
}

async function updateCurrency() {
    if (!currencyGrid) return;

    const amount = parseFloat(baseAmount?.value || 1);
    const base = baseCurrency?.value || "EUR";

    const data = await getRates(base);

    currencyGrid.innerHTML = "";

    currencies.forEach(cur => {
        const rate = data.rates[cur] || 1;
        const value = (amount * rate).toFixed(2);

        const card = document.createElement("div");
        card.className = "currency-card";
        card.innerHTML = `
            <h4>${cur}</h4>
            <p>${value}</p>
        `;

        currencyGrid.appendChild(card);
    });
}

baseAmount?.addEventListener("input", updateCurrency);
baseCurrency?.addEventListener("change", updateCurrency);

document.getElementById("refreshRatesBtn")?.addEventListener("click", updateCurrency);

updateCurrency();

// ===============================
// 📬 CONTACT FORM
// ===============================
document.getElementById("contactForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    document.getElementById("contactFeedback").innerText = "Mensaje enviado ✔";
    e.target.reset();
});

// ===============================
// 🧠 NAV SYSTEM (por si falla en tu HTML)
// ===============================
document.querySelectorAll(".nav-item")?.forEach(item => {
    item.addEventListener("click", () => {
        document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
        document.getElementById(item.dataset.section)?.classList.add("active");
    });
});
