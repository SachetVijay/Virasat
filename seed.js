// Seeds demo elders + memories through the real pipeline (Bulbul voice → Saaras → Sarvam-105B → Mayura).
// Demo voices are synthetic Bulbul speakers, flagged demo=1 — never a real person's voice.
const fs = require("fs");
const path = require("path");
for (const line of fs.readFileSync(path.join(__dirname, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const KEY = process.env.SARVAM_API_KEY || process.env.SARVAM_APIi;
const APP = "http://localhost:" + (process.env.PORT || 3000);

async function tts(text, lang, speaker) {
  const r = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST", headers: { "api-subscription-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, language_code: lang, model: "bulbul:v3", speaker, pace: 0.88, speech_sample_rate: 16000 }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return Buffer.from(j.audios[0], "base64");
}
const wav = (buf, name) => new Blob([buf], { type: "audio/wav" });
async function post(url, body, isForm) {
  const r = await fetch(APP + url, isForm ? { method: "POST", body } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (j.error) throw new Error(url + ": " + j.error);
  return j;
}

const ELDERS = [
  {
    name: "Kamala", relation: "Ajji", village: "Melukote, Mandya", language: "kn-IN", speaker: "kavitha", topic: "festival",
    sample: "ನನ್ನ ಹೆಸರು ಕಮಲ. ನಾನು ಮೇಲುಕೋಟೆಯವಳು. ಚಿಕ್ಕವಳಿದ್ದಾಗ ನಮ್ಮ ಮನೆಯ ಮುಂದೆ ದೊಡ್ಡ ಹುಣಸೆ ಮರ ಇತ್ತು, ನಾವು ಅದರ ಕೆಳಗೆ ಆಟ ಆಡುತ್ತಿದ್ದೆವು.",
    turns: [
      ["Ajji, how did Sankranti begin in your house when you were small?",
        "ನಮ್ಮ ಮೇಲುಕೋಟೆಯಲ್ಲಿ ಸಂಕ್ರಾಂತಿ ಅಂದರೆ ದೊಡ್ಡ ಹಬ್ಬ. ಬೆಳಿಗ್ಗೆ ನಾಲ್ಕು ಗಂಟೆಗೆ ಎದ್ದು ಅಮ್ಮ ಮನೆ ಮುಂದೆ ದೊಡ್ಡ ರಂಗೋಲಿ ಹಾಕುತ್ತಿದ್ದರು. ನಾವು ಮಕ್ಕಳು ಹೊಸ ಲಂಗ ಹಾಕಿಕೊಂಡು ಎಳ್ಳು ಬೆಲ್ಲ ಬೀರಲು ಮನೆ ಮನೆಗೆ ಹೋಗುತ್ತಿದ್ದೆವು. ಎಳ್ಳು ಬೆಲ್ಲ ತಿಂದು ಒಳ್ಳೆ ಮಾತಾಡಿ ಅಂತ ಹೇಳುತ್ತಿದ್ದೆವು."],
      ["What happened with the cows in the evening?",
        "ಸಂಜೆ ಕಿಚ್ಚು ಹಾಯಿಸುವುದು ಇತ್ತು. ಹಸುಗಳಿಗೆ ಸ್ನಾನ ಮಾಡಿಸಿ, ಕೊಂಬುಗಳಿಗೆ ಬಣ್ಣ ಹಚ್ಚಿ, ಗಂಟೆ ಕಟ್ಟುತ್ತಿದ್ದೆವು. ಆಮೇಲೆ ಹುಲ್ಲಿಗೆ ಬೆಂಕಿ ಹಚ್ಚಿ ಹಸುಗಳನ್ನು ಅದರ ಮೇಲೆ ಹಾರಿಸುತ್ತಿದ್ದರು. ನಮ್ಮ ಲಕ್ಷ್ಮಿ ಹಸು ಯಾವಾಗಲೂ ಮೊದಲು ಹಾರುತ್ತಿತ್ತು."],
      ["What did everyone eat that day?",
        "ಆ ದಿನ ಸಿಹಿ ಪೊಂಗಲ್ ಮತ್ತು ಖಾರ ಪೊಂಗಲ್ ಮಾಡುತ್ತಿದ್ದೆವು. ಕಬ್ಬು, ಅವರೆಕಾಯಿ, ಗೆಣಸು ಎಲ್ಲಾ ಹೊಲದಿಂದಲೇ ಬರುತ್ತಿತ್ತು. ನನ್ನ ಅಜ್ಜಿ ಹೇಳುತ್ತಿದ್ದರು, ಸಂಕ್ರಾಂತಿ ಆದ ಮೇಲೆ ಸೂರ್ಯ ಉತ್ತರಕ್ಕೆ ತಿರುಗುತ್ತಾನೆ, ಒಳ್ಳೆ ದಿನಗಳು ಬರುತ್ತವೆ ಅಂತ."],
    ],
  },
  {
    name: "Sarla", relation: "Dadi", village: "Varanasi", language: "hi-IN", speaker: "ritu", topic: "remedy",
    sample: "मेरा नाम सरला है। मैं बनारस की हूँ। हमारा घर गंगा घाट के पास था, सुबह-सुबह मंदिर की घंटियों से नींद खुलती थी।",
    turns: [
      ["Dadi, what did you do when the children caught a cold?",
        "जब भी बच्चों को सर्दी खांसी होती थी, मैं हल्दी वाला दूध बनाती थी। एक गिलास दूध में आधा चम्मच हल्दी, थोड़ी सी काली मिर्च पीसकर, और एक चुटकी सोंठ डालकर उबालती थी। रात को सोने से पहले गरम गरम पिलाती थी।"],
      ["And if the nose was blocked?",
        "अगर नाक बंद हो तो अजवाइन की पोटली बनाती थी। तवे पर अजवाइन भूनकर एक सूती कपड़े में बाँध देती थी, फिर उससे छाती और नाक के पास सेंक करती थी। यह मुझे मेरी सास ने सिखाया था, वो कहती थीं, दवा से पहले रसोई देखो।"],
      ["When would you go to the doctor?",
        "लेकिन अगर बुखार तीन दिन से ज़्यादा रहे तो हम वैद्य जी के पास ले जाते थे। घर के नुस्खे छोटी बीमारी के लिए हैं, बड़ी बीमारी में डॉक्टर ज़रूरी है।"],
    ],
  },
  {
    name: "Meenakshi", relation: "Paati", village: "Madurai", language: "ta-IN", speaker: "roopa", topic: "recipe",
    sample: "என் பேர் மீனாட்சி. நான் மதுரைக்காரி. சின்ன வயசுல மீனாட்சி அம்மன் கோவில் திருவிழாவுக்கு அப்பா கூட நடந்தே போவோம்.",
    turns: [
      ["Paati, how do you start your famous rasam?",
        "எங்க வீட்டு ரசம் எல்லாருக்கும் பிடிக்கும். ஒரு எலுமிச்சை அளவு புளியை வெந்நீரில் ஊற வைக்கணும். ரெண்டு தக்காளியை கையால பிசைஞ்சு புளி தண்ணியோட சேர்க்கணும்."],
      ["What spices go in, and how?",
        "அம்மியில மிளகு, சீரகம், நாலு பல் பூண்டு ஒண்ணா தட்டணும். மிக்ஸி வேண்டாம், அம்மியில தட்டினா தான் வாசனை வரும். அதை புளி தண்ணியில போட்டு, கொஞ்சம் மஞ்சள், உப்பு போட்டு கொதிக்க விடணும்."],
      ["What is the secret that makes it taste like yours?",
        "நுரை வந்ததும் அடுப்பை அணைச்சிடணும், ரொம்ப கொதிக்க விடக்கூடாது, அது தான் ரகசியம். கடைசியா நெய்யில கடுகு, காய்ந்த மிளகாய், கறிவேப்பிலை தாளிச்சு, கொத்தமல்லி தூவணும். ஈய சொம்புல வச்சா இன்னும் ருசி."],
    ],
  },
];

(async () => {
  await Promise.all(ELDERS.map(async (E) => {
    const speaker = await tts("test", E.language, E.speaker).then(() => E.speaker).catch(() => "kavitha");
    const fd = new FormData();
    for (const k of ["name", "relation", "village", "language"]) fd.append(k, E[k]);
    fd.append("consent", "true"); fd.append("demo", "1");
    fd.append("voice", wav(await tts(E.sample, E.language, speaker)), "voice.wav");
    const elder = await post("/api/elders", fd, true);
    console.log("elder", elder.name, elder.id, "heard:", elder.voiceSample?.text?.slice(0, 60));
    const turns = await Promise.all(E.turns.map(async ([qEn, a]) => {
      const f = new FormData();
      f.append("audio", wav(await tts(a, E.language, speaker)), "a.wav");
      const t = await post("/api/transcribe", f, true);
      return { q: qEn, qEn, a: t.text, aEn: t.textEn, clipId: t.clipId, duration: t.duration };
    }));
    const mem = await post("/api/memories", { elderId: elder.id, topic: E.topic, turns });
    console.log("memory", mem.versions["en-IN"].title, Object.keys(mem.versions));
  }));
})().catch((e) => { console.error(e); process.exit(1); });
