# 📜 Kagaz Saathi — "Paper Companion"

**Photograph any official paper. Hear what it says, and what to do next, in your own language.**

India has about 250M+ adults who can't comfortably read the papers that run their lives: electricity disconnection notices, bank letters, court summons, prescriptions, scheme forms, school circulars. These usually arrive in English or formal Hindi. Today they ask a neighbour, or they ignore the paper and pay the price (disconnection, penalties, missed scheme deadlines). Or they fall for **fake KYC/OTP messages**, one of India's fastest-growing frauds.

Kagaz Saathi lets anyone take a photo and get:
- 🔊 **A spoken explanation** in their language (11 languages), in everyday colloquial speech rather than officialese
- ✅ **What to do**: numbered, concrete steps
- ⏰ **A deadline countdown** with key amounts and reference numbers
- 🚨 **A scam check** that flags OTP/PIN/link fraud and redirects to the 1930 cybercrime helpline
- 🎙️ **Voice follow-ups in any Indian language**: ask in Tamil and get the answer in Tamil, no menus
- 📲 **A WhatsApp share** to family, including a Roman-script version

## The Sarvam stack (7 APIs, one flow)

| Step | Sarvam API |
|---|---|
| Read the photo/PDF (any Indic script) | **Sarvam Vision — Document Intelligence** (`/doc-ai/v1/job/digitise`) |
| Understand, extract facts, detect scams | **Sarvam-105B** chat completions |
| Plain colloquial explanation | **Mayura** translate (`classic-colloquial` mode, gender-aware) |
| Speak it | **Bulbul v3** TTS (parallel sentence chunks for low latency) |
| Voice questions with auto language detection | **Saaras v3** STT |
| Typed questions in any script | **Text-LID** |
| Roman-script share text | **Transliterate** |

## Run

```bash
npm install
# .env → SARVAM_API_KEY=...
node server.js   # http://localhost:3000
```

## 60-second demo script
1. Pick **ಕನ್ನಡ** → tap **Sample: electricity notice** → it speaks in Kannada: ₹4,860 due, 9 days left, where to pay.
2. Hold the mic and ask in **Tamil** (or Hindi): *"I already paid, what now?"* → it answers in that language.
3. Tap **Sample: suspicious SMS** → 🚨 "Likely fraud", don't share OTP, call 1930.
4. Tap **Send on WhatsApp** → the explanation goes to a family member.
