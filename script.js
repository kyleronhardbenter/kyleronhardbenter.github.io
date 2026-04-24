// ==============================
// DASHBOARD PROFESIONAL - SCRIPT (PRO UPDATE)
// Firebase + Auth + Logout + User UI + Autosave + Divisas
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
  push
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
// STATE
// ==============================
let currentUser = null;
let financeData = [];
let pinUnlocked = {};

const MASTER_PIN = "1234";

// ==============================
// UI USER HEADER
// ==============================
function renderUserUI(user) {
  let old = document.getElementById("userBar");
  if (old) old.remove();

  const bar = document.createElement("div");
  bar.id = "userBar";
  bar.style = "position:fixed;top:10px;right:10px;background:#111;color:#fff;padding:10px 15px;border-radius:10px;z-index:9999;display:flex;gap:10px;align-items:center";

  bar.innerHTML = `
    <span>👤 ${user.email}</span>
    <button id="logoutBtn" style="cursor:pointer;padding:5px 10px;border-radius:6px;border:none;background:red;color:white">Logout</button>
  `;

  document.body.appendChild(bar);

  document.getElementById("logoutBtn").onclick = async () => {
    await signOut(auth);
    location.reload();
  };
}

// ==============================
// AUTH
// ==============================
window.registerUser = async (email, password) => {
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  await set(ref(db, "users/" + userCred.user.uid), { email });
  return userCred.user;
};

window.loginUser = async (email, password) => {
  const userCred = await signInWithEmailAndPassword(auth, email, password);
  return userCred.user;
};

onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (user) {
    renderUserUI(user);
    loadFinance();
  }
});

// ==============================
// PIN
// ==============================
window.checkPassword = (type) => {
  if (pinUnlocked[type]) return showValue(type);
  document.getElementById("passwordModal").style.display = "flex";
  document.getElementById("passwordModal").dataset.type = type;
};

window.verifyPin = () => {
  const input = document.getElementById("pinInput").value;
  const type = document.getElementById("passwordModal").dataset.type;

  if (input === MASTER_PIN) {
    pinUnlocked[type] = true;
    showValue(type);
    closeModal();
  } else {
    document.getElementById("pinMessage").innerText = "PIN incorrecto";
  }
};

window.closeModal = () => {
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
// AUTOSAVE FINANCE
// ==============================
let saveTimeout;

function autosave(entry) {
  clearTimeout(saveTimeout);

  saveTimeout = setTimeout(async () => {
    if (!currentUser) return;

    const newRef = push(ref(db, "finance/" + currentUser.uid));
    await set(newRef, entry);

    console.log("Auto-guardado ✔");
    loadFinance();
  }, 800);
}

// ==============================
// LOAD FINANCE
// ==============================
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

  financeData.forEach((i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i.date}</td>
      <td>${i.type}</td>
      <td>${i.concept}</td>
      <td>${i.category}</td>
      <td>${i.method}</td>
      <td>€${i.amount}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==============================
// FORM FINANCE
// ==============================

window.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("incomeForm");

  form?.addEventListener("input", () => {
    const entry = {
      date: document.getElementById("incomeDate")?.value,
      concept: document.getElementById("incomeConcept")?.value,
      type: document.getElementById("incomeType")?.value,
      amount: document.getElementById("incomeAmount")?.value
    };

    if (entry.date && entry.concept && entry.amount) {
      autosave(entry);
    }
  });
});
