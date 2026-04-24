// ==============================
// DASHBOARD PROFESIONAL - SCRIPT
// Firebase + Finanzas + PIN + Divisas
// ==============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  get,
  push,
  child
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

// ==============================
// FIREBASE INIT
// ==============================
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
const auth = getAuth(app);
const db = getDatabase(app);

// ==============================
// GLOBAL STATE
// ==============================
let currentUser = null;
let financeData = [];
let currencyRates = {};
let pinUnlocked = {};

// PIN (puedes cambiarlo)
const MASTER_PIN = "1234";

// ==============================
// AUTH SYSTEM
// ==============================

window.registerUser = async function(email, password) {
  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    await set(ref(db, "users/" + userCred.user.uid), {
      email,
      created: Date.now()
    });
    return userCred.user;
  } catch (e) {
    console.error("Register error", e);
    throw e;
  }
};

window.loginUser = async function(email, password) {
  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    return userCred.user;
  } catch (e) {
    console.error("Login error", e);
    throw e;
  }
};

window.logoutUser = function() {
  return signOut(auth);
};

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    loadFinance();
    console.log("Logged in:", user.email);
  } else {
    console.log("No user");
  }
});

// ==============================
// PIN SYSTEM
// ==============================
window.checkPassword = function(type) {
  if (pinUnlocked[type]) return showValue(type);

  const modal = document.getElementById("passwordModal");
  modal.style.display = "flex";
  modal.dataset.type = type;
};

window.verifyPin = function() {
  const input = document.getElementById("pinInput").value;
  const modal = document.getElementById("passwordModal");
  const type = modal.dataset.type;

  if (input === MASTER_PIN) {
    pinUnlocked[type] = true;
    showValue(type);
    closeModal();
  } else {
    document.getElementById("pinMessage").innerText = "PIN incorrecto";
  }
};

window.closeModal = function() {
  document.getElementById("passwordModal").style.display = "none";
  document.getElementById("pinInput").value = "";
  document.getElementById("pinMessage").innerText = "";
};

function showValue(type) {
  const map = {
    ingresos: "dashIncomeMonth",
    gastosmes: "dashExpenseMonth",
    saldo: "dashBalanceLocked",
    gastos: "dashExpenseLocked"
  };

  const el = document.getElementById(map[type]);
  if (el) el.innerText = "€" + (Math.random() * 3000).toFixed(2);
}

// ==============================
// FINANCE SYSTEM
// ==============================

async function saveFinance(entry) {
  if (!currentUser) return;
  const newRef = push(ref(db, "finance/" + currentUser.uid));
  await set(newRef, entry);
}

async function loadFinance() {
  if (!currentUser) return;
  const snap = await get(ref(db, "finance/" + currentUser.uid));
  financeData = snap.exists() ? Object.values(snap.val()) : [];
  renderFinance();
}

function renderFinance() {
  const tbody = document.getElementById("incomeTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  financeData.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.date}</td>
      <td>${item.type}</td>
      <td>${item.concept}</td>
      <td>${item.category}</td>
      <td>${item.method}</td>
      <td>€${item.amount}</td>
      <td>✔</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==============================
// CURRENCY SYSTEM (REAL TIME)
// ==============================

async function fetchRates() {
  try {
    const res = await fetch("https://api.exchangerate.host/latest?base=EUR");
    const data = await res.json();
    currencyRates = data.rates;

    document.getElementById("currencyStatusBadge").innerText = "Tasas en tiempo real";
    document.getElementById("ratesUpdatedAt").innerText = new Date().toLocaleTimeString();

    renderCurrency();
  } catch (e) {
    console.error("Currency error", e);
  }
}

function renderCurrency() {
  const base = document.getElementById("baseCurrency")?.value || "EUR";
  const amount = parseFloat(document.getElementById("baseAmount")?.value || 1);

  const grid = document.getElementById("currencyGrid");
  if (!grid) return;

  grid.innerHTML = "";

  Object.keys(currencyRates).slice(0, 6).forEach((cur) => {
    const converted = (amount / currencyRates[base]) * currencyRates[cur];

    const div = document.createElement("div");
    div.className = "currency-card-item";
    div.innerHTML = `
      <strong>${cur}</strong>
      <span>${converted.toFixed(2)}</span>
    `;
    grid.appendChild(div);
  });
}

// ==============================
// CONTACT FORM
// ==============================

document.getElementById("contactForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  document.getElementById("contactFeedback").innerText = "Mensaje enviado ✔";
});

// ==============================
// INIT
// ==============================

document.addEventListener("DOMContentLoaded", () => {
  fetchRates();
  setInterval(fetchRates, 60000);

  document.getElementById("baseAmount")?.addEventListener("input", renderCurrency);
  document.getElementById("baseCurrency")?.addEventListener("change", renderCurrency);
});
