import { db, auth } from "../core/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { collection, addDoc, deleteDoc, doc, query, where, orderBy, onSnapshot, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { translateBroadcast } from "../core/translator.js";

let cachedBroadcasts = [];
let currentUserWard = "N/A";
let userMunicipality = "N/A";
let unsubscribe = null; 

// ================= MAP PICKER LOGIC =================
let modalMap;
let selectionMarker;
const createModalEl = document.getElementById('createModal');

if (createModalEl) {
    createModalEl.addEventListener('shown.bs.modal', () => {
        if (!modalMap) {
            // Centered on Lalitpur area
            modalMap = L.map('modalMap').setView([27.6756, 85.3236], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(modalMap);

            modalMap.on('click', (e) => {
                const { lat, lng } = e.latlng;
                document.getElementById('latInput').value = lat.toFixed(6);
                document.getElementById('lngInput').value = lng.toFixed(6);

                if (selectionMarker) {
                    selectionMarker.setLatLng(e.latlng);
                } else {
                    selectionMarker = L.marker(e.latlng).addTo(modalMap);
                }
            });
        }
        // Force map to resize correctly when modal opens
        setTimeout(() => { modalMap.invalidateSize(); }, 100);
    });
}

// ================= AUTH & USER INFO =================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../../login.html";
        return;
    }
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
        const data = snap.data();
        currentUserWard = data.wardNumber || "N/A";
        userMunicipality = data.municipality || "N/A";
        
        if (document.getElementById("uWard")) document.getElementById("uWard").innerText = `Ward ${currentUserWard}`;
        if (document.getElementById("uNameTop")) document.getElementById("uNameTop").innerText = data.fullName || "Official";
        
        initListener();
    }
});

// ================= REAL-TIME LISTENER =================
function initListener() {
    if (unsubscribe) unsubscribe(); 

    // SECURE: Only fetch broadcasts for THIS ward
    const q = query(
        collection(db, "ward-broadcasts"), 
        where("ward", "==", currentUserWard),
        orderBy("createdAt", "desc")
    );
    
    unsubscribe = onSnapshot(q, (snapshot) => {
        cachedBroadcasts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderBroadcasts();
    });
}

// ================= RENDER LOGIC =================
async function renderBroadcasts() {
    const container = document.getElementById("broadcastContainer");
    if (!container) return;

    const lang = localStorage.getItem("lang") || "en";

    if (cachedBroadcasts.length === 0) {
        container.innerHTML = '<div class="col-12 text-center mt-5 text-muted"><h5>No active broadcasts found for this ward.</h5></div>';
        return;
    }

    if (lang === "np") {
        container.innerHTML = '<div class="col-12 text-center mt-5"><div class="spinner-border text-secondary"></div><p class="text-muted mt-2">Translating...</p></div>';
    }

    const categoryStyles = {
        "Water & Sanitation": "text-primary",
        "Roads & Transport": "text-info",
        "Waste Management": "text-success",
        "Electricity": "text-warning",
        "General Announcement": "text-light"
    };

    let tempHtml = "";

    for (const rawData of cachedBroadcasts) {
        let displayData = { ...rawData };

        if (lang === "np") {
            try { displayData = await translateBroadcast(rawData, "np"); } 
            catch (e) { console.error("Translation Error", e); }
        }

        const dateString = rawData.createdAt?.toDate ? rawData.createdAt.toDate().toLocaleString() : "Syncing...";
        const catColorClass = categoryStyles[rawData.category] || "text-light";
        
        // Determine Border/Badge Styling
        let cardClass = "";
        let badgesHtml = "";
        
        if (rawData.isStrike) {
            cardClass = "strike-card";
            badgesHtml += `<span class="badge bg-warning text-dark me-2 mb-2"><i class="bi bi-cone-striped me-1"></i>Strike / Roadblock</span>`;
        }
        if (rawData.emergency) {
            cardClass = "emergency-card";
            badgesHtml += `<span class="badge bg-danger me-2 mb-2"><i class="bi bi-exclamation-triangle-fill me-1"></i>EMERGENCY</span>`;
        }

        const locationHtml = rawData.lat ? `
            <div class="small text-info border-top border-secondary border-opacity-25 pt-2 mt-auto">
                <i class="bi bi-geo-alt-fill me-1"></i> Location: ${parseFloat(rawData.lat).toFixed(4)}, ${parseFloat(rawData.lng).toFixed(4)}
            </div>
        ` : '';

        tempHtml += `
            <div class="col-md-4">
                <div class="glass-box p-4 broadcast-card shadow-sm ${cardClass}">
                    
                    <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${rawData.id}" title="Delete Broadcast">
                        <i class="bi bi-trash"></i>
                    </button>

                    <div>${badgesHtml}</div>
                    
                    <div class="mb-1">
                        <span class="small fw-bold ${catColorClass}"><i class="bi bi-tag-fill me-1"></i>${displayData.category || 'General'}</span>
                    </div>
                    
                    <h5 class="fw-bold text-light mt-1">${displayData.title}</h5>
                    <p class="text-muted small mb-3"><i class="bi bi-clock me-1"></i>${dateString}</p>
                    
                    <p class="card-text text-light mb-3" style="font-size: 0.9rem;">${displayData.description || displayData.content}</p>
                    
                    ${locationHtml}
                </div>
            </div>`;
    }

    container.innerHTML = tempHtml;

    container.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.onclick = async () => {
            if (confirm("Delete this broadcast permanently?")) {
                await deleteDoc(doc(db, "ward-broadcasts", btn.dataset.id));
            }
        };
    });
}

// ================= CREATE BROADCAST =================
document.getElementById("postBtn")?.addEventListener("click", async () => {
    const titleField = document.getElementById("title");
    const contentField = document.getElementById("content");
    const categoryField = document.getElementById("category");
    const emergencyField = document.getElementById("emergency");
    const strikeField = document.getElementById("isStrike");
    const latField = document.getElementById("latInput");
    const lngField = document.getElementById("lngInput");

    const title = titleField.value.trim();
    const content = contentField.value.trim();
    const category = categoryField.value;
    const emergency = emergencyField.checked;
    const isStrike = strikeField ? strikeField.checked : false;
    const lat = latField.value;
    const lng = lngField.value;

    if (!title || !content || !lat) {
        return alert("Please fill title, description, and click a location on the map!");
    }

    const btn = document.getElementById("postBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Broadcasting...';

    try {
        await addDoc(collection(db, "ward-broadcasts"), {
            title,
            description: content,
            category,
            emergency,
            isStrike,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            ward: currentUserWard,
            municipality: userMunicipality,
            userId: auth.currentUser.uid,
            createdAt: serverTimestamp(),
        });
        
        // Reset Form & Marker
        titleField.value = ""; contentField.value = ""; latField.value = ""; lngField.value = "";
        emergencyField.checked = false; if (strikeField) strikeField.checked = false;
        
        if (selectionMarker) {
            modalMap.removeLayer(selectionMarker);
            selectionMarker = null;
        }

        bootstrap.Modal.getInstance(createModalEl).hide();
    } catch (error) {
        alert("Error posting broadcast. Check console.");
        console.error(error);
    } finally {
        btn.disabled = false;
        btn.innerText = "Broadcast to Ward";
    }
});

// ================= LANGUAGE & LOGOUT =================
document.getElementById("languageSelect")?.addEventListener("change", (e) => {
    localStorage.setItem("lang", e.target.value);
    renderBroadcasts();
});

document.getElementById("logoutBtn")?.addEventListener("click", () => {
    signOut(auth).then(() => (window.location.href = "../../index.html"));
});