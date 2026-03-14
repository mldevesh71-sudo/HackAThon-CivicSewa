/* =========================================
   CIVICSEWA CITIZEN: BROADCAST CHANNEL LOGIC
   Path: js/citizen/broadcast.js
========================================= */

import { auth, db } from "../core/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, getDoc, collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
// import { translateBroadcast } from "../core/translator.js"; // Assuming you have this module

let cachedBroadcasts = [];
let userWard = "N/A";
let userMunicipality = "N/A";

// ================= AUTH & INIT =================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../../login.html";
        return;
    }
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
        const data = snap.data();
        const nameEl = document.getElementById("uNameTop");
        if (nameEl) nameEl.innerText = data.fullName || "";
        userWard = data.wardNumber || "N/A";
        userMunicipality = data.municipality || "N/A";
        
        const wardEl = document.getElementById("uWard");
        if (wardEl) {
            wardEl.innerText = `Ward ${userWard}, ${userMunicipality}`;
        }
    }
});

// ================= RENDER LOGIC =================
const categoryMap = {
    Water: { color: "0d6efd", icon: "bi-droplet-fill" },
    Road: { color: "dc3545", icon: "bi-cone-striped" },
    Waste: { color: "198754", icon: "bi-trash-fill" },
    General: { color: "FFD700", icon: "bi-megaphone-fill" }, // Gold for general
    Electricity: { color: "ffc107", icon: "bi-lightning-charge-fill" },
};

async function renderBroadcasts() {
    const container = document.getElementById("broadcastContainer");
    if (!container) return;

    if (cachedBroadcasts.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center mt-5 text-muted">
                <i class="bi bi-inbox fs-1 d-block mb-3 opacity-50"></i>
                <p>No official broadcasts available at this time.</p>
            </div>`;
        return;
    }

    container.innerHTML = "";

    // For now, bypassing external translation API to guarantee render speed.
    // You can re-inject your translateBroadcast() logic here if needed.
    cachedBroadcasts.forEach((data) => {
        const catStyle = categoryMap[data.category] || categoryMap["General"];
        
        const dateString = data.createdAt?.toDate 
            ? data.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute:'2-digit' }) 
            : "Just now";
            
        // Emergency Styling vs Standard
        const borderColor = data.emergency ? "#dc3545" : `#${catStyle.color}`;
        const borderClass = data.emergency ? "border-danger border-2" : "border-secondary";
        const emergencyGlow = data.emergency ? "box-shadow: 0 0 20px rgba(220, 53, 69, 0.2);" : "";
        const titleColor = data.emergency ? "text-danger" : "text-white";
        const badgeBg = data.emergency ? "bg-danger text-white" : "bg-dark text-light border border-secondary";
        const badgeText = data.emergency ? "EMERGENCY ALERT" : data.category.toUpperCase();
        const icon = data.emergency ? "bi-exclamation-triangle-fill" : catStyle.icon;

        container.innerHTML += `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="glass-box h-100 ${borderClass} position-relative overflow-hidden" style="${emergencyGlow}">
                    
                    ${data.emergency ? '<div style="position:absolute; top:0; left:0; width:4px; height:100%; background:#dc3545;"></div>' : ''}
                    
                    <div class="p-4 d-flex flex-column h-100">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <span class="badge ${badgeBg} px-2 py-1" style="font-size: 0.7rem; letter-spacing: 1px;">
                                <i class="bi ${icon} me-1"></i> ${badgeText}
                            </span>
                            <small class="text-muted" style="font-size: 0.75rem;">${dateString}</small>
                        </div>
                        
                        <h5 class="${titleColor} fw-bold mb-3 lh-base">
                            ${data.title}
                        </h5>
                        
                        <p class="text-muted small mb-0 flex-grow-1" style="line-height: 1.6;">
                            ${data.content}
                        </p>
                        
                        <div class="mt-4 pt-3 border-top border-secondary border-opacity-25 text-end">
                            <span class="text-info small" style="cursor:pointer;"><i class="bi bi-share me-1"></i> Share</span>
                        </div>
                    </div>
                </div>
            </div>`;
    });
}

// ================= FIRESTORE LISTENER =================
const q = query(collection(db, "broadcasts"), orderBy("createdAt", "desc"));
onSnapshot(q, async (snapshot) => {
    cachedBroadcasts = [];
    snapshot.forEach((docSnap) => {
        const raw = docSnap.data();
        cachedBroadcasts.push({
            title: raw.title || "",
            content: raw.content || "",
            category: raw.category || "General",
            emergency: raw.emergency || false,
            createdAt: raw.createdAt,
        });
    });
    await renderBroadcasts();
}, (error) => {
    console.error("Error fetching broadcasts: ", error);
});