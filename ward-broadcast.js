import { auth, db } from "../core/firebase-config.js";
import { onAuthStateChanged, signOut } from "";
import { collection, addDoc, deleteDoc, doc, getDoc, query, orderBy, onSnapshot, serverTimestamp } from "";

document.addEventListener("DOMContentLoaded", () => {
const container = document.getElementById("broadcastContainer");
const postBtn = document.getElementById("postBtn");
let currentAdmin = null;

// ================= AUTHENTICATION SECURITY =================
onAuthStateChanged(auth, async (user) => {
if (!user) {
window.location.href = "login.html";
return;
}
currentAdmin = user;

});

// Logout Logic
document.getElementById("logoutBtn")?.addEventListener("click", () => {
signOut(auth).then(() => (window.location.href = "login.html"));
});

if (!container || !postBtn) return;

// ================= REAL-TIME LISTENER =================
const q = query(collection(db, "broadcasts"), orderBy("createdAt", "desc"));

onSnapshot(q, (snapshot) => {
container.innerHTML = ""; // Clear for re-render

});

// ================= CREATE BROADCAST =================
postBtn.addEventListener("click", async () => {
if (!currentAdmin) {
alert("You must be logged in as an Admin to post.");
return;
}

});
});