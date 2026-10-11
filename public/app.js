// Virasat — client
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $("#app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("virasat." + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("virasat." + k, JSON.stringify(v)); } catch {} },
};

const LANG_NATIVE = {
  "hi-IN": "हिन्दी", "bn-IN": "বাংলা", "gu-IN": "ગુજરાતી", "kn-IN": "ಕನ್ನಡ", "ml-IN": "മലയാളം", "mr-IN": "मराठी",
  "od-IN": "ଓଡ଼ିଆ", "pa-IN": "ਪੰਜਾਬੀ", "ta-IN": "தமிழ்", "te-IN": "తెలుగు", "en-IN": "English",
};
const LANG_EN = {
  "hi-IN": "Hindi", "bn-IN": "Bengali", "gu-IN": "Gujarati", "kn-IN": "Kannada", "ml-IN": "Malayalam", "mr-IN": "Marathi",
  "od-IN": "Odia", "pa-IN": "Punjabi", "ta-IN": "Tamil", "te-IN": "Telugu", "en-IN": "English",
};
const TOPICS = {
  childhood: ["🏡", "Childhood & village", "Games, school, home, neighbours"],
  festival: ["🪔", "Festival or ritual", "How it was really celebrated"],
  recipe: ["🍲", "Family recipe", "Hand-measures, steps, the secret"],
  remedy: ["🌿", "Home remedy", "Nuskhe passed down the line"],
  song: ["🎶", "Folk song / lullaby", "Words, tune, when it was sung"],
  farming: ["🌾", "Farming & nature", "Seasons, rain, animals, soil"],
  craft: ["🧵", "Craft or skill", "Weaving, pottery, kolam, carpentry"],
  family: ["👪", "Family story", "How they met, migrations, hardships"],
  lesson: ["🪷", "Life lessons", "What they want you to remember"],
};
const TYPE_ICON = { story: "📜", recipe: "🍲", remedy: "🌿", song: "🎶", festival: "🪔", wisdom: "🪷", craft: "🧵", childhood: "🏡", farming: "🌾", family: "👪", lesson: "🪷" };
const PALETTES = [
  ["#8c2f39", "#f3c35c", "#fff3dc"], ["#1f6f78", "#f3c35c", "#e9fbf8"], ["#4f3a7a", "#f2a65a", "#f6efff"],
  ["#2f5d3a", "#f3c35c", "#eef8e4"], ["#a34a1f", "#ffd27a", "#fff0e2"], ["#22426b", "#f2b84b", "#eaf2ff"],
];
const RELATIONS = ["Ajji", "Ajja", "Dadi", "Dada", "Nani", "Nana", "Paati", "Thatha", "Ammamma", "Ammumma", "Aaji", "Thakuma", "Dida", "Bebe", "Grandma", "Grandpa"];

let S = { elders: [], memories: [], jar: [], stats: {}, langs: {} };
async function api(url, opts = {}) {
  const init = opts.form ? { method: "POST", body: opts.form } : opts.body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(opts.body) } : {};
  const r = await fetch(url, init);
  const j = await r.json().catch(() => ({ error: "Server returned " + r.status }));
  if (j.error) throw new Error(j.error);
  return j;
}
async function refresh() { S = await api("/api/state"); }
function toast(msg, err) {
  const t = document.createElement("div");
  t.className = "toast" + (err ? " err" : "");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), err ? 5000 : 2600);
}
const elderById = (id) => S.elders.find((e) => e.id === id);

// ---------- procedural kolam (4-fold symmetric dot pattern, seeded) ----------
function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function palette(seed) { return PALETTES[hash(seed) % PALETTES.length]; }
function kolam(seed, { stroke = "#fff", accent = "#f3c35c", n = 7, bg = null } = {}) {
  const r = rng(hash(seed)), S = 100, g = S / (n + 1), h = Math.floor(n / 2);
  const cells = {};
  for (let i = 0; i <= h; i++) for (let j = 0; j <= i; j++) cells[i + "," + j] = { t: Math.floor(r() * 5), a: r() < 0.3 };
  let out = bg ? `<rect width="100" height="100" fill="${bg}"/>` : "";
  out += `<g fill="none" stroke-linecap="round" stroke-linejoin="round">`;
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
    const i = Math.min(x, n - 1 - x), j = Math.min(y, n - 1 - y);
    const c = cells[Math.max(i, j) + "," + Math.min(i, j)];
    const cx = (x + 1) * g, cy = (y + 1) * g, k = g * 0.5, col = c.a ? accent : stroke, w = 1.1;
    if (c.t === 0) out += `<circle cx="${cx}" cy="${cy}" r="${k * 0.82}" stroke="${col}" stroke-width="${w}"/>`;
    else if (c.t === 1) out += `<path d="M${cx} ${cy - k}L${cx + k} ${cy}L${cx} ${cy + k}L${cx - k} ${cy}Z" stroke="${col}" stroke-width="${w}"/>`;
    else if (c.t === 2) out += [0, 90].map((rot) => `<ellipse cx="${cx}" cy="${cy}" rx="${k * 0.95}" ry="${k * 0.38}" transform="rotate(${rot + 45} ${cx} ${cy})" stroke="${col}" stroke-width="${w}"/>`).join("");
    else if (c.t === 3) out += `<path d="M${cx - k} ${cy}Q${cx} ${cy - k * 1.6} ${cx + k} ${cy}Q${cx} ${cy + k * 1.6} ${cx - k} ${cy}Z" stroke="${col}" stroke-width="${w}" transform="rotate(${(x + y) % 2 ? 0 : 90} ${cx} ${cy})"/>`;
    else out += `<rect x="${cx - k * 0.6}" y="${cy - k * 0.6}" width="${k * 1.2}" height="${k * 1.2}" rx="${k * 0.45}" stroke="${col}" stroke-width="${w}" transform="rotate(45 ${cx} ${cy})"/>`;
  }
  out += `<circle cx="50" cy="50" r="${g * 1.3}" stroke="${accent}" stroke-width="1.3"/></g>`;
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) out += `<circle cx="${(x + 1) * g}" cy="${(y + 1) * g}" r="0.9" fill="${stroke}"/>`;
  return out;
}
const kolamSVG = (seed, opts, cls = "") => `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">${kolam(seed, opts)}</svg>`;
$("#brandKolam").innerHTML = kolam("virasat", { stroke: "#8c2f39", accent: "#e9a23b", n: 5 });

function avatar(e, lg) {
  const [c] = palette(e.id);
  return `<span class="avatar ${lg ? "lg" : ""}" style="background:${c}">${esc((e.name || "?")[0])}</span>`;
}
const fmtMin = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s` : `${Math.round(sec || 0)}s`);

// ---------- audio player with a queue + per-item callbacks ----------
const player = $("#player");
const Player = {
  queue: [], onItem: null, onDone: null, token: 0,
  play(items, onItem, onDone) {
    this.stop();
    this.queue = items.slice(); this.onItem = onItem; this.onDone = onDone; this.idx = -1;
    this.next();
  },
  next() {
    const item = this.queue.shift();
    if (!item) { const d = this.onDone; this.onItem = this.onDone = null; d && d(); return; }
    this.idx++;
    player.src = item.src;
    this.onItem && this.onItem(this.idx, item);
    player.play().catch(() => this.next());
  },
  stop() {
    const d = this.onDone; this.queue = []; this.onItem = this.onDone = null;
    player.pause(); d && d(true);
  },
};
player.onended = () => Player.next();
player.onerror = () => Player.next();
const b64wav = (b) => "data:audio/wav;base64," + b;

// ---------- WAV recorder (16 kHz mono PCM — what Saaras and voice cloning want) ----------
class Recorder {
  async start(onLevel) {
    Player.stop();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.proc = this.ctx.createScriptProcessor(4096, 1, 1);
    this.chunks = [];
    this.proc.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(d));
      if (onLevel) { let m = 0; for (let i = 0; i < d.length; i += 16) m = Math.max(m, Math.abs(d[i])); onLevel(m); }
    };
    src.connect(this.proc); this.proc.connect(this.ctx.destination);
    this.t0 = Date.now();
  }
  get seconds() { return (Date.now() - this.t0) / 1000; }
  stop() {
    this.proc.disconnect(); this.stream.getTracks().forEach((t) => t.stop());
    const rate = this.ctx.sampleRate; this.ctx.close();
    const len = this.chunks.reduce((a, c) => a + c.length, 0), all = new Float32Array(len);
    let o = 0; for (const c of this.chunks) { all.set(c, o); o += c.length; }
    const ratio = rate / 16000, out = new Float32Array(Math.floor(len / ratio));
    for (let i = 0; i < out.length; i++) { // simple averaging low-pass while decimating
      const s = Math.floor(i * ratio), e = Math.min(len, Math.floor((i + 1) * ratio)); let sum = 0;
      for (let k = s; k < e; k++) sum += all[k];
      out[i] = sum / Math.max(1, e - s);
    }
    return { blob: encodeWAV(out, 16000), seconds: out.length / 16000 };
  }
}
function encodeWAV(s, rate) {
  const b = new ArrayBuffer(44 + s.length * 2), v = new DataView(b);
  const w = (o, str) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + s.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, s.length * 2, true);
  for (let i = 0; i < s.length; i++) { const x = Math.max(-1, Math.min(1, s[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
  return new Blob([b], { type: "audio/wav" });
}
// a reusable record button: tap to start, tap to stop
function bindRecordButton(btn, { onStop, maxSec = 180, timerEl, waveEl, hintEl, idleHint = "Tap to answer", recHint = "Listening… tap when done" }) {
  let rec = null, tick = null;
  const bars = waveEl ? Array.from({ length: 28 }, () => { const i = document.createElement("i"); waveEl.appendChild(i); return i; }) : [];
  const reset = () => { btn.classList.remove("on"); btn.innerHTML = "🎙️"; if (hintEl) hintEl.textContent = idleHint; if (timerEl) timerEl.textContent = ""; bars.forEach((b) => (b.style.height = "4px")); btn.style.setProperty("--lvl", "0px"); };
  const stop = () => {
    if (!rec) return;
    clearInterval(tick);
    const r = rec; rec = null; reset();
    const out = r.stop();
    if (out.seconds < 0.7) return toast("That was too short. Try again.", true);
    onStop(out);
  };
  btn.onclick = async () => {
    if (rec) return stop();
    try {
      rec = new Recorder();
      let bi = 0;
      await rec.start((lvl) => {
        btn.style.setProperty("--lvl", Math.min(26, lvl * 60) + "px");
        if (bars.length) { bars[bi % bars.length].style.height = 4 + Math.min(32, lvl * 90) + "px"; bi++; }
      });
      btn.classList.add("on"); btn.innerHTML = "■";
      if (hintEl) hintEl.textContent = recHint;
      tick = setInterval(() => {
        const s = rec?.seconds || 0;
        if (timerEl) timerEl.textContent = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}${maxSec < 60 ? ` / 0:${maxSec}` : ""}`;
        if (s >= maxSec) stop();
      }, 200);
    } catch (e) { rec = null; toast("Microphone: " + e.message, true); }
  };
  return { stop };
}

// ---------- router ----------
const routes = { "": viewHome, record: viewRecord, ask: viewAsk, dictionary: viewDictionary, m: viewMemory };
async function route() {
  Player.stop();
  const [, name = "", arg] = location.hash.split("/");
  $$("nav.tabs a").forEach((a) => a.classList.toggle("on", a.dataset.r === (name || "home")));
  window.scrollTo(0, 0);
  try { await (routes[name] || viewHome)(arg); } catch (e) { console.error(e); app.innerHTML = `<div class="card pad empty">Something went wrong: ${esc(e.message)}</div>`; }
}
window.addEventListener("hashchange", route);

// ================= HOME / ARCHIVE =================
let homeFilter = { type: "all", lang: "all" };
async function viewHome() {
  await refresh();
  const st = S.stats;
  app.innerHTML = `
  <section class="hero">
    <div>
      <div class="eyebrow">A living archive of Indian families</div>
      <h1>Every elder is a library.</h1>
      <p class="lead">Record your grandparents' stories, recipes, remedies and songs in <b>their own dialect</b>. Their grandchildren can then read and hear them in any Indian language, <b>in their own voice</b>, for generations.</p>
      <div class="chips"><a class="btn pri" href="#/record">🎙️ Record a memory</a><a class="btn ghost" href="#/ask">💬 Ask a grandparent</a></div>
    </div>
    <div class="hero-art">${kolamSVG("hero-virasat", { stroke: "#8c2f39", accent: "#e9a23b", n: 9 })}</div>
  </section>
  <section class="stats">
    <div class="card stat"><b>${st.memories}</b><span>memories preserved</span></div>
    <div class="card stat"><b>${st.elders}</b><span>elders' voices</span></div>
    <div class="card stat"><b>${st.languages}</b><span>mother tongues</span></div>
    <div class="card stat"><b>${st.words}</b><span>dialect words saved</span></div>
  </section>
  <div style="display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap">
    <div><div class="eyebrow">The archive</div><h2>Memories</h2></div>
    <span class="muted">${st.minutes} minutes of original voice</span>
  </div>
  <div class="filters">
    <div class="chips scroll-x" id="fType"></div>
    <div class="chips scroll-x" id="fLang"></div>
  </div>
  <div class="mem-grid" id="grid"></div>
  <section class="how">
    <div class="card step"><div class="n">1</div><b>Capture the voice</b><p>15 seconds of the elder's voice, with their consent.</p><small>Saaras v3 · Voice clone</small></div>
    <div class="card step"><div class="n">2</div><b>An AI grandchild interviews</b><p>Warm follow-up questions spoken in their language, in any dialect.</p><small>Sarvam-105B · Bulbul v3</small></div>
    <div class="card step"><div class="n">3</div><b>A memory book appears</b><p>A first-person story, their exact words, recipes, a glossary of dialect words.</p><small>Saaras translate · 105B · Vision</small></div>
    <div class="card step"><div class="n">4</div><b>Heard in every language</b><p>Grandkids anywhere hear it in their language, in grandma's voice, and can ask her questions.</p><small>Mayura · Clone · Transliterate · LID</small></div>
  </section>`;
  const types = ["all", ...new Set(S.memories.map((m) => m.type))];
  const langs = ["all", ...new Set(S.memories.map((m) => m.language))];
  const renderFilters = () => {
    $("#fType").innerHTML = types.map((t) => `<button class="chip ${homeFilter.type === t ? "on" : ""}" data-t="${t}">${t === "all" ? "All types" : (TYPE_ICON[t] || "📜") + " " + t}</button>`).join("");
    $("#fLang").innerHTML = langs.map((l) => `<button class="chip ${homeFilter.lang === l ? "on" : ""}" data-l="${l}">${l === "all" ? "All languages" : LANG_NATIVE[l] + " · " + LANG_EN[l]}</button>`).join("");
    $$("#fType .chip").forEach((b) => (b.onclick = () => { homeFilter.type = b.dataset.t; renderFilters(); renderGrid(); }));
    $$("#fLang .chip").forEach((b) => (b.onclick = () => { homeFilter.lang = b.dataset.l; renderFilters(); renderGrid(); }));
  };
  const renderGrid = () => {
    const list = S.memories.filter((m) => (homeFilter.type === "all" || m.type === homeFilter.type) && (homeFilter.lang === "all" || m.language === homeFilter.lang));
    $("#grid").innerHTML = list.length ? list.map(memCard).join("") : `<div class="card empty" style="grid-column:1/-1">No memories yet. <a href="#/record">Record the first one →</a></div>`;
  };
  renderFilters(); renderGrid();
}
function memCard(m) {
  const e = elderById(m.elderId) || {}, [c1, c2] = palette(m.id);
  return `<a class="card mem" href="#/m/${m.id}">
    <div class="cover" style="background:${c1}">${kolamSVG(m.id, { stroke: "rgba(255,255,255,.85)", accent: c2 })}
      <span class="badge type">${TYPE_ICON[m.type] || "📜"} ${esc(m.type)}</span>
      ${m.duration ? `<span class="dur">🎧 ${fmtMin(m.duration)}</span>` : m.source === "scan" ? `<span class="dur">📄 scanned</span>` : ""}
    </div>
    <div class="body">
      <div class="t-native">${esc(m.title)}</div>
      ${m.title !== m.titleEn ? `<div class="t-en">${esc(m.titleEn)}</div>` : ""}
      <div class="who">${avatar(e)}<div><b style="color:var(--ink)">${esc(e.relation)} ${esc(e.name)}</b><br>${esc(e.village)} · ${LANG_NATIVE[m.language] || ""}</div></div>
    </div></a>`;
}

// ================= MEMORY VIEW =================
async function viewMemory(id) {
  await refresh();
  const m = await api("/api/memories/" + id);
  const e = m.elder;
  const [c1, c2] = palette(m.id);
  let lang = store.get("readLang", null);
  if (!lang || !LANG_EN[lang]) lang = e.language;
  let roman = store.get("roman", false);
  let voice = null;
  const jar = S.jar.filter((q) => q.elderId === e.id).slice(-5);
  const clips = m.turns.filter((t) => t.clipId);

  app.innerHTML = `
  <a href="#/" class="muted" style="text-decoration:none;font-weight:600">← Archive</a>
  <section class="mv-cover" style="background:linear-gradient(135deg, ${c1}, ${c1}dd); margin-top:12px">
    ${kolamSVG(m.id, { stroke: "rgba(255,255,255,.9)", accent: c2, n: 9 }, "kolam-bg")}
    <div>
      <span class="badge" style="background:rgba(255,255,255,.18);color:#fff">${TYPE_ICON[m.type] || "📜"} ${esc(m.type)}${m.source === "scan" ? " · from a scanned page" : ""}</span>
      <h1 id="mvTitle" style="margin-top:12px"></h1>
      <div class="en" id="mvTitleEn"></div>
      <div class="meta">${avatar(e, true)}<div><b style="font-size:18px">${esc(e.relation)} ${esc(e.name)}</b><br><span style="opacity:.85">${esc(e.village)} · speaks ${LANG_NATIVE[e.language]}</span></div>
        ${m.era ? `<span class="badge">🕰 ${esc(m.era)}</span>` : ""}${m.place ? `<span class="badge">📍 ${esc(m.place)}</span>` : ""}${e.demo ? `<span class="badge">demo voice (synthetic)</span>` : ""}</div>
    </div>
  </section>

  <div class="mv-layout">
    <div>
      <div class="card listen no-print">
        <div class="row" style="justify-content:space-between">
          <div class="chips scroll-x" id="langBar" style="flex:1"></div>
        </div>
        <div class="row">
          <button class="voice-btn" data-v="original" ${clips.length ? "" : "disabled"}><span class="ic">🎧</span><span><b>Original voice</b><small>${clips.length ? `${esc(e.name)}'s real recording · ${fmtMin(m.duration)}` : "No audio (scanned)"}</small></span></button>
          <button class="voice-btn" data-v="elder" ${e.hasVoice ? "" : "disabled"}><span class="ic">👵</span><span><b>In ${esc(e.relation || e.name)}'s voice</b><small id="cloneLbl"></small></span></button>
          <button class="voice-btn" data-v="narrator"><span class="ic">🎙️</span><span><b>Narrator</b><small>Bulbul v3</small></span></button>
        </div>
        <div class="row" style="justify-content:space-between">
          <label class="chip" style="cursor:pointer"><input type="checkbox" id="romanT" style="width:auto;margin:0" ${roman ? "checked" : ""}/> Aa Roman script</label>
          <span class="ethic">👵 voice = AI recreation from a consented 15s sample</span>
        </div>
      </div>
      <article class="card story section" id="story"></article>
      <div id="extras"></div>
      <section class="section" id="quotes"></section>
      <section class="section" id="glossary"></section>
      <section class="section"><details class="card pad" id="interviewBox"><summary style="cursor:pointer"><h3 style="display:inline">🗣️ The original interview</h3> <span class="muted">· ${m.turns.length} answer${m.turns.length > 1 ? "s" : ""}</span></summary><div id="turns" style="margin-top:12px"></div></details></section>
    </div>
    <aside class="side">
      <div class="card pad">
        <h3>Share this memory</h3>
        <p class="muted" style="font-size:14px;margin:6px 0 12px">Send it to the family group in the language you're reading.</p>
        <div class="chips"><button class="btn pri sm" id="wa">WhatsApp</button><button class="btn ghost sm" id="print">🖨 Print book</button><button class="btn ghost sm" id="copyLink">🔗 Link</button></div>
      </div>
      <div class="card pad">
        <h3>💬 Ask ${esc(e.relation || e.name)}</h3>
        <p class="muted" style="font-size:14px;margin:6px 0 12px">Ask a question in any language and hear the answer in ${esc(e.name)}'s voice, using only what was recorded.</p>
        <a class="btn dark sm" href="#/ask" onclick="store.set('askElder','${e.id}')">Open conversation →</a>
      </div>
      <div class="card pad">
        <h3>🫙 Ask on the next visit</h3>
        <p class="muted" style="font-size:13px;margin:4px 0 6px">Gaps Sarvam-105B spotted, plus questions the family asked that weren't answered yet.</p>
        <div id="nextQs"></div>
        <a class="btn ghost sm" style="margin-top:10px" href="#/record" onclick="store.set('recordElder','${e.id}')">🎙️ Continue the interview</a>
      </div>
      ${m.scan ? `<div class="card pad"><h3>📄 Original page</h3><img class="scan-img" style="margin-top:10px" src="${esc(m.scan)}" alt="Scanned page"/></div>` : ""}
    </aside>
  </div>`;

  const cache = { ...m.versions };
  const vtext = (v) => v; // placeholder for clarity
  function setLangBar() {
    $("#langBar").innerHTML = Object.keys(LANG_EN).map((l) => `<button class="chip ${l === lang ? "on" : ""}" data-l="${l}">${LANG_NATIVE[l]}${l === e.language ? " ★" : ""}</button>`).join("");
    $$("#langBar .chip").forEach((b) => (b.onclick = () => { lang = b.dataset.l; store.set("readLang", lang); Player.stop(); setLangBar(); load(); }));
    $("#cloneLbl").textContent = e.hasVoice ? `AI voice clone, speaking ${LANG_EN[lang]}` : "No voice sample";
  }
  async function load() {
    const story = $("#story");
    if (!cache[lang]) {
      story.classList.add("loading");
      story.innerHTML = `<p>…</p><p>…</p><p>…</p><div class="muted" style="font-size:14px">Mayura is translating into ${LANG_EN[lang]}…</div>`;
      try { cache[lang] = await api(`/api/memories/${m.id}/version`, { body: { lang } }); } catch (err) { toast(err.message, true); }
      story.classList.remove("loading");
    }
    render(cache[lang] || cache["en-IN"]);
  }
  function render(v) {
    const en = cache["en-IN"];
    $("#mvTitle").textContent = v.title;
    $("#mvTitleEn").textContent = lang !== "en-IN" ? en.title : "";
    $("#story").innerHTML = `<div class="eyebrow" style="margin-bottom:14px">${esc(e.relation)} ${esc(e.name)} remembers…</div>` +
      v.story.map((p, i) => `<p data-i="${i + 1}">${esc(p)}</p>${roman && v.roman?.[i + 1] && lang !== "en-IN" ? `<div class="roman">${esc(v.roman[i + 1])}</div>` : ""}`).join("") +
      `<div class="muted" style="font-size:14px;font-style:italic">${esc(v.summary)}</div>`;
    let ex = "";
    if (v.recipe) {
      ex += `<section class="section"><h3>🍲 The recipe${v.recipe.serves ? ` <span class="muted" style="font-size:15px;font-family:var(--sans)">· ${esc(v.recipe.serves)}</span>` : ""}</h3>
        <div class="card recipe"><div class="ing"><b>Ingredients</b><ul>${v.recipe.ingredients.map((i) => `<li><span>${esc(i.item)}</span><b>${esc(i.qty || "")}</b></li>`).join("")}</ul></div>
        <div class="steps"><b>Steps</b><ol>${v.recipe.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>${v.recipe.secret ? `<div class="secret">✨ <b>The secret:</b> ${esc(v.recipe.secret)}</div>` : ""}</div></div></section>`;
    }
    if (v.remedy) {
      ex += `<section class="section"><h3>🌿 The remedy · <span style="font-family:var(--sans);font-size:16px">${esc(v.remedy.for)}</span></h3>
        <div class="card recipe"><div class="ing"><b>You need</b><ul>${v.remedy.ingredients.map((i) => `<li><span>${esc(i)}</span></li>`).join("")}</ul></div>
        <div class="steps"><b>How</b><ol>${v.remedy.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol><div class="caution">⚕️ ${esc(v.remedy.caution || "Traditional knowledge, not medical advice. See a doctor for anything serious.")}</div></div></div></section>`;
    }
    if (m.song?.lines?.length) {
      ex += `<section class="section"><h3>🎶 The song</h3><div class="card pad" style="font-family:var(--serif);font-size:20px;line-height:1.7">${m.song.lines.map(esc).join("<br>")}${m.song.occasion ? `<div class="muted" style="font-family:var(--sans);font-size:14px;margin-top:8px">${esc(m.song.occasion)}</div>` : ""}</div></section>`;
    }
    $("#extras").innerHTML = ex;
    $("#quotes").innerHTML = m.quotes.length ? `<h3>❝ In ${esc(e.name)}'s own words</h3>` + m.quotes.map((q) => `<div class="quote"><div class="o">${esc(q.original)}</div><div class="e">${esc(q.en)}</div></div>`).join("") : "";
    $("#glossary").innerHTML = m.glossary.length ? `<h3>📖 Words worth keeping</h3><div class="gloss">${m.glossary.map((g, i) => `
      <div class="card gword"><div class="w">${esc(g.word)}</div><div class="m">${esc(v.glossary?.[i] || g.meaning)}</div><button class="icon-btn" data-say="${esc(g.word)}" data-lang="${g.lang}" title="Pronounce">🔊</button></div>`).join("")}</div>` : "";
    $$("[data-say]").forEach((b) => (b.onclick = () => say(b.dataset.say, b.dataset.lang, b)));
    $("#nextQs").innerHTML = [...(v.followups || []).map((q) => ({ q, from: "gap" })), ...jar.filter((j) => j.from === "ask").map((j) => ({ q: j.question, from: "family" }))]
      .map((x) => `<div class="next-q"><span>${x.from === "family" ? "🙋" : "🔍"}</span><span>${esc(x.q)}</span></div>`).join("") || `<div class="muted">Nothing pending.</div>`;
  }
  $("#turns").innerHTML = m.turns.map((t, i) => `<div class="turn" data-t="${i}"><div class="q">Q. ${esc(t.qEn || t.q)}</div><div class="a">${esc(t.a)}</div>${t.aEn && t.aEn !== t.a ? `<div class="ae">${esc(t.aEn)}</div>` : ""}
    ${t.clipId ? `<button class="btn ghost sm" style="margin-top:8px" data-clip="${t.clipId}">▶ ${fmtMin(t.duration)}</button>` : ""}</div>`).join("");
  $$("[data-clip]").forEach((b) => (b.onclick = () => Player.play([{ src: `/data/clips/${b.dataset.clip}.wav` }])));
  $("#romanT").onchange = (ev) => { roman = ev.target.checked; store.set("roman", roman); render(cache[lang]); };

  // voices
  const vbtns = $$(".voice-btn");
  const clearPlaying = () => { $$(".story p.playing, .turn.playing").forEach((x) => x.classList.remove("playing")); vbtns.forEach((b) => b.classList.remove("on", "loading")); voice = null; };
  vbtns.forEach((b) => (b.onclick = async () => {
    const v = b.dataset.v;
    if (voice === v) { Player.stop(); return; }
    Player.stop(); clearPlaying(); voice = v; b.classList.add("on");
    if (v === "original") {
      $("#interviewBox").open = true;
      return Player.play(clips.map((t) => ({ src: `/data/clips/${t.clipId}.wav`, t: m.turns.indexOf(t) })),
        (i, it) => { $$(".turn").forEach((x) => x.classList.toggle("playing", +x.dataset.t === it.t)); },
        clearPlaying);
    }
    b.classList.add("loading");
    try {
      const r = await api(`/api/memories/${m.id}/narrate`, { body: { lang, voice: v } });
      if (voice !== v) return;
      b.classList.remove("loading");
      Player.play(r.urls.map((src, i) => ({ src, i })), (i) => {
        $$(".story p").forEach((p) => p.classList.toggle("playing", +p.dataset.i === i));
        $(`.story p[data-i="${i}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, clearPlaying);
    } catch (err) { toast(err.message, true); clearPlaying(); }
  }));

  $("#print").onclick = () => window.print();
  $("#copyLink").onclick = () => { navigator.clipboard?.writeText(location.href).then(() => toast("Link copied")); };
  $("#wa").onclick = () => {
    const v = cache[lang] || cache["en-IN"];
    const text = `🪔 ${v.title}\n— ${e.relation} ${e.name}, ${e.village}\n\n${v.story.slice(0, 2).join("\n\n")}\n\n🎧 Listen in ${e.name}'s voice: ${location.href}`;
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
  };
  setLangBar(); load();
}
async function say(text, lang, btn) {
  btn && (btn.textContent = "…");
  try { const r = await api("/api/say", { body: { text, lang } }); Player.play([{ src: b64wav(r.audio) }]); }
  catch (e) { toast(e.message, true); }
  btn && (btn.textContent = "🔊");
}

// ================= RECORD =================
const R = { step: 1, elder: null, topic: null, seed: null, jarId: null, turns: [], current: null };
async function viewRecord() {
  await refresh();
  const pre = store.get("recordElder", null);
  if (pre && elderById(pre)) { R.elder = elderById(pre); R.step = 2; store.set("recordElder", null); }
  else if (!R.elder || !elderById(R.elder.id)) { R.step = 1; R.elder = null; }
  if (R.step === 3 && !R.topic) R.step = 2;
  renderRecord();
}
function stepper() {
  const steps = ["Who is sharing?", "What memory?", "Interview", "Memory book"];
  return `<div class="stepper">${steps.map((s, i) => `<div class="s ${R.step === i + 1 ? "on" : R.step > i + 1 ? "done" : ""}"><i>${R.step > i + 1 ? "✓" : i + 1}</i>${s}</div>`).join("")}</div>`;
}
function renderRecord() {
  if (R.step === 1) return recStep1();
  if (R.step === 2) return recStep2();
  if (R.step === 3) return recStep3();
}
function recStep1() {
  app.innerHTML = `${stepper()}
  <h2>Who is sharing a memory today?</h2>
  <p class="muted">Pick an elder, or add someone new with a short voice sample so grandchildren can hear them in any language.</p>
  <div class="elders" style="margin-top:16px">
    ${S.elders.map((e) => `<div class="card elder-card" data-id="${e.id}">${avatar(e)}<div><b>${esc(e.relation)} ${esc(e.name)}</b><small>${esc(e.village)} · ${LANG_NATIVE[e.language]}${e.hasVoice ? " · 🎙 voice saved" : ""}</small></div></div>`).join("")}
    <div class="card elder-card new" id="addElder">＋ Add an elder</div>
  </div>
  <div id="newElder" class="card pad hidden" style="margin-top:18px"></div>`;
  $$(".elder-card[data-id]").forEach((c) => (c.onclick = () => { R.elder = elderById(c.dataset.id); R.step = 2; renderRecord(); }));
  $("#addElder").onclick = () => newElderForm();
  if (!S.elders.length) newElderForm();
}
function newElderForm() {
  const box = $("#newElder");
  box.classList.remove("hidden");
  box.innerHTML = `
    <h3>Add an elder</h3>
    <div class="grid2" style="margin-top:14px">
      <div><label class="f">Their name</label><input id="eName" placeholder="e.g. Kamala"/></div>
      <div><label class="f">What do you call them?</label><input id="eRel" list="rels" placeholder="Ajji, Dadi, Nani, Paati…"/><datalist id="rels">${RELATIONS.map((r) => `<option>${r}</option>`).join("")}</datalist></div>
      <div><label class="f">Village / town</label><input id="eVil" placeholder="e.g. Melukote, Mandya"/></div>
      <div><label class="f">Mother tongue</label><select id="eLang">${Object.keys(LANG_EN).map((l) => `<option value="${l}">${LANG_NATIVE[l]} · ${LANG_EN[l]}</option>`).join("")}</select></div>
    </div>
    <div class="card pad" style="margin-top:16px;background:#fffdf7;text-align:center">
      <b>Voice sample · 10–15 seconds</b>
      <p class="muted" style="font-size:14px;margin:4px 0 0">Ask them to say their name, where they grew up, and one thing they remember. Speak naturally, in a quiet room.</p>
      <button class="recbtn" id="vRec" style="width:96px;height:96px;font-size:34px">🎙️</button>
      <div class="rec-timer" id="vTimer"></div><div class="rec-hint" id="vHint">Tap to record the sample</div>
      <div id="vOut" class="muted" style="margin-top:8px;font-size:14px"></div>
    </div>
    <label class="consent" style="margin-top:14px"><input type="checkbox" id="eConsent"/><span><b>They agreed</b> to have their voice preserved and recreated by AI for their family's archive. Voice samples are never public, and they can be deleted.</span></label>
    <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end"><button class="btn pri" id="eSave">Save & continue →</button></div>`;
  $("#eLang").value = "kn-IN";
  let sample = null;
  bindRecordButton($("#vRec"), {
    maxSec: 15, timerEl: $("#vTimer"), hintEl: $("#vHint"), idleHint: "Tap to re-record", recHint: "Recording… tap to stop (auto-stops at 15s)",
    onStop: (o) => { sample = o; $("#vOut").innerHTML = `✓ ${o.seconds.toFixed(1)}s captured <button class="btn ghost sm" id="vPlay">▶ Play</button>`; $("#vPlay").onclick = () => Player.play([{ src: URL.createObjectURL(o.blob) }]); if (o.seconds < 6) toast("Longer samples (10–15s) clone better"); },
  });
  $("#eSave").onclick = async () => {
    const name = $("#eName").value.trim();
    if (!name) return toast("Please enter their name", true);
    if (sample && !$("#eConsent").checked) return toast("Please confirm consent to preserve their voice", true);
    const fd = new FormData();
    fd.append("name", name); fd.append("relation", $("#eRel").value.trim()); fd.append("village", $("#eVil").value.trim()); fd.append("language", $("#eLang").value);
    fd.append("consent", String($("#eConsent").checked));
    if (sample) fd.append("voice", sample.blob, "voice.wav");
    $("#eSave").disabled = true; $("#eSave").textContent = "Saving voice…";
    try {
      const e = await api("/api/elders", { form: fd });
      if (e.voiceSample?.text) toast(`Heard: "${e.voiceSample.text.slice(0, 60)}…"`);
      await refresh(); R.elder = elderById(e.id); R.step = 2; renderRecord();
    } catch (err) { toast(err.message, true); $("#eSave").disabled = false; $("#eSave").textContent = "Save & continue →"; }
  };
}
function recStep2() {
  const e = R.elder;
  const jar = S.jar.filter((q) => q.elderId === e.id).slice(-6).reverse();
  app.innerHTML = `${stepper()}
  <div style="display:flex;gap:14px;align-items:center;margin-bottom:6px">${avatar(e, true)}<div><h2>What will ${esc(e.relation || e.name)} share?</h2><span class="muted">${esc(e.name)} · ${esc(e.village)} · ${LANG_NATIVE[e.language]} <a href="#" id="chg">change</a></span></div></div>
  <div class="topics" style="margin-top:18px">${Object.entries(TOPICS).map(([k, [ic, t, d]]) => `<div class="card topic" data-k="${k}"><div class="e">${ic}</div><b>${t}</b><small>${d}</small></div>`).join("")}</div>
  ${jar.length ? `<div class="card jar"><h3>🫙 From the question jar</h3><p class="muted" style="font-size:14px;margin:4px 0 6px">Questions the family asked, or gaps found in earlier memories. Start with one:</p>
    ${jar.map((q) => `<div class="jar-q"><span>${q.from === "ask" ? "🙋" : "🔍"} ${esc(q.question)}</span><button class="btn dark sm" data-jar="${q.id}">Ask this →</button></div>`).join("")}</div>` : ""}
  <div class="or">or</div>
  <div class="card pad">
    <h3>📄 Scan an old letter, recipe diary or song book</h3>
    <p class="muted" style="font-size:14px;margin:4px 0 12px">Sarvam Vision reads handwritten and printed pages in 22 Indian scripts and turns them into a memory.</p>
    <div class="grid2"><label class="drop" for="scanFile">📷 <b>Choose a photo or PDF</b><br><span class="muted" style="font-size:13px" id="scanName">JPG, PNG or PDF</span><input type="file" id="scanFile" accept="image/*,application/pdf" hidden/></label>
    <div><label class="f">What is it?</label><select id="scanTopic">${Object.entries(TOPICS).map(([k, [ic, t]]) => `<option value="${k}">${ic} ${t}</option>`).join("")}</select>
    <label class="f" style="margin-top:10px">Written in</label><select id="scanLang">${Object.keys(LANG_EN).map((l) => `<option value="${l}" ${l === e.language ? "selected" : ""}>${LANG_EN[l]}</option>`).join("")}</select>
    <div class="chips" style="margin-top:12px"><button class="btn pri sm" id="scanGo" disabled>Read & preserve</button><button class="btn ghost sm" id="scanSample">Try a sample letter</button></div></div></div>
  </div>`;
  $("#chg").onclick = (ev) => { ev.preventDefault(); R.step = 1; R.elder = null; renderRecord(); };
  $$(".topic").forEach((t) => (t.onclick = () => startInterview(t.dataset.k)));
  $$("[data-jar]").forEach((b) => (b.onclick = () => { const q = S.jar.find((j) => j.id === b.dataset.jar); startInterview(guessTopic(q.question), q); }));
  let file = null;
  $("#scanFile").onchange = (ev) => { file = ev.target.files[0]; $("#scanName").textContent = file?.name || ""; $("#scanGo").disabled = !file; };
  $("#scanSample").onclick = async () => {
    const b = await (await fetch("/samples/letter_1979.png")).blob();
    file = new File([b], "letter_1979.png", { type: "image/png" }); $("#scanName").textContent = "letter_1979.png (sample)"; $("#scanGo").disabled = false;
    $("#scanTopic").value = "family"; $("#scanLang").value = "en-IN";
  };
  $("#scanGo").onclick = async () => {
    const fd = new FormData();
    fd.append("file", file); fd.append("elderId", e.id); fd.append("topic", $("#scanTopic").value); fd.append("language", $("#scanLang").value);
    R.step = 4; building(["vision", "lid", "understand", "translate", "roman"]);
    try { const m = await api("/api/scan", { form: fd }); finishBuilding(m); } catch (err) { toast(err.message, true); R.step = 2; renderRecord(); }
  };
}
const guessTopic = (q) => (/recipe|cook|dish|food|masala/i.test(q) ? "recipe" : /remed|medicine|cure|ill/i.test(q) ? "remedy" : /song|sing|lullaby/i.test(q) ? "song" : /festival|puja|ritual/i.test(q) ? "festival" : "family");
function startInterview(topic, jarQ) {
  Object.assign(R, { topic, step: 3, turns: [], current: null, seed: jarQ?.question || null, jarId: jarQ?.id || null });
  renderRecord();
}
function recStep3() {
  const e = R.elder, [ic, tname] = TOPICS[R.topic] || ["📜", R.topic];
  app.innerHTML = `${stepper()}
  <div class="interview">
    <div>
      <div class="card qcard" id="qcard">
        <div class="who">${avatar(e)}<span>Interviewing <b>${esc(e.relation)} ${esc(e.name)}</b> · ${ic} ${tname}</span></div>
        <div class="qn" id="qn">…</div>
        <div class="qe" id="qe"></div>
        <div class="chips" style="justify-content:center;margin-top:12px"><button class="btn ghost sm" id="qReplay">🔊 Hear question again</button><button class="btn ghost sm" id="qSkip">↻ Different question</button></div>
        <button class="recbtn" id="aRec">🎙️</button>
        <div class="wave" id="wave"></div>
        <div class="rec-timer" id="aTimer"></div>
        <div class="rec-hint" id="aHint">Tap and let ${esc(e.relation || e.name)} answer. Take your time.</div>
        <details style="margin-top:16px;text-align:left"><summary class="muted" style="cursor:pointer">Type the answer instead</summary>
          <textarea id="aText" rows="3" style="margin-top:8px" placeholder="Type in any language"></textarea><button class="btn dark sm" style="margin-top:8px" id="aSend">Add answer</button></details>
      </div>
    </div>
    <aside>
      <div class="card pad answers">
        <h3>Answers so far</h3>
        <div id="answers"><p class="muted">No answers yet. Each answer is transcribed by Saaras in ${LANG_EN[e.language]} and translated to English.</p></div>
        <button class="btn pri" id="finish" style="width:100%;justify-content:center;margin-top:12px" disabled>✨ Preserve this memory</button>
        <p class="muted" style="font-size:12px;margin:8px 0 0;text-align:center">2–4 answers make a rich memory.</p>
      </div>
    </aside>
  </div>`;
  const renderAnswers = () => {
    if (!R.turns.length) return;
    $("#answers").innerHTML = R.turns.map((t, i) => `<div class="turn"><div class="q">${esc(t.q)}</div><div class="a">${esc(t.a)}</div><div class="ae">${esc(t.aEn || "")}</div>
      <div class="chips" style="margin-top:6px">${t.clipId ? `<button class="btn ghost sm" data-clip="${t.clipId}">▶ ${fmtMin(t.duration)}</button>` : ""}<button class="btn ghost sm" data-del="${i}">✕</button></div></div>`).join("");
    $$("#answers [data-clip]").forEach((b) => (b.onclick = () => Player.play([{ src: `/data/clips/${b.dataset.clip}.wav` }])));
    $$("#answers [data-del]").forEach((b) => (b.onclick = () => { R.turns.splice(+b.dataset.del, 1); renderAnswers(); }));
    $("#finish").disabled = !R.turns.length;
  };
  const ask = async () => {
    $("#qcard").classList.add("thinking"); $("#qn").textContent = R.turns.length ? "Thinking of a follow-up…" : "Preparing the first question…"; $("#qe").textContent = "";
    try {
      const q = await api("/api/interview/question", { body: { elderId: e.id, topic: R.topic, turns: R.turns, seed: R.turns.length ? null : R.seed } });
      R.current = q;
      $("#qcard").classList.remove("thinking");
      $("#qn").textContent = q.q; $("#qe").textContent = e.language !== "en-IN" ? q.qEn : "";
      Player.play([{ src: b64wav(q.audio) }]);
    } catch (err) { $("#qn").textContent = "Couldn't get a question. Tap ↻ to retry."; toast(err.message, true); }
  };
  const addTurn = (t) => { R.turns.push(t); renderAnswers(); ask(); };
  bindRecordButton($("#aRec"), {
    maxSec: 240, timerEl: $("#aTimer"), waveEl: $("#wave"), hintEl: $("#aHint"), idleHint: "Tap to record the next answer",
    onStop: async (o) => {
      $("#aHint").textContent = "Saaras is listening to the recording…";
      const fd = new FormData(); fd.append("audio", o.blob, "answer.wav");
      try {
        const t = await api("/api/transcribe", { form: fd });
        if (!t.text) { toast("Couldn't hear anything. Try again closer to the mic.", true); return; }
        $("#aHint").textContent = "Tap to record the next answer";
        addTurn({ q: R.current?.q || "", qEn: R.current?.qEn || "", a: t.text, aEn: t.textEn, clipId: t.clipId, duration: t.duration });
      } catch (err) { toast(err.message, true); }
    },
  });
  $("#aSend").onclick = () => { const a = $("#aText").value.trim(); if (!a) return; $("#aText").value = ""; addTurn({ q: R.current?.q || "", qEn: R.current?.qEn || "", a }); };
  $("#qReplay").onclick = () => R.current && Player.play([{ src: b64wav(R.current.audio) }]);
  $("#qSkip").onclick = () => { R.seed = null; ask(); };
  $("#finish").onclick = async () => {
    Player.stop(); R.step = 4; building(["understand", "quotes", "translate", "roman"]);
    try {
      const m = await api("/api/memories", { body: { elderId: e.id, topic: R.topic, turns: R.turns, jarId: R.jarId } });
      finishBuilding(m);
    } catch (err) { toast(err.message, true); R.step = 3; recStep3(); }
  };
  renderAnswers(); ask();
}
const PIPE = {
  vision: "<em>Sarvam Vision</em> is reading the page",
  lid: "<em>Text-LID</em> is identifying the language",
  understand: "<em>Sarvam-105B</em> is retelling the story in first person",
  quotes: "<em>Sarvam-105B</em> is picking out exact quotes and dialect words",
  translate: "<em>Mayura</em> is writing it in the mother tongue",
  roman: "<em>Transliterate</em> is preparing a Roman-script edition",
};
let buildTimer;
function building(keys) {
  app.innerHTML = `${stepper()}<div class="card building">
    <div class="kol">${kolamSVG("building" + Date.now(), { stroke: "#8c2f39", accent: "#e9a23b", n: 7 })}</div>
    <h2>Preserving ${esc(R.elder.relation || R.elder.name)}'s memory…</h2>
    <div class="pipeline">${keys.map((k) => `<div class="p" data-k="${k}"><span class="d"></span><span>${PIPE[k]}</span></div>`).join("")}</div></div>`;
  let i = 0;
  const els = $$(".pipeline .p");
  const adv = () => { if (i > 0) { els[i - 1].className = "p done"; els[i - 1].querySelector(".d").textContent = "✓"; } if (i < els.length) els[i].className = "p run"; i++; };
  adv(); clearInterval(buildTimer);
  buildTimer = setInterval(() => { if (i < els.length) adv(); }, 3500);
}
function finishBuilding(m) {
  clearInterval(buildTimer);
  $$(".pipeline .p").forEach((p) => { p.className = "p done"; p.querySelector(".d").textContent = "✓"; });
  Object.assign(R, { step: 2, turns: [], current: null, seed: null, jarId: null });
  toast("Memory preserved ✨");
  setTimeout(() => (location.hash = "#/m/" + m.id), 600);
}

// ================= ASK =================
async function viewAsk() {
  await refresh();
  if (!S.elders.length) { app.innerHTML = `<div class="card empty">No elders yet. <a href="#/record">Record a memory first →</a></div>`; return; }
  let eid = store.get("askElder", null);
  if (!elderById(eid)) eid = S.elders[0].id;
  const history = {};
  const draw = () => {
    const e = elderById(eid);
    const mems = S.memories.filter((m) => m.elderId === e.id);
    app.innerHTML = `
    <div class="eyebrow">Ask a grandparent</div><h2 style="margin-bottom:16px">Talk to the memories</h2>
    <div class="ask">
      <aside class="ask-elders">
        ${S.elders.map((x) => `<div class="card elder-card ${x.id === eid ? "on" : ""}" data-id="${x.id}">${avatar(x)}<div><b>${esc(x.relation)} ${esc(x.name)}</b><small>${S.memories.filter((m) => m.elderId === x.id).length} memories · ${LANG_NATIVE[x.language]}</small></div></div>`).join("")}
        <div class="card pad" style="margin-top:6px"><p class="ethic" style="margin:0">Answers come only from ${esc(e.name)}'s recorded memories, spoken by an AI recreation of their voice in <b>your</b> language. When there's no answer, your question goes into the 🫙 question jar for the next visit.</p></div>
      </aside>
      <div class="card chat">
        <div class="log" id="log"><div class="bubble bot">${esc(e.relation || e.name)} has ${mems.length} memor${mems.length === 1 ? "y" : "ies"}: ${mems.map((m) => `<a href="#/m/${m.id}">${esc(m.titleEn)}</a>`).join(", ") || "none yet"}. Ask anything, by voice or text, in any Indian language.</div></div>
        <div class="suggest" id="sug"></div>
        <div class="bar"><button class="mic-sm" id="askMic" title="Ask by voice">🎙️</button><input id="askQ" placeholder="Type or speak in any language…"/><button class="btn pri" id="askGo">Ask</button></div>
      </div>
    </div>`;
    $$(".elder-card[data-id]").forEach((c) => (c.onclick = () => { eid = c.dataset.id; store.set("askElder", eid); draw(); }));
    const sugs = suggestionsFor(e, mems);
    $("#sug").innerHTML = sugs.map((s) => `<button class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join("");
    $$("#sug .chip").forEach((c) => (c.onclick = () => send({ question: c.dataset.s })));
    const log = $("#log");
    (history[eid] || []).forEach((h) => log.appendChild(h));
    const bubble = (cls, html) => { const d = document.createElement("div"); d.className = "bubble " + cls; d.innerHTML = html; log.appendChild(d); (history[eid] ||= []).push(d); d.scrollIntoView({ behavior: "smooth", block: "end" }); return d; };
    async function send({ question, audio }) {
      const me = bubble("me", audio ? "🎙️ …" : esc(question));
      const bot = bubble("bot", `<span class="muted">${audio ? "Saaras is listening…" : "Remembering…"}</span>`);
      const fd = new FormData(); fd.append("elderId", eid);
      if (audio) fd.append("audio", audio, "q.wav"); else fd.append("question", question);
      try {
        const r = await api("/api/ask", { form: fd });
        if (!r.question) { me.remove(); bot.remove(); return toast("Couldn't hear that. Try again.", true); }
        me.innerHTML = `${esc(r.question)}<div class="meta"><span class="badge">${audio ? "🎙 Saaras" : "⌨ Text-LID"}: ${LANG_EN[r.qLang] || r.qLang || "?"}</span></div>`;
        bot.innerHTML = `${esc(r.answer)}<div class="meta">
          <button class="btn ghost sm" data-replay>🔊 Replay</button>
          <span class="badge ai">${r.cloned ? `👵 ${esc(e.name)}'s AI voice` : "🎙 Bulbul"} · ${LANG_EN[r.lang]}</span>
          ${r.memory ? `<a class="badge" href="#/m/${r.memory.id}">📜 ${esc(r.memory.title)}</a>` : ""}
          ${r.found === false ? `<span class="badge demo">🫙 saved for next visit</span>` : ""}</div>`;
        const src = b64wav(r.audio);
        $("[data-replay]", bot).onclick = () => Player.play([{ src }]);
        Player.play([{ src }]);
      } catch (err) { bot.textContent = "Sorry: " + err.message; }
    }
    bindRecordButton($("#askMic"), { maxSec: 30, onStop: (o) => send({ audio: o.blob }) });
    $("#askGo").onclick = () => { const q = $("#askQ").value.trim(); if (q) { $("#askQ").value = ""; send({ question: q }); } };
    $("#askQ").onkeydown = (ev) => ev.key === "Enter" && $("#askGo").click();
  };
  draw();
}
function suggestionsFor(e, mems) {
  const s = [];
  const types = new Set(mems.map((m) => m.type));
  if (types.has("recipe")) s.push("What is the secret of your recipe?", "எவ்வளவு புளி போடணும்?");
  if (types.has("remedy")) s.push("सर्दी में क्या पिलाती थीं?", "When should we see a doctor?");
  if (types.has("festival")) s.push("ಹಸುಗಳಿಗೆ ಏನು ಮಾಡುತ್ತಿದ್ದಿರಿ?", "What did you eat on the festival?");
  s.push("How did you meet grandpa?");
  return s.slice(0, 4);
}

// ================= DICTIONARY =================
async function viewDictionary() {
  await refresh();
  const words = S.memories.flatMap((m) => m.glossary.map((g) => ({ ...g, mem: m, elder: elderById(m.elderId) })));
  let q = "", lang = "all";
  app.innerHTML = `
  <div class="eyebrow">Community dictionary</div><h2>Words worth keeping</h2>
  <p class="muted" style="max-width:640px">Dialect words, kitchen terms, rituals and kinship names, collected from every family's memories. Many of these words never appear in a textbook. Here they're preserved with their meaning, their context, and a real voice.</p>
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin:18px 0"><input id="dq" placeholder="Search a word or meaning…" style="max-width:360px"/><div class="chips" id="dl"></div></div>
  <div class="dict" id="dict"></div>`;
  const langs = ["all", ...new Set(words.map((w) => w.lang))];
  const drawL = () => {
    $("#dl").innerHTML = langs.map((l) => `<button class="chip ${l === lang ? "on" : ""}" data-l="${l}">${l === "all" ? "All" : LANG_NATIVE[l]}</button>`).join("");
    $$("#dl .chip").forEach((c) => (c.onclick = () => { lang = c.dataset.l; drawL(); draw(); }));
  };
  const draw = () => {
    const list = words.filter((w) => (lang === "all" || w.lang === lang) && (!q || (w.word + " " + w.meaning + " " + (w.context || "")).toLowerCase().includes(q)));
    $("#dict").innerHTML = list.map((w) => `<div class="card dword">
      <div class="top-row"><div class="w">${esc(w.word)}</div><span class="badge">${LANG_NATIVE[w.lang]}</span><button class="icon-btn" data-say="${esc(w.word)}" data-lang="${w.lang}">🔊</button></div>
      <div class="m">${esc(w.meaning)}</div>${w.context ? `<div class="c">${esc(w.context)}</div>` : ""}
      <div class="src">From <a href="#/m/${w.mem.id}">${esc(w.mem.titleEn)}</a> · ${esc(w.elder?.relation)} ${esc(w.elder?.name)}, ${esc(w.elder?.village)}</div></div>`).join("") || `<div class="card empty" style="grid-column:1/-1">No words yet.</div>`;
    $$("[data-say]").forEach((b) => (b.onclick = () => say(b.dataset.say, b.dataset.lang, b)));
  };
  $("#dq").oninput = (ev) => { q = ev.target.value.toLowerCase(); draw(); };
  drawL(); draw();
}

window.store = store;
route();
