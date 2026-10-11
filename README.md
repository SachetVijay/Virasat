# 🪔 Virasat: every elder is a library

**Your grandparents' stories, recipes, remedies and songs, kept in their own voice, in every Indian language.**

Built by **Sachet Vijay** (MTech 1st year, IIT Kharagpur) for the Sarvam Campus workshop challenge, entirely on **Sarvam AI**.

---

## The problem

Every time a grandparent passes away, a library burns down. Festival rituals, the hand-measures in a family recipe, the home remedy taught by a mother-in-law, the lullaby, dialect words no textbook has. Almost none of it is written down. It lives in Kannada, Bhojpuri or Tamil spoken in a village, and the grandchildren, often in a city or abroad, frequently can't read that script and sometimes can't speak the language.

## What Virasat does

A grandchild sits with their Ajji and taps record. An **AI interviewer** asks warm questions aloud, in her language:

> *"Ajji, how did Sankranti begin in your house when you were small?"*

She answers naturally, for as long as she likes, in her own dialect. The AI listens, picks up a detail ("your cow Lakshmi always jumped first?") and asks a follow-up. From that conversation Virasat builds a **Memory Book**:

| | |
|---|---|
| 📜 **Story** | Retold in first person, as Ajji talking to her grandchild. Only facts she actually said. |
| ❝ **Her own words** | 2–3 exact quotes in the original language, with meanings |
| 📖 **Words worth keeping** | Dialect and cultural words (ಕಿಚ್ಚು ಹಾಯಿಸುವುದು, ಎಳ್ಳು ಬೆಲ್ಲ) with meaning, context and pronunciation |
| 🍲 / 🌿 / 🎶 | Recipe card (quantities, steps, *the secret*), remedy card (with a safety caution) or song lyrics, depending on what was shared |
| 🫙 **Ask on the next visit** | Gaps the AI noticed, so the family keeps recording |

### ✨ The magic moment
A grandson in London who can't read Kannada opens the memory, chooses **English**, and hears the story **in his grandmother's own voice, speaking English**. A 15-second consented voice sample lets Virasat narrate any memory in **11 Indian languages in the elder's own voice**. He can also play her **real original recording**, or switch on **Roman script** to read along in a language he speaks but can't read.

### 💬 Ask Grandma
Grandchildren ask by voice or text in **any language** (*"Paati, how long should the rasam boil?"*). The answer comes only from what she actually recorded, in the asker's language and in her voice. If she never talked about it, Virasat doesn't make anything up. It says so warmly, and the question goes into the **Question Jar**, which seeds the next interview.

### 📄 Old letters and diaries
Photograph a handwritten letter from 1979 or a recipe notebook. **Sarvam Vision** reads it (22 Indic scripts) and turns it into a memory.

### 🌏 Community value: a Living Dictionary
Every family's dialect words are collected into a shared, searchable dictionary of regional words, each with its meaning, context, the family it came from, and a voice. Across many families, Virasat becomes a crowd-sourced archive of India's oral heritage, preserved before it disappears.

### 🛡️ Built to be trustworthy
- Stories are generated **only from what the elder said**. The model is told never to invent facts.
- **Original recordings are kept forever.** The real voice is always one tap away.
- Voice cloning needs **explicit consent**. Every AI voice is labelled as an AI recreation, and voice samples are **never publicly served**.
- Remedies always carry a *"see a doctor for anything serious"* caution.
- An "English" edition that comes back in the source script is automatically re-translated. A translation that partly fails is never cached.

---

## Sarvam AI stack: 9 capabilities, one flow

| Step | Sarvam API | How it's used |
|---|---|---|
| Hear the elder | **Saaras v3** (`/speech-to-text`) | Runs **transcribe and translate modes in parallel**, so every answer has an original-language and an English version. Long answers are split into 28 s chunks and processed in parallel. |
| Interview & understand | **Sarvam-105B** (chat completions) | Follow-up questions that build on the last answer. Turns raw answers into the Memory Book (story, quotes, glossary, recipe/remedy/song, gaps). Answers "Ask Grandma" only from recorded memories. |
| Speak in their voice | **Voice cloning** (`/voices/clone`) | Recreates the elder's voice from a ≤15 s consented sample, so they can "speak" English, Hindi, Tamil and more |
| Speak | **Bulbul v3** (`/text-to-speech`) | Speaks the interviewer's questions to the elder, the narrator voice, and glossary pronunciations |
| Mother-tongue editions | **Sarvam-Translate** (`sarvam-translate:v1`) | Faithful, natively written versions of every memory in 11 languages. Picked over Mayura-formal after side-by-side tests. |
| Chat with grandkids | **Mayura** (`mayura:v1`, classic-colloquial) | Warm, code-mixed answers in "Ask Grandma" |
| Read old pages | **Sarvam Vision: Document Intelligence** (`/doc-ai/v1/job/digitise`) | Digitises handwritten letters, recipe diaries and song books |
| Which language? | **Text-LID** (`/text-lid`) | Detects the language of typed questions so answers come back in the same language |
| Roman edition | **Transliterate** (`/transliterate`) | Roman-script edition for diaspora grandchildren |

## Screens

- **Archive:** hero, community stats, filters by type and language, memory cards with procedurally generated **kolam** covers
- **Record:** 4-step flow: *Who is sharing?* (elder profile, 15 s voice sample, consent) → *What memory?* (9 topics + Question Jar + scan) → *Interview* (spoken questions, tap-to-record with live waveform, typed fallback) → *Memory Book* (live pipeline view)
- **Memory Book:** 11-language switcher, Roman-script toggle, three voices (🎧 original, 👵 in the elder's cloned voice, 🎙️ narrator) with paragraph-by-paragraph highlighting, recipe/remedy cards, quotes, glossary, the full interview with original clips, WhatsApp share, printable storybook
- **Ask:** pick a grandparent and talk by voice or text in any language
- **Words:** the community Living Dictionary, with search and pronunciation

## Run it

```bash
git clone https://github.com/SachetVijay/Virasat && cd Virasat
npm install
cp .env.example .env          # put your Sarvam key: SARVAM_API_KEY=...
node server.js                # http://localhost:3000
node seed.js                  # optional: 3 demo grandparents (Kannada, Hindi, Tamil) through the real pipeline
```

Requires Node 20+. Microphone recording needs `localhost` or HTTPS.
Demo elders use **synthetic Bulbul voices** (flagged "demo voice") and are never a real person's voice.

## Architecture

```
Browser (vanilla JS, 16 kHz WAV recorder)
   │
   ▼
Express server (server.js)
   ├─ /api/elders            consented voice sample → Saaras
   ├─ /api/interview/question  Sarvam-105B → Sarvam-Translate → Bulbul
   ├─ /api/transcribe        Saaras transcribe + translate (chunked, parallel)
   ├─ /api/memories          Sarvam-105B memory book → Sarvam-Translate → Transliterate
   ├─ /api/scan              Sarvam Vision → Text-LID → memory book
   ├─ /api/memories/:id/version   any of 11 languages (cached)
   ├─ /api/memories/:id/narrate   cloned voice / Bulbul, per paragraph (cached)
   └─ /api/ask               Saaras / Text-LID → Sarvam-105B (grounded) → Mayura → cloned voice
Storage: data/ (JSON db + audio). Only clips/narration/scans are served. Voice samples and the db never are.
All Sarvam calls: concurrency-limited, retried with exponential backoff on 429/5xx.
```

---
Made with ❤️ for every Ajji, Dadi, Nani and Paati.
