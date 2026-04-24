// ================================
// 🔥 FIREBASE INIT (GITHUB PAGES SAFE)
// ================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

// ================================
// CONFIG FIREBASE
// ================================

const firebaseConfig = {
    apiKey: "AIzaSyD-ET-NddOEtiNvSt7787wxVbGoDj8-kas",
    authDomain: "website-cc7ff.firebaseapp.com",
    databaseURL: "https://website-cc7ff-default-rtdb.firebaseio.com",
    projectId: "website-cc7ff",
    storageBucket: "website-cc7ff.appspot.com",
    messagingSenderId: "755069923532",
    appId: "1:755069923532:web:62384a64fb880100ff1269"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ================================
// 🔐 LOGIN
// ================================

window.login = async function () {
    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value.trim();

    if (!email || !pass) {
        document.getElementById("authMsg").innerText = "Rellena todos los campos";
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        document.getElementById("authMsg").innerText = "Login correcto";
    } catch (e) {
        console.error(e.code);

        if (e.code === "auth/invalid-credential") {
            document.getElementById("authMsg").innerText = "Usuario o contraseña incorrectos";
        } else {
            document.getElementById("authMsg").innerText = e.message;
        }
    }
};

// ================================
// 🧾 REGISTRO
// ================================

window.register = async function () {
    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value.trim();

    if (!email || !pass) {
        document.getElementById("authMsg").innerText = "Rellena todos los campos";
        return;
    }

    try {
        await createUserWithEmailAndPassword(auth, email, pass);
        document.getElementById("authMsg").innerText = "Usuario creado correctamente";
    } catch (e) {
        document.getElementById("authMsg").innerText = e.message;
    }
};

// ================================
// 🚪 LOGOUT
// ================================

window.logout = async function () {
    await signOut(auth);
};

// ================================
// 👁 CONTROL DE SESIÓN
// ================================

onAuthStateChanged(auth, (user) => {
    const authScreen = document.getElementById("authScreen");
    const app = document.getElementById("app");

    if (user) {
        authScreen.style.display = "none";
        app.style.display = "block";
        console.log("👤 Usuario:", user.email);
    } else {
        authScreen.style.display = "flex";
        app.style.display = "none";
    }
});
