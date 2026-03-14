/* =========================================
   CIVICSEWA CITIZEN: SETTINGS LOGIC
   Path: js/citizen/settings.js
========================================= */

import { auth, db } from "../core/firebase-config.js";
import { onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

let currentUser = null;

// Helper to safely inject text
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value != null && value !== "" ? value : "—";
}

// ================= AUTH & LOAD PROFILE =================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../../login.html";
        return;
    }
    currentUser = user;

    // Set fallback defaults from Auth object
    setText("uNameTop", user.displayName || user.email.split('@')[0]);
    setText("settingsEmail", user.email);
    setText("settingsFullName", user.displayName || "Citizen");

    // Fetch rich data from Firestore
    try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
            const data = snap.data();
            setText("uNameTop", data.fullName || user.email.split('@')[0]);
            
            const wardTxt = data.wardNumber ? `Ward ${data.wardNumber}` : "Ward --";
            const muniTxt = data.municipality ? `, ${data.municipality}` : "";
            setText("uWard", wardTxt + muniTxt);
            
            setText("settingsFullName", data.fullName);
            setText("settingsWard", data.wardNumber);
            setText("settingsMunicipality", data.municipality);
            
            // Update the large avatar initial
            const avatarInitial = document.getElementById("avatarInitial");
            if(avatarInitial && data.fullName) {
                avatarInitial.innerText = data.fullName.charAt(0).toUpperCase();
            }
        }
    } catch (err) {
        console.error("Error loading profile data:", err);
    }
});

// ================= NOTIFICATION PREFERENCES =================
// Load saved notification preferences from LocalStorage
const savedNotif = localStorage.getItem("civicsewa_notif_prefs");
if (savedNotif) {
    try {
        const prefs = JSON.parse(savedNotif);
        document.getElementById("notifComplaints").checked = prefs.complaints !== false;
        document.getElementById("notifBroadcast").checked = prefs.broadcast !== false;
        document.getElementById("notifEmergency").checked = prefs.emergency === true;
        document.getElementById("notifEmail").checked = prefs.email !== false;
    } catch (_) {}
}

// Save Preferences
const saveNotifBtn = document.getElementById("saveNotifBtn");
if (saveNotifBtn) {
    saveNotifBtn.addEventListener("click", () => {
        const prefs = {
            complaints: document.getElementById("notifComplaints").checked,
            broadcast: document.getElementById("notifBroadcast").checked,
            emergency: document.getElementById("notifEmergency").checked,
            email: document.getElementById("notifEmail").checked,
        };
        localStorage.setItem("civicsewa_notif_prefs", JSON.stringify(prefs));
        
        // UX Feedback
        const originalText = saveNotifBtn.innerHTML;
        saveNotifBtn.innerHTML = '<i class="bi bi-check-circle"></i> Saved!';
        saveNotifBtn.classList.replace("btn-glass-primary", "btn-success");
        setTimeout(() => {
            saveNotifBtn.innerHTML = originalText;
            saveNotifBtn.classList.replace("btn-success", "btn-glass-primary");
        }, 2000);
    });
}

// ================= SECURE PASSWORD RESET =================
const resetPwdBtn = document.getElementById("resetPasswordBtn");
if (resetPwdBtn) {
    resetPwdBtn.addEventListener("click", async () => {
        if (!currentUser || !currentUser.email) return;
        
        if (confirm(`Send a secure password reset link to ${currentUser.email}?`)) {
            resetPwdBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Sending...';
            resetPwdBtn.disabled = true;
            
            try {
                await sendPasswordResetEmail(auth, currentUser.email);
                alert("Security Email Sent! Please check your inbox to safely reset your password.");
                resetPwdBtn.innerHTML = '<i class="bi bi-envelope-check"></i> Email Sent';
            } catch (e) {
                console.error(e);
                alert("Error sending reset email. Please try again later.");
                resetPwdBtn.innerHTML = '<i class="bi bi-shield-lock me-2"></i> Send Reset Link';
                resetPwdBtn.disabled = false;
            }
        }
    });
}