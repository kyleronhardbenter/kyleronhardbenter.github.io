import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

// ================= FIREBASE =================
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_AUTH",
    projectId: "TU_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ================= LOGIN STATE =================
let isLogin = true;

// ================= UI LOGIN =================
window.toggleMode = function () {
    isLogin = !isLogin;
    document.getElementById("authTitle").innerText = isLogin ? "Login" : "Registro";
};

window.authAction = function () {
    const email = document.getElementById("email").value;
    const pass = document.getElementById("password").value;

    if (isLogin) {
        signInWithEmailAndPassword(auth, email, pass)
            .catch(e => alert("Error login: " + e.message));
    } else {
        createUserWithEmailAndPassword(auth, email, pass)
            .catch(e => alert("Error registro: " + e.message));
    }
};

// ================= SESSION CONTROL =================
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById("authScreen").style.display = "none";
        document.getElementById("app").style.display = "block";
    } else {
        document.getElementById("authScreen").style.display = "flex";
        document.getElementById("app").style.display = "none";
    }
});

// ================= LOGOUT =================
window.logout = function () {
    signOut(auth);
};

// =====================================================
// 🔥 IMPORTANTE:
// TU CÓDIGO ORIGINAL (PIN, FINANZAS, DIVISAS, ETC)
// SIGUE FUNCIONANDO SIN CAMBIOS
// SOLO SE AÑADE CONTROL DE ACCESO ENCIMA
// =====================================================
