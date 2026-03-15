import { auth, db } from "../core/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { collection, doc, updateDoc, query, where, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { translateComplaint } from "../core/translator.js";

let currentUserWard = "N/A";
let cachedDocs = []; 

// ================= AUTH & INIT =================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../../login.html";
        return;
    }
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
        const userData = snap.data();
        currentUserWard = userData.wardNumber || "N/A";
        if(document.getElementById("uWard")) document.getElementById("uWard").innerText = `Ward ${currentUserWard}`;
        if(document.getElementById("uNameTop")) document.getElementById("uNameTop").innerText = userData.fullName || "Official";
        loadComplaints();
    }
});

// ================= FETCH COMPLAINTS =================
function loadComplaints() {
    // Note: Assuming citizen complaints are saved with the field "ward" to match your system. 
    // If citizens save it as "wardNumber", change this line to where("wardNumber", "==", currentUserWard)
    const q = query(
        collection(db, "complaints"),
        where("ward", "==", currentUserWard) 
    );

    onSnapshot(q, (snapshot) => {
        cachedDocs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Sort by date newest first
        cachedDocs.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
        renderComplaints();
    });
}

// ================= RENDER LOGIC =================
async function renderComplaints() {
    const container = document.getElementById("complaintsContainer");
    if (!container) return;

    const lang = localStorage.getItem("lang") || "en";

    if (cachedDocs.length === 0) {
        container.innerHTML = `<div class="col-12 text-center mt-5 text-muted"><h5>No complaints reported for this ward yet.</h5></div>`;
        return;
    }

    if (lang === "np") {
        container.innerHTML = `<div class="col-12 text-center mt-5"><div class="spinner-border text-secondary"></div><p class="text-muted mt-2">Translating...</p></div>`;
    }

    let tempHtml = "";

    for (const data of cachedDocs) {
        let displayData = { ...data };

        if (lang === "np") {
            try { displayData = await translateComplaint(data, "np"); } 
            catch (e) { console.error("Translation Error", e); }
        }

        // Determine Status Styles
        let badgeClass = "bg-primary";
        if (data.status === "In Progress") badgeClass = "bg-warning text-dark";
        if (data.status === "Resolved") badgeClass = "bg-success";

        const dateStr = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : "Unknown Date";
        const priorityClass = data.isHighPriority ? "high-priority" : "";
        const checkedAttr = data.isHighPriority ? "checked" : "";

        // Build Photo Gallery
        let photosHtml = "";
        if (data.photoUrls && data.photoUrls.length > 0) {
            const imgs = data.photoUrls.map(url => `<img src="${url}" class="photo-thumbnail" onclick="window.open('${url}', '_blank')">`).join('');
            photosHtml = `<div class="d-flex flex-wrap gap-2 mt-3 p-2 rounded" style="background: rgba(0,0,0,0.2);">${imgs}</div>`;
        }

        tempHtml += `
            <div class="col-md-6 search-target">
                <div class="glass-box p-4 complaint-card shadow-sm ${priorityClass}">
                    
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="fw-bold text-light search-text mb-0">${displayData.title}</h5>
                        <span class="badge ${badgeClass}">${data.status || 'Open'}</span>
                    </div>

                    <p class="text-muted small border-bottom border-secondary border-opacity-25 pb-2 mb-2 search-text">
                        <i class="bi bi-person me-1"></i>${data.userName || "Citizen"} • 
                        <i class="bi bi-geo-alt ms-2 me-1"></i>${data.location || "Unknown"} •
                        <i class="bi bi-clock ms-2 me-1"></i>${dateStr}
                    </p>

                    <p class="card-text text-light flex-grow-1 search-text" style="font-size: 0.9rem;">${displayData.description}</p>
                    
                    ${photosHtml}
                    
                    <div class="d-flex justify-content-between align-items-center mt-4 pt-3 border-top border-secondary border-opacity-25">
                        
                        <div class="form-check form-switch">
                            <input class="form-check-input priority-toggle" type="checkbox" data-id="${data.id}" id="priority-${data.id}" ${checkedAttr}>
                            <label class="form-check-label small fw-bold text-danger" for="priority-${data.id}">High Priority</label>
                        </div>

                        <div class="d-flex align-items-center gap-2">
                            <span class="small text-muted">Update:</span>
                            <select class="form-select form-select-sm admin-input status-select" data-id="${data.id}" style="width: 140px;">
                                <option value="Open" ${data.status === 'Open' ? 'selected' : ''} style="background: #110d20;">Open</option>
                                <option value="In Progress" ${data.status === 'In Progress' ? 'selected' : ''} style="background: #110d20;">In Progress</option>
                                <option value="Resolved" ${data.status === 'Resolved' ? 'selected' : ''} style="background: #110d20;">Resolved</option>
                            </select>
                        </div>

                    </div>
                </div>
            </div>`;
    }

    container.innerHTML = tempHtml;
}

// ================= EVENT DELEGATION (Secure Updates) =================
// Instead of exposing global functions, we listen to the container for changes.
document.getElementById("complaintsContainer")?.addEventListener("change", async (e) => {
    
    // Handle Status Change
    if (e.target.classList.contains("status-select")) {
        const docId = e.target.getAttribute("data-id");
        const newStatus = e.target.value;
        try {
            await updateDoc(doc(db, "complaints", docId), { status: newStatus });
            // Note: onSnapshot will auto-trigger a re-render!
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Failed to update status.");
        }
    }

    // Handle Priority Toggle
    if (e.target.classList.contains("priority-toggle")) {
        const docId = e.target.getAttribute("data-id");
        const isHigh = e.target.checked;
        try {
            await updateDoc(doc(db, "complaints", docId), { isHighPriority: isHigh });
        } catch (error) {
            console.error("Error updating priority:", error);
            alert("Failed to update priority.");
            e.target.checked = !isHigh; // revert UI
        }
    }
});

// ================= SEARCH FRONTEND =================
document.getElementById("searchInput")?.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    const cards = document.querySelectorAll(".search-target");
    
    cards.forEach((card) => {
        // Find all text inside elements marked with search-text
        const textToSearch = Array.from(card.querySelectorAll(".search-text"))
                                  .map(el => el.innerText.toLowerCase())
                                  .join(" ");
        
        if (textToSearch.includes(term)) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
});

// ================= LANGUAGE & LOGOUT =================
const langSelect = document.getElementById("languageSelect");
if (langSelect) {
    langSelect.value = localStorage.getItem("lang") || "en";
    langSelect.addEventListener("change", () => {
        localStorage.setItem("lang", langSelect.value);
        renderComplaints(); 
    });
}

document.getElementById("logoutBtn")?.addEventListener("click", () => {
    signOut(auth).then(() => (window.location.href = "../../index.html"));
});