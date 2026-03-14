// js/citizen/chatbot.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { setupFileUpload } from "./fileHandler.js"; // Kept your original import
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// DOM Elements
const chatBody = document.getElementById("chatBody");
const input = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const typingIndicator = document.getElementById("typingIndicator");
const fileInput = document.getElementById("fileInput");
const attachBtn = document.getElementById("attachBtn");
const exportBtn = document.getElementById("exportChat");

let attachedFile = null;
let messages = [];

// API Setup (Hackathon Warning: Usually keep keys in env vars, but okay for demo)
const API_KEY = "AIzaSyC2R-7E1XV9tJr-5FsVwnaJ4Q7PPlgZ9O8";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ================= AUTH & NAVBAR SYNC =================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    // Fetch user details to populate the top navbar
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
        const data = snap.data();
        document.getElementById("uNameTop").innerText = data.fullName || "Citizen";
        const ward = data.wardNumber || "--";
        const muni = data.municipality || "N/A";
        document.getElementById("uWard").innerText = `Ward ${ward}, ${muni}`;
    }
});

// Logout Logic
document.getElementById("logoutBtn")?.addEventListener("click", () => {
    signOut(auth).then(() => window.location.href = "login.html");
});

// ================= CHAT LOGIC =================
function sendMessage() {
    const text = input.value.trim();
    if (!text && !attachedFile) return; // Prevent empty sends

    let messageText = text;
    if (attachedFile) {
        messageText = `📎 [Attached File: ${attachedFile.name}]\n` + text;
    }

    addMessage(messageText, "user");
    input.value = "";
    input.style.height = "auto";
    
    // Pass to AI
    simulateAI(messageText);
    attachedFile = null; // Clear file after sending
}

function addMessage(text, type) {
    // 1. Create outer wrapper
    const msg = document.createElement("div");
    msg.classList.add("message", type);

    // 2. Create inner content bubble (CRITICAL for the new CSS)
    const content = document.createElement("div");
    content.classList.add("msg-content"); // Applies the blue/white bubble styling
    
    if (type === "ai") {
        content.innerHTML = text; // AI sends HTML formatted text
    } else {
        content.innerText = text; // Secure user input
    }

    // 3. Create timestamp
    const time = document.createElement("div");
    time.classList.add("timestamp");
    time.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Append everything
    msg.appendChild(content);
    msg.appendChild(time);
    chatBody.appendChild(msg);

    // Auto-scroll to latest message
    chatBody.scrollTop = chatBody.scrollHeight;

    // Save for PDF export
    messages.push({ type, text: content.innerText, time: time.textContent });
}

// ================= AI FORMATTING & CALL =================
function formatAIResponse(text) {
    return text
        .replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>")
        .split(/\n\n+/)
        .map((para) => para.trim())
        .filter((para) => para.length > 0)
        .map((para) => {
            if (para.includes("•") || para.match(/^\d+\./)) {
                return `<div style="margin-bottom:1rem">${para.replace(/\n/g, "<br>")}</div>`;
            }
            return `<p style="margin-bottom:1rem; line-height: 1.6;">${para}</p>`;
        })
        .join("");
}

async function simulateAI(userText) {
    typingIndicator.classList.remove("hidden");
    chatBody.scrollTop = chatBody.scrollHeight;

    try {
        const prompt = `You are a highly helpful and empathetic civic services assistant for CivicSewa in Nepal. Keep answers clear and formatting clean. User question: ${userText}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiText = response.text();

        typingIndicator.classList.add("hidden");
        addMessage(formatAIResponse(aiText), "ai");
    } catch (error) {
        console.error("AI Error:", error);
        typingIndicator.classList.add("hidden");
        addMessage("I'm sorry, our network is currently experiencing delays. Please try again in a moment.", "ai");
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

// Auto-resize textarea
input.addEventListener("input", function() {
    this.style.height = "auto";
    this.style.height = (this.scrollHeight) + "px";
});

// File Attachment Logic
attachBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        attachedFile = file;
        // Visual feedback that a file is attached without sending yet
        input.placeholder = `File attached: ${file.name}. Add a message...`;
    }
});

// ================= PDF EXPORT =================
exportBtn.addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(2, 43, 66); // Deep Ocean Blue
    doc.text("CivicSewa - AI Consultation Record", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Exported on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`User: ${document.getElementById("uNameTop").innerText}`, 14, 36);

    const tableRows = messages.map((msg) => [
        msg.time,
        msg.type === "ai" ? "Civic AI" : "Citizen",
        msg.text
    ]);

    doc.autoTable({
        startY: 45,
        head: [["Time", "Sender", "Message Transcript"]],
        body: tableRows,
        theme: "striped",
        headStyles: { fillColor: [0, 109, 164] }, // Primary Accent Blue
        columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 25 },
            2: { cellWidth: "auto" },
        },
        styles: { overflow: "linebreak", cellPadding: 6 },
    });

    doc.save("CivicSewa_Chat_Transcript.pdf");
});