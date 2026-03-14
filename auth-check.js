/* =========================================
   CIVICSEWA AUTHENTICATION CONTROLLER
   Path: js/core/auth-check.js
========================================= */
import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// Redirect if already logged in (Only runs on login/signup pages)
onAuthStateChanged(auth, (user) => {
  if (user) {
    user.reload().then(() => {
      if (user.emailVerified) {
        getDoc(doc(db, "users", user.uid)).then((snap) => {
          if (!snap.exists()) {
            window.location.href = "views/citizen/dashboard.html"; // PATH FIX
            return;
          }
          const data = snap.data();
          const role = (data.role || "").toString().toLowerCase().trim();
          
          if (role === "ward") {
            window.location.href = "views/ward/ward-dashboard.html"; // PATH FIX
          } else {
            window.location.href = "views/citizen/dashboard.html"; // PATH FIX
          }
        }).catch((e) => {
          console.error("Error fetching user data:", e);
        });
      } else {
        // Show verification modal if on auth pages
        const verifyEl = document.getElementById("verifyEmail");
        if(verifyEl) {
            verifyEl.textContent = user.email;
            const verificationModal = new bootstrap.Modal(document.getElementById("verificationModal"));
            verificationModal.show();
        }
      }
    });
  }
});

// --- Login Logic ---
const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value;
    const pass = document.getElementById("loginPassword").value;
    const originalText = loginBtn.innerText;

    if (!email || !pass) return alert("Please enter both email and password.");

    loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Signing In...';
    
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, pass);
      await userCred.user.reload();
      
      if (!userCred.user.emailVerified) {
        alert("Please verify your email before logging in.");
        auth.signOut();
        loginBtn.innerText = originalText;
        return;
      }
      
      // Fetch role and redirect
      const snap = await getDoc(doc(db, "users", userCred.user.uid));
      if (snap.exists()) {
        const role = (snap.data().role || "").toString().toLowerCase().trim();
        window.location.href = role === "ward" ? "views/ward/ward-dashboard.html" : "views/citizen/dashboard.html";
      } else {
        window.location.href = "views/citizen/dashboard.html";
      }
    } catch (e) {
      alert("Login Error: " + e.message);
      loginBtn.innerText = originalText;
    }
  });
}

// --- Register Logic ---
const registerBtn = document.getElementById("registerBtn");
if (registerBtn) {
  registerBtn.addEventListener("click", async () => {
    const email = document.getElementById("regEmail").value;
    const pass = document.getElementById("regPass").value;
    const name = document.getElementById("fullName").value;
    const ward = document.getElementById("ward").value;
    const muni = document.getElementById("muni").value;
    const userTypeElem = document.getElementById("userType");
    let userType = userTypeElem ? userTypeElem.value.toString().toLowerCase() : "resident";
    
    if (!email || !pass || !name) return alert("Please provide Name, Email, and Password.");

    const originalText = registerBtn.innerText;
    registerBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Creating...';

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await sendEmailVerification(cred.user);
      
      await setDoc(doc(db, "users", cred.user.uid), {
        fullName: name,
        wardNumber: ward || "N/A",
        municipality: muni || "N/A",
        role: userType,
        email: email,
        emailVerified: false,
      });
      
      document.getElementById("verifyEmail").textContent = email;
      const verificationModal = new bootstrap.Modal(document.getElementById("verificationModal"));
      verificationModal.show();
      
      document.getElementById("regForm").reset();
      registerBtn.innerText = originalText;
    } catch (e) {
      console.error("Registration Error:", e);
      alert("Registration Error: " + e.message);
      registerBtn.innerText = originalText;
    }
  });
}