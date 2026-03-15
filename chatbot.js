/* =========================================
   CIVICSEWA CITIZEN: GUIDANCE CHATBOT
   Path: js/citizen/chatbot.js
========================================= */

import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";
import { auth, db } from "../core/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// ================= AUTH & LOAD HEADER =================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../../login.html";
        return;
    }
    try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
            const data = snap.data();
            const nameEl = document.getElementById("uNameTop");
            if (nameEl) nameEl.innerText = data.fullName || user.email.split('@')[0];
            
            const wardEl = document.getElementById("uWard");
            if (wardEl) wardEl.innerText = `Ward ${data.wardNumber || "N/A"}, ${data.municipality || "N/A"}`;
        }
    } catch (err) { console.error("Error loading user details:", err); }
});

// ================= AI INITIALIZATION =================
const chatBody = document.getElementById("chatBody");
const input = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const typingIndicator = document.getElementById("typingIndicator");
const fileInput = document.getElementById("fileInput");
const attachBtn = document.getElementById("attachBtn");
const exportBtn = document.getElementById("exportChat");

let attachedFile = null;
let messages = [];

// CRITICAL FIX: The model string 'gemini-2.5-flash' does not exist in the API yet. 
// Changed to the powerful and reliable 'gemini-1.5-flash' engine.
const API_KEY = "AIzaSyC2R-7E1XV9tJr-5FsVwnaJ4Q7PPlgZ9O8"; 
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ================= CHAT LOGIC =================
function sendMessage() {
    const text = input.value.trim();
    if (!text && !attachedFile) return;

    let displayMsg = text;
    if (attachedFile) {
        displayMsg = `<i class="bi bi-paperclip me-1"></i> [Attached: ${attachedFile.name}] <br>` + text;
    }

    addMessage(displayMsg, "user");
    input.value = "";
    input.style.height = "auto"; // Reset height
    
    // Process AI
    simulateAI(text || "Please review the attached file.");
    
    // Clear attachment state
    attachedFile = null;
}

function addMessage(text, type) {
    const msg = document.createElement("div");
    msg.className = `message ${type}`;

    const content = document.createElement("div");
    content.className = "content";
    content.innerHTML = text; // Allow HTML rendering for formatting

    const time = document.createElement("div");
    time.className = "timestamp";
    time.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    msg.appendChild(content);
    msg.appendChild(time);
    chatBody.appendChild(msg);

    chatBody.scrollTop = chatBody.scrollHeight;

    messages.push({ type, text: text.replace(/<[^>]*>?/gm, ""), time: time.textContent });
}

function formatAIResponse(text) {
    return text
        .replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>") // Bold Markdown
        .replace(/\*([\s\S]+?)\*/g, "<em>$1</em>")             // Italic Markdown
        .split(/\n\n+/)
        .map((para) => para.trim())
        .filter((para) => para.length > 0)
        .map((para) => {
            if (para.includes("•") || para.match(/^\d+\./)) {
                return `<div style="margin-bottom:1rem">${para.replace(/\n/g, "<br>")}</div>`;
            }
            return `<p style="margin-bottom:0.8rem; margin-top:0;">${para}</p>`;
        })
        .join("");
}

async function simulateAI(userText) {
    typingIndicator.classList.remove("d-none");
    chatBody.scrollTop = chatBody.scrollHeight;

    try {
        const prompt = `You are a highly professional and helpful civic services assistant for the CivicSewa platform in Nepal. Provide a concise, highly accurate response to this user: ${userText}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiText = response.text();

        typingIndicator.classList.add("d-none");
        addMessage(formatAIResponse(aiText), "ai");
    } catch (error) {
        console.error("AI Error:", error);
        typingIndicator.classList.add("d-none");
        addMessage("<span class='text-danger'><i class='bi bi-exclamation-circle me-1'></i> Error connecting to AI servers. Please ensure your API key is valid.</span>", "ai");
    }
}

// ================= EVENT LISTENERS =================
sendBtn.addEventListener("click", sendMessage);

input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

attachBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        attachedFile = file;
        input.placeholder = `Attached: ${file.name}. Add a message...`;
    }
});

// ================= PDF EXPORT =================
exportBtn.addEventListener("click", () => {
    if (!window.jspdf) {
        alert("PDF generator is still loading. Please try again in a moment.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    // Dark Space Theme Color for PDF header
    doc.setTextColor(35, 20, 65);
    doc.text("CivicSewa - AI Consultation Record", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    const tableRows = messages.map((msg) => [
        msg.time,
        msg.type === 'user' ? 'CITIZEN' : 'AI ASSISTANT',
        msg.text
    ]);

    doc.autoTable({
        startY: 35,
        head: [["Time", "Sender", "Transcript"]],
        body: tableRows,
        theme: "striped",
        headStyles: { fillColor: [35, 20, 65], textColor: [255, 215, 0] }, // Deep Space & Gold
        columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 35, fontStyle: 'bold' },
            2: { cellWidth: "auto" },
        },
        styles: { overflow: "linebreak", cellPadding: 6 },
    });

    doc.save("CivicSewa_Consultation.pdf");
});