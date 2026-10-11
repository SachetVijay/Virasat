// Virasat — every elder is a library.
// Record grandparents' stories in their dialect; hear them in any language, in their own voice.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const AdmZip = require("adm-zip");

// ---------- config ----------
for (const line of fs.readFileSync(path.join(__dirname, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const KEY = process.env.SARVAM_API_KEY || process.env.SARVAM_APIi || process.env.SARVAM_API;
if (!KEY) throw new Error("Set SARVAM_API_KEY in .env");
const BASE = "https://api.sarvam.ai";
const H = { "api-subscription-key": KEY };

const LANGS = {
  "hi-IN": "Hindi", "bn-IN": "Bengali", "gu-IN": "Gujarati", "kn-IN": "Kannada", "ml-IN": "Malayalam", "mr-IN": "Marathi",
  "od-IN": "Odia", "pa-IN": "Punjabi", "ta-IN": "Tamil", "te-IN": "Telugu", "en-IN": "English",
};
const INTERVIEWER_VOICE = "priya";
const NARRATOR_VOICE = "rahul";

const TOPICS = {
  childhood: "their childhood and village life — games, school, home, neighbours",
  festival: "a festival or ritual as it was celebrated in their time — preparations, food, songs, who did what",
  recipe: "a family recipe they are known for — exact ingredients, quantities by hand-measure, steps, secrets",
  remedy: "a traditional home remedy (nuskha) — what it is for, ingredients, how it is prepared and given",
  song: "a folk song, lullaby or chant — the words, when it was sung, who taught it",
  farming: "farming, seasons, rain, animals and nature wisdom from their life",
  craft: "a craft or skill — weaving, pottery, embroidery, carpentry, kolam/rangoli — materials and technique",
  family: "the family's story — how they met their spouse, migrations, hardships, proud moments",
  lesson: "the most important life lessons they want grandchildren to remember, with the stories behind them",
};

// ---------- storage ----------
const DATA = path.join(__dirname, "data");
for (const d of ["", "clips", "voices", "narration", "scans"]) fs.mkdirSync(path.join(DATA, d), { recursive: true });
const DB_FILE = path.join(DATA, "db.json");
const db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, "utf8")) : { elders: [], memories: [], jar: [] };
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 1));
const uid = () => crypto.randomBytes(5).toString("hex");
const elderOf = (id) => db.elders.find((e) => e.id === id);
const memOf = (id) => db.memories.find((m) => m.id === id);

// ---------- helpers ----------
function limiter(n) {
  let active = 0;
  const q = [];
  const next = () => {
    if (active >= n || !q.length) return;
    active++;
    const { fn, res, rej } = q.shift();
    fn().then(res, rej).finally(() => { active--; next(); });
  };
  return (fn) => new Promise((res, rej) => { q.push({ fn, res, rej }); next(); });
}
const lim = limiter(6);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// every Sarvam HTTP call goes through here: concurrency-limited, retried on 429/5xx
function sarvam(url, init) {
  return lim(async () => {
    for (let attempt = 0; ; attempt++) {
      const r = await fetch(BASE + url, { ...init, headers: { ...H, ...(init.headers || {}) } });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return j;
      if (attempt < 5 && (r.status === 429 || r.status >= 500)) { await sleep(700 * 2 ** attempt + Math.random() * 300); continue; }
      throw new Error(`${url} ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
    }
  });
}
const postJSON = (url, body) => sarvam(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const postForm = (url, fields) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v != null) fd.append(k, v);
  return sarvam(url, { method: "POST", body: fd });
};
const wavBlob = (buf) => new Blob([buf], { type: "audio/wav" });

// WAV (PCM) utilities — the browser recorder sends 16 kHz mono 16-bit
function wavInfo(buf) {
  let o = 12, fmt = { ch: 1, rate: 16000, bits: 16 };
  while (o + 8 <= buf.length) {
    const id = buf.toString("ascii", o, o + 4), sz = buf.readUInt32LE(o + 4);
    if (id === "fmt ") fmt = { ch: buf.readUInt16LE(o + 10), rate: buf.readUInt32LE(o + 12), bits: buf.readUInt16LE(o + 22) };
    if (id === "data") return { ...fmt, start: o + 8, len: Math.min(sz, buf.length - o - 8) };
    o += 8 + sz + (sz % 2);
  }
  return { ...fmt, start: 44, len: buf.length - 44 };
}
function wavFromPCM(pcm, { ch, rate, bits }) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE((rate * ch * bits) / 8, 28); h.writeUInt16LE((ch * bits) / 8, 32); h.writeUInt16LE(bits, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
const wavDuration = (buf) => { const w = wavInfo(buf); return w.len / ((w.rate * w.ch * w.bits) / 8); };
function wavSlices(buf, maxSec, fromSec = 0) {
  const w = wavInfo(buf), block = (w.ch * w.bits) / 8, bps = w.rate * block;
  const pcm = buf.subarray(w.start + Math.floor((fromSec * bps) / block) * block, w.start + w.len);
  const step = Math.floor((maxSec * bps) / block) * block;
  const out = [];
  for (let o = 0; o < pcm.length; o += step) {
    const part = pcm.subarray(o, o + step);
    if (part.length > bps * 0.5 || !out.length) out.push(wavFromPCM(part, w));
  }
  return out;
}

// ---------- Sarvam building blocks ----------
async function chatJSON(system, user, max_tokens = 2500) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const j = await postJSON("/v1/chat/completions", {
      model: "sarvam-105b", reasoning_effort: null, temperature: attempt ? 0.1 : 0.4, max_tokens,
      messages: [{ role: "system", content: system + "\nRespond ONLY with valid JSON. No markdown fences." }, { role: "user", content: user }],
    });
    const s = j.choices[0].message.content || "";
    try { return JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)); } catch (e) { if (attempt) throw new Error("LLM JSON parse failed: " + s.slice(0, 200)); }
  }
}

// Saaras: transcribe in the original language AND translate to English, in ≤28 s chunks, all in parallel
async function listen(buf) {
  const chunks = wavSlices(buf, 28);
  const parts = await Promise.all(chunks.map((c) => Promise.all([
    postForm("/speech-to-text", { file: wavBlob(c), model: "saaras:v3", mode: "transcribe" }),
    postForm("/speech-to-text", { file: wavBlob(c), model: "saaras:v3", mode: "translate" }),
  ])));
  return {
    text: parts.map(([t]) => t.transcript).join(" ").trim(),
    textEn: parts.map(([, e]) => e.transcript).join(" ").trim(),
    language: parts.map(([t]) => t.language_code).find(Boolean) || null,
    duration: wavDuration(buf),
  };
}

// Two translators: Sarvam-Translate (native, faithful — heritage text & questions to elders, 22 langs)
// and Mayura classic-colloquial (warm, code-mixed — chatty answers for grandkids)
async function translate(text, target, source = "en-IN", style = "native") {
  if (!text || !String(text).trim() || target === source) return text;
  const native = style === "native";
  const max = native ? 1800 : 900;
  const sents = String(text).match(/[^.!?।\n]+[.!?।\n]*/g) || [text];
  const chunks = [];
  let buf = "";
  for (const s of sents) { if (buf && (buf + s).length > max) { chunks.push(buf); buf = ""; } buf += s; }
  if (buf) chunks.push(buf);
  const out = await Promise.all(chunks.map((c) => postJSON("/translate", native
    ? { input: c, source_language_code: source, target_language_code: target, model: "sarvam-translate:v1", mode: "formal", numerals_format: "international" }
    : { input: c, source_language_code: source, target_language_code: target, model: "mayura:v1", mode: "classic-colloquial", numerals_format: "international" },
  ).then((j) => j.translated_text)));
  return out.join(" ");
}
async function romanize(text, lang) {
  if (!text || lang === "en-IN") return text;
  const j = await postJSON("/transliterate", { input: text.slice(0, 1000), source_language_code: lang, target_language_code: "en-IN" }).catch(() => null);
  return j ? j.transliterated_text : "";
}
async function detectLang(text) {
  const j = await postJSON("/text-lid", { input: text.slice(0, 500) }).catch(() => ({}));
  return j.language_code;
}
async function speak(text, lang, speaker = NARRATOR_VOICE) {
  const j = await postJSON("/text-to-speech", { text: text.slice(0, 2400), language_code: lang, model: "bulbul:v3", speaker, pace: 0.95 });
  return Buffer.from(j.audios[0], "base64");
}
async function speakAs(elder, text, lang) {
  const ref = fs.readFileSync(path.join(DATA, "voices", elder.id + ".wav"));
  const j = await postForm("/voices/clone", { ref_audio: wavBlob(ref), text: text.slice(0, 990), language_code: lang });
  return Buffer.from(j.audio || j.audio_b64, "base64");
}

// Sarvam Vision Document Intelligence (async job → zip of markdown)
async function digitise(buf, filename, mimetype, language) {
  const fd = new FormData();
  fd.append("file", new Blob([buf], { type: mimetype }), filename);
  fd.append("language", language);
  fd.append("output_format", "md");
  const job = await sarvam("/doc-ai/v1/job/digitise", { method: "POST", body: fd });
  for (let i = 0; i < 80; i++) {
    await sleep(1500);
    const s = await sarvam(`/doc-ai/v1/job/${job.job_id}/status`, { method: "GET" });
    if (["completed", "partially_completed"].includes(s.status)) break;
    if (["failed", "rejected"].includes(s.status)) throw new Error("Document reading " + s.status);
  }
  const { url } = await sarvam(`/doc-ai/v1/job/${job.job_id}/download-url`, { method: "GET" });
  const zip = new AdmZip(Buffer.from(await (await fetch(url)).arrayBuffer()));
  return zip.getEntries().filter((e) => e.entryName.endsWith(".md"))
    .sort((a, b) => a.entryName.localeCompare(b.entryName)).map((e) => e.getData().toString("utf8")).join("\n\n");
}

// ---------- the heritage engine ----------
const BUILD_PROMPT = (elder, topic) => `You are an oral historian preserving Indian family and community heritage.
Below is an interview with ${elder.relation} ${elder.name} from ${elder.village || "their village"} (${LANGS[elder.language]} speaker) about ${TOPICS[topic] || topic}.
Each answer is given in the original language AND an English translation.
Turn it into a heritage record. Rules:
- LANGUAGE: every field MUST be written in ENGLISH, except quotes[].original, glossary[].word and song.lines which stay in the original script.
- "story": 3-6 short paragraphs retold in FIRST PERSON — ${elder.name} herself/himself is the narrator, talking TO their grandchild ("My child, when I was young…"). Never address ${elder.relation || "the elder"} by name or relation; the elder is the one speaking. Warm, vivid, faithful. Never invent facts that were not said.
- "quotes": 2-3 memorable phrases copied EXACTLY from the original-language answers, with English meaning.
- "glossary": 3-8 culturally specific or dialect words that appear in the original-language answers (native script, exactly as written there) — foods, tools, rituals, kinship terms, local names. Explain meaning and cultural context accurately and conservatively — if unsure of a dialect word, give the literal meaning and say "regional usage" rather than guessing.
- Fill "recipe" only if a dish is described, "remedy" only if a home remedy is described (caution must advise consulting a doctor for anything serious), "song" only if lyrics are given (lines in original language). Otherwise null.
- "followups": 3 specific questions the grandchild should ask next visit to capture what is still missing.
JSON shape:
{"type":"story|recipe|remedy|song|festival|wisdom|craft","title":"evocative short title","summary":"one sentence","era":"approx decade or null","place":"place or null",
 "story":["..."],"quotes":[{"original":"...","en":"..."}],"glossary":[{"word":"...","meaning":"...","context":"..."}],
 "recipe":{"serves":"...","ingredients":[{"item":"...","qty":"..."}],"steps":["..."],"secret":"..."} | null,
 "remedy":{"for":"...","ingredients":["..."],"steps":["..."],"caution":"..."} | null,
 "song":{"lines":["..."],"occasion":"..."} | null,
 "tags":["..."],"followups":["...","...","..."]}`;

async function buildMemory({ elder, topic, turns, source = "voice", scan = null }) {
  const transcript = turns.map((t, i) => `Q${i + 1}: ${t.qEn || t.q}\nA${i + 1} (original): ${t.a}\nA${i + 1} (English): ${t.aEn || t.a}`).join("\n\n");
  const rec = await chatJSON(BUILD_PROMPT(elder, topic), transcript, 3000);
  // safeguard: the English version must really be English — re-translate any paragraph that came back in the source script
  const nonLatin = (s) => (String(s).match(/[\u0900-\u0DFF]/g) || []).length > String(s).length * 0.3;
  const fix = (s) => (s && nonLatin(s) ? translate(s, "en-IN", elder.language).catch(() => s) : s);
  rec.story = await Promise.all((rec.story || []).map(fix));
  rec.title = await fix(rec.title);
  rec.summary = await fix(rec.summary);
  const mem = {
    id: uid(), elderId: elder.id, topic, source, scan, createdAt: Date.now(),
    type: rec.type || topic, era: rec.era, place: rec.place, tags: rec.tags || [],
    quotes: rec.quotes || [], glossary: (rec.glossary || []).map((g) => ({ ...g, lang: elder.language })),
    song: rec.song || null, turns,
    duration: turns.reduce((a, t) => a + (t.duration || 0), 0),
    versions: { "en-IN": versionFromRecord(rec) },
  };
  if (elder.language !== "en-IN") mem.versions[elder.language] = await buildVersion(mem, elder.language);
  db.memories.unshift(mem);
  for (const q of rec.followups || []) db.jar.push({ id: uid(), elderId: elder.id, question: q, from: "followup", createdAt: Date.now() });
  save();
  return mem;
}
function versionFromRecord(r) {
  return {
    title: r.title, summary: r.summary, story: r.story || [], followups: r.followups || [],
    glossary: (r.glossary || []).map((g) => g.meaning + (g.context ? " — " + g.context : "")),
    recipe: r.recipe || null, remedy: r.remedy || null,
  };
}
// translate the English version into any language; flatten → parallel Mayura → unflatten
async function buildVersion(mem, lang) {
  const en = mem.versions["en-IN"];
  const slots = [];
  const put = (s) => { slots.push(s || ""); return slots.length - 1; };
  const plan = {
    title: put(en.title), summary: put(en.summary), story: en.story.map(put), followups: en.followups.map(put), glossary: en.glossary.map(put),
    recipe: en.recipe && { serves: put(en.recipe.serves), ingredients: en.recipe.ingredients.map((i) => ({ item: put(i.item), qty: i.qty })), steps: en.recipe.steps.map(put), secret: put(en.recipe.secret) },
    remedy: en.remedy && { for: put(en.remedy.for), ingredients: en.remedy.ingredients.map(put), steps: en.remedy.steps.map(put), caution: put(en.remedy.caution) },
  };
  let failed = 0;
  const tr = await Promise.all(slots.map((s) => translate(s, lang).catch(() => { failed++; return s; })));
  if (failed > slots.length * 0.2) throw new Error(`Translation to ${LANGS[lang]} is busy (${failed} parts failed). Please retry.`);
  const g = (i) => tr[i];
  const v = {
    title: g(plan.title), summary: g(plan.summary), story: plan.story.map(g), followups: plan.followups.map(g), glossary: plan.glossary.map(g),
    recipe: plan.recipe && { serves: g(plan.recipe.serves), ingredients: plan.recipe.ingredients.map((i) => ({ item: g(i.item), qty: i.qty })), steps: plan.recipe.steps.map(g), secret: g(plan.recipe.secret) },
    remedy: plan.remedy && { for: g(plan.remedy.for), ingredients: plan.remedy.ingredients.map(g), steps: plan.remedy.steps.map(g), caution: g(plan.remedy.caution) },
  };
  v.roman = await Promise.all([v.title, ...v.story].map((s) => romanize(s, lang)));
  return v;
}

// ---------- app ----------
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024 } });
const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));
// only shareable media is public — elder voice references and the db are never served
for (const d of ["clips", "narration", "scans"]) app.use("/data/" + d, express.static(path.join(DATA, d)));
app.use("/samples", express.static(path.join(__dirname, "samples")));
const route = (fn) => async (req, res) => {
  try { res.json(await fn(req, res)); } catch (e) { console.error(e); res.status(500).json({ error: String(e.message || e) }); }
};

function publicMemory(m) {
  const e = elderOf(m.elderId);
  return { ...m, elder: e && { id: e.id, name: e.name, relation: e.relation, village: e.village, language: e.language, hasVoice: !!e.hasVoice } };
}

app.get("/api/state", route(() => {
  const langs = new Set(db.elders.map((e) => e.language));
  return {
    langs: LANGS, topics: Object.keys(TOPICS),
    elders: db.elders,
    memories: db.memories.map((m) => {
      const e = elderOf(m.elderId), en = m.versions["en-IN"], orig = m.versions[e?.language] || en;
      return { id: m.id, elderId: m.elderId, type: m.type, topic: m.topic, source: m.source, createdAt: m.createdAt, era: m.era, place: m.place,
        title: orig.title, titleEn: en.title, summary: en.summary, language: e?.language, duration: m.duration, glossary: m.glossary };
    }),
    jar: db.jar.filter((q) => !q.answered),
    stats: {
      memories: db.memories.length, elders: db.elders.length, languages: langs.size,
      minutes: Math.round(db.memories.reduce((a, m) => a + (m.duration || 0), 0) / 6) / 10,
      words: db.memories.reduce((a, m) => a + m.glossary.length, 0),
    },
  };
}));

// Create an elder with a consented voice sample (used for cross-lingual cloning)
app.post("/api/elders", upload.single("voice"), route(async (req) => {
  const { name, relation, village, language, consent } = req.body;
  if (!name || !LANGS[language]) throw new Error("Name and language are required");
  const elder = { id: uid(), name, relation: relation || "", village: village || "", language, createdAt: Date.now(), hasVoice: false, demo: req.body.demo === "1" };
  if (req.file) {
    if (consent !== "true") throw new Error("Voice can only be preserved with the elder's consent");
    const buf = req.file.buffer;
    const dur = wavDuration(buf);
    const ref = dur > 14.5 ? wavSlices(buf, 14.5, Math.min(1, dur - 14.5))[0] : buf; // clone API takes ≤15 s
    fs.writeFileSync(path.join(DATA, "voices", elder.id + ".wav"), ref);
    elder.hasVoice = true;
    elder.voiceSample = await listen(ref).catch(() => null);
  }
  db.elders.push(elder);
  save();
  return elder;
}));

// AI interviewer: next warm, specific question in the elder's language, spoken aloud
app.post("/api/interview/question", route(async (req) => {
  const { elderId, topic, turns = [], seed } = req.body;
  const elder = elderOf(elderId);
  const history = turns.map((t) => `Q: ${t.qEn}\nA: ${t.aEn}`).join("\n\n") || "(no answers yet)";
  const r = await chatJSON(
    `You are a loving grandchild interviewing your ${elder.relation || "grandparent"} ${elder.name} (from ${elder.village || "their village"}) to preserve memories about ${TOPICS[topic] || topic}.
Ask ONE short, open, concrete question (max 22 words) that invites a vivid story — names, places, smells, how exactly things were done, quantities for recipes.
Build on their last answer: pick up a specific detail or unusual word they used. Never repeat a question. Address them affectionately by relation.
${seed ? `Start with this question the family wants answered: "${seed}"` : ""}
JSON: {"question":"in English","why":"5-word reason"}`,
    history, 300);
  const question = await translate(r.question, elder.language);
  const audio = await speak(question, elder.language, INTERVIEWER_VOICE);
  return { qEn: r.question, q: question, why: r.why, audio: audio.toString("base64") };
}));

// Transcribe an answer (any length) — keeps the original clip forever
app.post("/api/transcribe", upload.single("audio"), route(async (req) => {
  const clipId = uid();
  fs.writeFileSync(path.join(DATA, "clips", clipId + ".wav"), req.file.buffer);
  return { clipId, ...(await listen(req.file.buffer)) };
}));

app.post("/api/memories", route(async (req) => {
  const { elderId, topic, turns } = req.body;
  const elder = elderOf(elderId);
  if (!elder || !turns?.length) throw new Error("Need an elder and at least one answer");
  // typed answers (no audio) still get an English translation
  for (const t of turns) if (!t.aEn) t.aEn = await translate(t.a, "en-IN", (await detectLang(t.a)) || elder.language).catch(() => t.a);
  if (req.body.jarId) { const j = db.jar.find((q) => q.id === req.body.jarId); if (j) j.answered = true; }
  return publicMemory(await buildMemory({ elder, topic, turns }));
}));

// Scan an old letter / recipe diary / song book with Sarvam Vision
app.post("/api/scan", upload.single("file"), route(async (req) => {
  const elder = elderOf(req.body.elderId);
  if (!elder) throw new Error("Choose whose memory this is");
  const scanId = uid() + path.extname(req.file.originalname || ".png");
  fs.writeFileSync(path.join(DATA, "scans", scanId), req.file.buffer);
  const text = await digitise(req.file.buffer, req.file.originalname || "scan.png", req.file.mimetype, req.body.language || elder.language);
  const lang = (await detectLang(text)) || elder.language;
  const aEn = LANGS[lang] && lang !== "en-IN" ? await translate(text, "en-IN", lang) : text;
  const mem = await buildMemory({ elder, topic: req.body.topic || "family", source: "scan", scan: "/data/scans/" + scanId,
    turns: [{ q: "Scanned document", qEn: "Scanned handwritten document", a: text, aEn }] });
  return publicMemory(mem);
}));

app.get("/api/memories/:id", route((req) => publicMemory(memOf(req.params.id))));

// Read the memory in any of 11 languages (cached)
app.post("/api/memories/:id/version", route(async (req) => {
  const m = memOf(req.params.id), { lang } = req.body;
  if (!LANGS[lang]) throw new Error("Unsupported language");
  if (!m.versions[lang]) { m.versions[lang] = await buildVersion(m, lang); save(); }
  return m.versions[lang];
}));

// Narrate: "elder" = cloned voice speaking the chosen language, "narrator" = Bulbul. Cached per paragraph.
app.post("/api/memories/:id/narrate", route(async (req) => {
  const m = memOf(req.params.id), { lang, voice } = req.body;
  const elder = elderOf(m.elderId);
  if (!m.versions[lang]) { m.versions[lang] = await buildVersion(m, lang); save(); }
  const v = m.versions[lang];
  const useClone = voice === "elder" && elder.hasVoice;
  const parts = [v.title, ...v.story];
  const urls = await Promise.all(parts.map(async (text, i) => {
    const rel = `narration/${m.id}_${lang}_${useClone ? "elder" : "narrator"}_${i}.wav`;
    const file = path.join(DATA, rel);
    if (!fs.existsSync(file)) fs.writeFileSync(file, useClone ? await speakAs(elder, text, lang) : await speak(text, lang));
    return "/data/" + rel;
  }));
  return { urls, voice: useClone ? "elder" : "narrator" };
}));

// Pronounce a glossary word (Bulbul, in its own language)
app.post("/api/say", route(async (req) => ({ audio: (await speak(req.body.text, req.body.lang, "kavitha")).toString("base64") })));

// Ask Grandma: question by voice/text in any language → answer from preserved memories, in the elder's cloned voice
app.post("/api/ask", upload.single("audio"), route(async (req) => {
  const elder = elderOf(req.body.elderId);
  let question = req.body.question, qLang, qEn;
  if (req.file) { const r = await listen(req.file.buffer); question = r.text; qEn = r.textEn; qLang = r.language; }
  else { qLang = await detectLang(question); qEn = LANGS[qLang] && qLang !== "en-IN" ? await translate(question, "en-IN", qLang) : question; }
  if (!question) return { question: "" };
  const lang = LANGS[qLang] ? qLang : "en-IN";
  const mems = db.memories.filter((m) => m.elderId === elder.id);
  const ctx = mems.map((m) => {
    const en = m.versions["en-IN"];
    return `[memory ${m.id}] ${en.title}\n${en.story.join("\n")}\n${en.recipe ? "Recipe: " + JSON.stringify(en.recipe) : ""}${en.remedy ? "Remedy: " + JSON.stringify(en.remedy) : ""}\nRaw answers: ${m.turns.map((t) => t.aEn).join(" | ")}`;
  }).join("\n\n");
  const r = await chatJSON(
    `You speak as the preserved memories of ${elder.relation} ${elder.name} from ${elder.village}, answering a grandchild lovingly in FIRST PERSON.
Use ONLY facts in the memories below — never invent. Max 4 short sentences, plain text.
If the memories do not contain the answer, say warmly that you haven't told that story yet and they should ask you on the next visit; set found=false and write the question to save for next visit.
JSON: {"answer":"English","found":true|false,"memoryId":"id or null","jarQuestion":"question to ask next visit, or null"}
MEMORIES:
${ctx || "(none yet)"}`, qEn, 600);
  const answer = await translate(r.answer, lang, "en-IN", "casual");
  const audio = elder.hasVoice ? await speakAs(elder, answer, lang) : await speak(answer, lang);
  if (!r.found && r.jarQuestion) { db.jar.push({ id: uid(), elderId: elder.id, question: r.jarQuestion, from: "ask", asked: question, createdAt: Date.now() }); save(); }
  const mem = r.memoryId && memOf(r.memoryId);
  return { question, qEn, qLang, lang, answer, answerEn: r.answer, found: r.found, memory: mem && { id: mem.id, title: mem.versions["en-IN"].title }, audio: audio.toString("base64"), cloned: !!elder.hasVoice };
}));


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Virasat → http://localhost:${PORT}`));
module.exports = { app };
