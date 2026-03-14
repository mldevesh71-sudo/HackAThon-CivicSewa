// js/core/translator.js

// In-memory cache: "text||en-ne" → translated string
const translationCache = new Map();
const LINGVA_BASE = "https://lingva.ml/api/v1";

export async function translateText(text, targetLang = "np") {
  if (targetLang === "en" || !text) return text;

  const cacheKey = `${text}||en-ne`;
  if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

  try {
    const url = `${LINGVA_BASE}/en/ne/${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const translated = json.translation || text;
    translationCache.set(cacheKey, translated);
    return translated;
  } catch (err) {
    console.warn("Translation failed, using original:", err.message);
    return text; // Graceful fallback
  }
}

export async function translateBatch(texts, targetLang = "np") {
  if (targetLang === "en") return texts;
  return Promise.all(texts.map((t) => translateText(t, targetLang)));
}

/**
 * CRITICAL FIX: Only translate the user-input text strings. 
 * Do NOT translate dates, user names, or status badges via API.
 */
export async function translateComplaint(complaint, targetLang = "np") {
  if (targetLang === "en") {
    return { title: complaint.title, description: complaint.description, location: complaint.location };
  }
  
  const [title, description, location] = await translateBatch(
    [complaint.title, complaint.description, complaint.location],
    targetLang
  );
  
  return { title, description, location };
}

export async function translateBroadcast(broadcast, targetLang = "np") {
  if (targetLang === "en") {
    return { title: broadcast.title, content: broadcast.content };
  }
  
  const [title, content] = await translateBatch(
    [broadcast.title, broadcast.content],
    targetLang
  );
  
  return { title, content };
}