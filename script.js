// ================================
// 🔥 FIREBASE (GITHUB PAGES SAFE)
// ================================

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
    child,
    push,
    update
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

// ================================
// 🔧 CONFIG FIREBASE
// ================================

const firebaseConfig = {
    apiKey: "AIzaSyD-ET-NddOEtiNvSt7787wxVbGoDj8-kas",
    authDomain: "website-cc7ff.firebaseapp.com",
    databaseURL: "https://website-cc7ff-default-rtdb.firebaseio.com",
    projectId: "website-cc7ff",
    storageBucket: "website-cc7ff.appspot.com", // ✔ FIX IMPORTANTE
    messagingSenderId: "755069923532",
    appId: "1:755069923532:web:62384a64fb880100ff1269"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

console.log("🔥 Firebase listo");

// ================================
// 👤 REGISTRO
// ================================

window.registerUser = async function(email, password, extraData = {}) {
    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCred.user;

        await set(ref(db, "users/" + user.uid), {
            email: email,
            createdAt: Date.now(),
            ...extraData
        });

        console.log("✅ Usuario registrado");
        return user;

    } catch (error) {
        console.error("❌ Error registro:", error.message);
        alert(error.message);
    }
};

// ================================
// 🔐 LOGIN
// ================================

window.loginUser = async function(email, password) {
    try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        console.log("✅ Login correcto");
        return userCred.user;

    } catch (error) {
        console.error("❌ Error login:", error.message);
        alert(error.message);
    }
};

// ================================
// 🚪 LOGOUT
// ================================

window.logoutUser = async function() {
    await signOut(auth);
    console.log("👋 Sesión cerrada");
};

// ================================
// 👀 ESTADO USUARIO
// ================================

onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("👤 Usuario activo:", user.email);

        const snapshot = await get(child(ref(db), "users/" + user.uid));
        if (snapshot.exists()) {
            console.log("📦 Datos usuario:", snapshot.val());
        }

        // 👉 aquí conectas tu dashboard
        document.body.classList.add("logged");
    } else {
        console.log("🚫 No hay usuario");
        document.body.classList.remove("logged");
    }
});

// ================================
// 💾 GUARDAR DATOS (FINANZAS / DASHBOARD)
// ================================

window.saveData = async function(path, data) {
    try {
        await push(ref(db, path), {
            ...data,
            timestamp: Date.now()
        });

        console.log("💾 Datos guardados");
    } catch (err) {
        console.error("❌ Error DB:", err);
    }
};

// ================================
// 📊 LEER DATOS
// ================================

window.getData = async function(path) {
    try {
        const snapshot = await get(ref(db, path));
        return snapshot.exists() ? snapshot.val() : null;
    } catch (err) {
        console.error("❌ Error lectura:", err);
    }
};

// ================================
// 🔐 PIN SIMPLE (OPCIONAL TU DASHBOARD)
// ================================

const DASHBOARD_PIN = "1234"; // cámbialo

window.verifyPin = function(input) {
    return input === DASHBOARD_PIN;
};
