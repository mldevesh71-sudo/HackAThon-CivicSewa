/* =========================================
   CIVICSEWA CITIZEN: MY COMPLAINTS LOGIC
   Handles form submission and live tracking feed.
========================================= */

import { auth, db } from "../core/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, getDoc, collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

let currentUser = null;
let userWard = "N/A";
let userMunicipality = "N/A";

// ================= AUTH & INIT =================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../../login.html";
        return;
    }
    currentUser = user;

    // Load User Meta Data
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
        const data = snap.data();
        document.getElementById("uNameTop").innerText = data.fullName;
        userWard = data.wardNumber || "N/A";
        userMunicipality = data.municipality || "N/A";
        
        const wardEl = document.getElementById("uWard");
        if (wardEl) wardEl.innerText = `Ward ${userWard}, ${userMunicipality}`;
    }

    // Start Real-time feed of complaints
    loadMyComplaints();
});

// ================= SUBMIT COMPLAINT =================
const complaintForm = document.getElementById("complaintForm");
const submitBtn = document.getElementById("submitBtn");

if (complaintForm) {
    complaintForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        if (!currentUser) return alert("Please login first.");

        // UI Loading State
        const originalText = document.getElementById("submitBtnText").innerText;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting...';
        submitBtn.disabled = true;

        const data = {
            title: document.getElementById("compTitle").value,
            category: document.getElementById("compCategory").value,
            description: document.getElementById("compDesc").value,
            location: document.getElementById("compLocation").value,
            municipality: userMunicipality,
            wardNumber: userWard,
            status: "Submitted", // Default status
            userId: currentUser.uid,
            createdAt: serverTimestamp(),
        };

        try {
            await addDoc(collection(db, "complaints"), data);
            
            // Success Reset
            complaintForm.reset();
            submitBtn.innerHTML = `<i class="bi bi-check-circle me-2"></i> Success!`;
            submitBtn.classList.replace("btn-glass-primary", "btn-success");
            
            setTimeout(() => {
                submitBtn.innerHTML = `<span id="submitBtnText">${originalText}</span>`;
                submitBtn.classList.replace("btn-success", "btn-glass-primary");
                submitBtn.disabled = false;
            }, 3000);

        } catch (error) {
            console.error("Error adding document: ", error);
            alert("Error submitting complaint. Please try again.");
            submitBtn.innerHTML = `<span id="submitBtnText">${originalText}</span>`;
            submitBtn.disabled = false;
        }
    });
}

// ================= FETCH & RENDER COMPLAINTS =================
function loadMyComplaints() {
    const listContainer = document.getElementById("complaintsListContainer");
    
    // Query: Only this user's complaints, newest first
    const q = query(
        collection(db, "complaints"),
        where("userId", "==", currentUser.uid),
        orderBy("createdAt", "desc")
    );

    // Real-time listener
    onSnapshot(q, (snapshot) => {
        listContainer.innerHTML = ""; // Clear loader

        if (snapshot.empty) {
            listContainer.innerHTML = `
                <div class="text-center text-muted mt-5">
                    <i class="bi bi-inbox fs-1 mb-2 d-block opacity-50"></i>
                    <p>You have no submitted complaints.</p>
                </div>
            `;
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            // Format Date safely
            const dateStr = data.createdAt?.toDate 
                ? data.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
                : "Just now";

            // Strip spaces for CSS class (e.g., "In Progress" -> "InProgress")
            const safeStatusClass = (data.status || "Submitted").replace(/\s+/g, '');

            const card = document.createElement("div");
            card.className = "complaint-list-card";
            card.innerHTML = `
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="status-badge status-${safeStatusClass}">
                        ${data.status}
                    </span>
                    <small class="text-muted" style="font-size: 0.75rem;">${dateStr}</small>
                </div>
                <h6 class="fw-bold mb-1">${data.title}</h6>
                <div class="d-flex gap-3 text-muted" style="font-size: 0.8rem;">
                    <span><i class="bi bi-tag"></i> ${data.category}</span>
                    <span><i class="bi bi-geo-alt"></i> ${data.location}</span>
                </div>
            `;
            
            listContainer.appendChild(card);
        });
    }, (error) => {
        console.error("Snapshot error:", error);
        listContainer.innerHTML = `<p class="text-danger text-center mt-3">Error loading data.</p>`;
    });
}

// ================= LOGOUT =================
const confirmSignOutBtn = document.getElementById("confirmSignOutBtn");
if (confirmSignOutBtn) {
    confirmSignOutBtn.addEventListener("click", () => {
        confirmSignOutBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
        signOut(auth).then(() => {
            window.location.href = "../../index.html"; 
        }).catch(err => console.error(err));
    });
}