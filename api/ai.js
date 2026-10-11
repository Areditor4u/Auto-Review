// Vercel Serverless Function: POST /api/ai
// Set GEMINI_API_KEY in Vercel Project Settings > Environment Variables.
// Never put the API key in index.html or commit it to GitHub.

const ALLOWED_LANGUAGES = new Set(["Hinglish", "Hindi", "English"]);
const ALLOWED_TONES = new Set([
  "Simple & Polite",
  "Highly Professional",
  "Friendly & Appreciative"
]);

function sendJson(res, status, payload) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.json(payload);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "यह endpoint केवल POST request स्वीकार करता है।" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, {
      error: "Server पर GEMINI_API_KEY सेट नहीं है। Vercel Environment Variables में API Key जोड़कर redeploy करें।"
    });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch {
      return sendJson(res, 400, { error: "Request JSON सही नहीं है।" });
    }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return sendJson(res, 400, { error: "Request body खाली या गलत है।" });
  }

  const language = String(body.language || "Hinglish");
  const service = String(body.service || "").trim();
  const tone = String(body.tone || "Simple & Polite");
  const userNotes = String(body.userNotes || "").trim().slice(0, 1200);

  if (!ALLOWED_LANGUAGES.has(language)) {
    return sendJson(res, 400, { error: "चुनी गई भाषा मान्य नहीं है।" });
  }
  if (!ALLOWED_TONES.has(tone)) {
    return sendJson(res, 400, { error: "चुना गया टोन मान्य नहीं है।" });
  }
  if (!service || service.length > 120) {
    return sendJson(res, 400, { error: "कृपया मान्य सर्विस चुनें।" });
  }

  const systemPrompt = [
    "You write draft customer reviews for Ray Choice Center (राय चॉइस सेंटर).",
    "Write only from the customer's own stated experience.",
    "Never invent a visit, transaction, speed, satisfaction, staff behavior, outcome, or other personal experience.",
    "Do not force positive sentiment or a star rating.",
    "If no notes are supplied, write a neutral draft that does not pretend the customer experienced or liked the service.",
    "The customer must review and edit the draft so it accurately reflects their real experience.",
    "Return only the review text, without quotes, headings, greetings, star ratings, or explanations.",
    "Keep it concise, normally 30-70 words."
  ].join(" ");

  const promptText = [
    "Business: Ray Choice Center (राय चॉइस सेंटर)",
    `Service selected: ${service}`,
    `Language: ${language}. Hinglish means natural Roman Hindi mixed with English; Hindi means Devanagari Hindi; English means standard English.`,
    `Tone: ${tone}`,
    `Customer-provided experience notes: ${userNotes || "(No notes supplied. Keep the draft neutral and do not claim satisfaction or a completed transaction.)"}`,
    "Write a draft only. Do not add facts beyond the supplied information."
  ].join("\n");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        generationConfig: { temperature: 0.65, maxOutputTokens: 240 }
      }),
      signal: controller.signal
    });

    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = result?.error?.message || "Gemini API ने अनुरोध अस्वीकार किया।";
      if (upstream.status === 400) {
        return sendJson(res, 400, { error: `Gemini अनुरोध गलत है: ${message}` });
      }
      if (upstream.status === 401 || upstream.status === 403) {
        return sendJson(res, 502, { error: `Gemini API Key या API अनुमति की समस्या है। Vercel में GEMINI_API_KEY जाँचें। विवरण: ${message}` });
      }
      if (upstream.status === 404) {
        return sendJson(res, 502, { error: `Gemini मॉडल/Endpoint नहीं मिला। GEMINI_MODEL जाँचें। विवरण: ${message}` });
      }
      if (upstream.status === 429) {
        return sendJson(res, 429, { error: `Gemini quota या rate limit पूरी हो गई है। थोड़ी देर बाद कोशिश करें। विवरण: ${message}` });
      }
      return sendJson(res, 502, { error: `Gemini API त्रुटि (${upstream.status}): ${message}` });
    }

    const candidate = result?.candidates?.[0];
    const text = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts.map(part => part.text || "").join("").trim()
      : "";

    if (!text) {
      const reason = candidate?.finishReason || result?.promptFeedback?.blockReason;
      return sendJson(res, 502, {
        error: reason ? `Gemini ने टेक्स्ट नहीं लौटाया। कारण: ${reason}` : "Gemini का जवाब खाली था। कृपया फिर कोशिश करें।"
      });
    }
    return sendJson(res, 200, { text });
  } catch (error) {
    if (error?.name === "AbortError") {
      return sendJson(res, 504, { error: "Gemini API ने 25 सेकंड में जवाब नहीं दिया। फिर कोशिश करें।" });
    }
    console.error("Gemini request failed:", error);
    return sendJson(res, 502, { error: "Gemini API से कनेक्शन नहीं हो पाया। Server logs और API स्थिति जाँचें।" });
  } finally {
    clearTimeout(timeout);
  }
};
