import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

import {
    getDatabase,
    ref,
    set,
    get,
    child
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

// ================= FIREBASE =================
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

// ================= ELEMENTOS LOGIN =================
const authModal = document.getElementById("authModal");
const userBar = document.getElementById("userBar");
const userEmail = document.getElementById("userEmail");
const authMsg = document.getElementById("authMsg");

// ================= LOGIN =================
document.getElementById("loginBtn").addEventListener("click", async () => {
    try {
        await signInWithEmailAndPassword(
            auth,
            document.getElementById("authEmail").value,
            document.getElementById("authPassword").value
        );
        authMsg.textContent = "Login correcto";
    } catch (e) {
        authMsg.textContent = e.message;
    }
});

// ================= REGISTRO =================
document.getElementById("registerBtn").addEventListener("click", async () => {
    try {
        await createUserWithEmailAndPassword(
            auth,
            document.getElementById("authEmail").value,
            document.getElementById("authPassword").value
        );
        authMsg.textContent = "Usuario creado";
    } catch (e) {
        authMsg.textContent = e.message;
    }
});

// ================= LOGOUT =================
document.getElementById("logoutBtn").addEventListener("click", () => {
    signOut(auth);
});

// ================= ESTADO USUARIO =================
onAuthStateChanged(auth, (user) => {

    if (user) {
        authModal.style.display = "none";
        userBar.classList.remove("hidden");
        userEmail.textContent = user.email;

        // guardar login inicial
        set(ref(db, "usuarios/" + user.uid), {
            email: user.email,
            lastLogin: Date.now()
        });

        iniciarSistemaUsuario(user);

    } else {
        authModal.style.display = "flex";
        userBar.classList.add("hidden");
    }
});

// ================= TU SISTEMA ORIGINAL (HOOK) =================
function iniciarSistemaUsuario(user) {

    // 👉 AQUÍ VA TODO TU CÓDIGO ORIGINAL SIN TOCAR
    // (dashboard, finanzas, gráficos, etc)

    console.log("Usuario logueado:", user.email);

    // EJEMPLO: autoguardado global
    setInterval(() => {
        if (!auth.currentUser) return;

        set(ref(db, "usuarios/" + user.uid), {
            email: user.email,
            lastActive: Date.now(),

            // 🔥 aquí puedes guardar datos de tu dashboard
            ingresos: window.ingresos || 0,
            gastos: window.gastos || 0,
            balance: window.balance || 0
        });

    }, 15000);
}

// ================= EJEMPLO FUNCIONES (TU DASHBOARD) =================
// puedes conectar esto a tu código real
window.ingresos = 0;
window.gastos = 0;
window.balance = 0;

// ejemplo de actualización segura
window.actualizarDatos = function (i, g) {
    window.ingresos = i;
    window.gastos = g;
    window.balance = i - g;
};
