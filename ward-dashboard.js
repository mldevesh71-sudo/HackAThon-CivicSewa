import { auth, db } from "../core/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

let currentUser = null;
let userWard = "N/A";
let userMunicipality = "N/A";

// ================= AUTH LISTENER & INIT =================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../../login.html";
        return;
    }
    currentUser = user;
    const snap = await getDoc(doc(db, "users", user.uid));
    
    if (snap.exists()) {
        const data = snap.data();
        if (data.role !== "ward") {
            alert("Access denied. Admin portal only.");
            signOut(auth);
            return;
        }
        
        // Populate UI
        document.getElementById("uNameMain").innerText = data.fullName || "Official";
        document.getElementById("uNameTop").innerText = data.fullName || "Official";
        userWard = data.wardNumber || "N/A";
        userMunicipality = data.municipality || "N/A";
        document.getElementById("uWard").innerText = `Ward ${userWard}`;
        
        // Load Ward Specific Data
        loadWardComplaints();
        setupAlertButton();
    }
});

// ================= SETUP ALERT BUTTON =================
function setupAlertButton() {
    const postBtn = document.getElementById("postBtn");
    if (postBtn) {
        postBtn.addEventListener("click", async () => {
            const title = document.getElementById("alertTitle").value.trim();
            const category = document.getElementById("alertCategory").value;
            const description = document.getElementById("alertDescription").value.trim();
            const emergency = document.getElementById("alertEmergency").checked;

            if (!title || !description) {
                alert("Please fill in all fields.");
                return;
            }

            const originalText = postBtn.innerText;
            postBtn.innerText = "Sending...";
            postBtn.disabled = true;

            try {
                await addDoc(collection(db, "ward-broadcasts"), {
                    title, category, description, emergency,
                    ward: userWard, municipality: userMunicipality,
                    userId: currentUser.uid, createdAt: serverTimestamp(),
                });
                alert("Broadcast sent successfully!");
                // Clear form
                document.getElementById("alertTitle").value = "";
                document.getElementById("alertDescription").value = "";
                document.getElementById("alertEmergency").checked = false;
            } catch (error) {
                console.error("Error sending alert:", error);
                alert("Failed to send alert.");
            } finally {
                postBtn.innerText = originalText;
                postBtn.disabled = false;
            }
        });
    }
}

// ================= LOAD WARD COMPLAINTS =================
async function loadWardComplaints() {
    const container = document.getElementById("complaintsContainer");
    if (!container) return;
    
    container.innerHTML = `<div class="text-center py-4"><span class="spinner-border text-secondary"></span></div>`;
    
    // CRITICAL FIX: Query by WARD, not by userId!
    const q = query(
        collection(db, "complaints"),
        where("ward", "==", userWard),
        orderBy("createdAt", "desc")
    );
    
    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            container.innerHTML = "<p class='text-muted text-center pt-3'>No complaints found for this ward.</p>";
            return;
        }
        
        container.innerHTML = ""; // Clear loader
        let openCount = 0, progCount = 0, resCount = 0;

        snapshot.forEach((docSnap) => {
            const complaint = docSnap.data();
            
            // Tally for KPI and Chart
            if(complaint.status === "Open") openCount++;
            else if(complaint.status === "In Progress") progCount++;
            else if(complaint.status === "Resolved") resCount++;

            // Visual Badges
            let badgeClass = "bg-secondary";
            if(complaint.status === "Open") badgeClass = "bg-primary";
            if(complaint.status === "In Progress") badgeClass = "bg-warning text-dark";
            if(complaint.status === "Resolved") badgeClass = "bg-success";

            const dateStr = complaint.createdAt ? complaint.createdAt.toDate().toLocaleDateString() : "Just now";

            container.innerHTML += `
                <div class="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom border-secondary border-opacity-25">
                    <div>
                        <div class="fw-semibold text-light">${complaint.title}</div>
                        <div class="small text-muted">${complaint.category} • ${dateStr}</div>
                    </div>
                    <span class="badge ${badgeClass}">${complaint.status}</span>
                </div>
            `;
        });

        // Update KPI UI
        document.getElementById("kpiOpen").innerText = openCount;
        document.getElementById("kpiProg").innerText = progCount;
        document.getElementById("kpiRes").innerText = resCount;
        document.getElementById("kpiTotal").innerText = snapshot.size;

        // Update Chart
        updateChart(openCount, progCount, resCount);

    } catch (error) {
        console.error("Error fetching complaints:", error);
        container.innerHTML = "<p class='text-danger'>Failed to load complaints.</p>";
    }
}

// ================= LOGOUT =================
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = "../../index.html";
    });
});