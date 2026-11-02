# Avantika’s Adventure — Build Spec for Claude Code

**App name:** Avantika’s Adventure · **Mascot:** Tara the elephant 🐘

**Student:** Avantika · Class VI · Bengaluru (timezone `Asia/Kolkata`)
**Owner:** Parent/guardian
**Spec version:** 1.0 (October 2026)

---

## 0. How to use this file (instructions for Claude Code)

1. Read this whole file before writing any code. Save it in the repo as `docs/SPEC.md`, with the theme prototype beside it as `docs/theme-prototype.html` (§15).
2. Build in the phases listed in §16, one phase at a time. At the end of each phase: run all tests, run the content validator, summarise what was built, list anything not done, and wait for the go-ahead before starting the next phase.
3. In Phase 0, create a short `CLAUDE.md` at the repo root (under 200 lines). It should contain the commands, a folder map, coding conventions, the non-negotiable rules from §12, and a pointer saying "Full spec: docs/SPEC.md — read the relevant section before each phase."
4. **Never hard-code subjects, chapters, questions, videos or timetable slots inside components.** Everything the parent might change lives in `/content` as JSON and is validated with Zod (§13).
5. Seed content in the appendices is marked `SAMPLE` and exists only to prove the engine works. **Real chapters are created only from Avantika's own textbooks and school notes, through the import process in §13A. Never invent syllabus content from general knowledge.**
6. When something here is ambiguous, choose the simpler option and record the decision in `docs/DECISIONS.md`.
7. §12 (safety, privacy and wellbeing) cannot be traded away for convenience.

---

## 1. What we are building

A colourful, kid-friendly study app that **follows Avantika's real weekly timetable**. At each study slot, it guides her through a short lesson built around a **visual video explanation**, interactive practice and a quick test. Twice a week she takes an **online, subject-wise test** inside the app. The app uses the results to fix weak spots and keep her on track until exam day.

The app rests on three ideas:

| Idea | What it means in the app |
|---|---|
| **Timetable-guided** | The Today screen shows exactly what to do *now*, using the timetable in §4. No guessing what to study. |
| **Video-first learning** | Every lesson opens with a short visual explanation: either a built-in animated "concept video" or a parent-approved video clip. Videos include pause-and-answer checkpoints. |
| **Test-driven** | Checkpoints inside videos → a Lesson Check after every lesson → a Daily Assignment at the end of each day → two weekly online tests (Saturday and Sunday), marked subject by subject. |

"Online test" here means a test taken **on screen inside the app** and marked automatically. It must still work without internet.

---

## 2. Users and devices

- **Avantika (primary user):** 11–12 years old, Class VI. Needs big buttons, large text, bright colours and encouraging words. Never scold her or make her feel bad.
- **Parent (secondary user):** sets up exam dates and chapters, adds video links, sees progress. The parent area is protected by a 4-digit PIN.
- **Device:** a family tablet or laptop in a browser, installable as a PWA. Design for touch first (tablet portrait and landscape), and make sure it also works on a laptop and a phone.
- **Single device, no accounts.** All data stays on the device (§12).

---

## 3. Subjects

| id | Name | Emoji | Colour token | Sessions per week |
|---|---|---|---|---|
| `maths` | Maths | 📘 | `--maths` `#3f7bf6` | 5 |
| `physics` | Physics | ⚡ | `--physics` `#7a5af8` | 3 |
| `chemistry` | Chemistry | 🧪 | `--chemistry` `#14b8a6` | 3 |
| `biology` | Biology | 🌿 | `--biology` `#43a047` | 3 |
| `english` | English | 📖 | `--english` `#f0643c` | 3 |
| `history` | History / Civics | 🏛️ | `--history` `#b45309` | 3 |
| `geography` | Geography | 🌏 | `--geography` `#0ea5e9` | 3 |

These items are **not** taught in the app. They appear on the timetable only as tick-off items: Hindi & Kannada tuition (`--tuition` `#64748b`), Hindi/Kannada tuition homework (`--lang` `#ff5f87`), Bharatanatyam (`--dance` `#d946ef`) and Badminton (`--sport` `#84cc16`). Breaks and rest use `--fun` `#ffbf1f`.

> **Board note:** The split into Physics / Chemistry / Biology and History & Civics / Geography looks like an ICSE-style Class VI syllabus. Do **not** assume this. The board and chapter list come from the parent (§18). Hindi and Kannada can be added later as normal subjects just by adding content files.

---

## 4. The weekly timetable (single source of truth)

The machine-readable version is in **Appendix A** (`content/timetable.json`). The app must render and schedule **only** from that file. The tables below are for people to read.

### Slot kinds

| kind | Meaning | App behaviour |
|---|---|---|
| `lesson` | New learning in a subject | Full guided lesson (§6) |
| `homework_lesson` | School homework first, then a lesson | Homework timer, then a lesson in the time left (§5.3) |
| `revise` | Revision of a subject | Flashcards plus a mixed quiz, weakest topics first |
| `fixit` | Repair mistakes from that weekend's test, then continue | Fix-it session (§8.6), then the next lesson in the queue |
| `test` | Weekly online test | Test runner (§8.3) |
| `review` | Look at test results | Results and correction report screen |
| `activity` | Dance, tuition, badminton | Friendly card with a tick box, no studying |
| `break` | Snack, dinner, free time | Friendly card, no tick box needed |
| `offline_task` | Hindi/Kannada tuition homework | Tick box only |

### Weekdays (home from school at 3:30 PM, lights out 9:45 PM)

| Time | Mon 💃 | Tue 🧑‍🏫 | Wed 💃 | Thu 🧑‍🏫 | Fri 🧑‍🏫 |
|---|---|---|---|---|---|
| 3:30–4:15 | Snack & rest | Snack & rest | Snack & rest | Snack & rest | Snack & rest |
| 4:15–5:15 | **Maths** (homework + lesson, 60) | 4:15–5:00 **Maths** (homework + lesson, 45) | **Maths** practice (60) | 4:15–5:00 **Physics** (45) | 4:15–5:00 **English** writing (45) |
| 5:00–6:00 | — | Tuition (Hindi & Kannada) | — | Tuition | Tuition |
| 5:15–5:30 | Break | — | Break | — | — |
| 5:30–6:15 | **Physics** (45) | — | **Chemistry** (45) | — | — |
| 6:00–6:30 | — | Break | — | Break | Break |
| 6:30–7:30 | Bharatanatyam | **History/Civics** (60) | Bharatanatyam | **Maths** practice (60) | 6:30–7:15 **Chemistry** (45) |
| Evening | 7:30–8:15 Dinner | 7:30–8:30 Play + dinner | 7:30–8:15 Dinner | 7:30–8:30 Free + dinner | 7:15–8:30 Family + dinner |
| Late 1 | 8:15–9:00 **English** (45) | 8:30–9:00 **Biology** (30) | 8:15–9:00 **Biology** (45) | 8:30–9:00 **Geography** (30) | 8:30–9:30 **Physics** numericals (60) |
| Late 2 | 9:00–9:30 **Geography** (30) | 9:00–9:30 Hindi/Kannada homework | 9:00–9:30 **History/Civics** revise (30) | 9:00–9:30 Hindi/Kannada homework | — |

### Weekend (online tests on both days)

| Time | Saturday 🌟 | Time | Sunday 📝🏸 |
|---|---|---|---|
| 9:00–10:00 | **Maths** (60) | 9:00–9:30 | Quick revision: Maths, Physics, Chemistry, Biology |
| 10:15–11:00 | **Chemistry** (45) | 9:30–10:30 | 🖥️ **SUNDAY TEST: Maths, Physics, Chemistry, Biology** |
| 11:00–11:45 | **Biology** (45) | 10:30–11:00 | Results + get ready |
| 11:45–3:30 | Lunch, rest & play | 11:00–12:00 | 🏸 Badminton class |
| 3:30–4:15 | 🖥️ **SATURDAY TEST: English, History/Civics, Geography** | 12:00–4:30 | Lunch, rest, family time |
| 4:30–5:15 | **English** fix-it + lesson | 4:30–5:15 | Fix-it: Maths & Science mistakes + preview of next week |
| 5:15–6:00 | **Geography** fix-it + lesson | | |
| 6:15–7:00 | **History/Civics** fix-it + lesson | | |

**Why the tests are split this way:** each subject is tested once a week in its own section. English, History/Civics and Geography have had two weekday sessions each before the Saturday test, and the Saturday evening sessions then fix that test's mistakes right away. Maths and the three sciences have all had their weekly sessions, including Saturday morning, before the Sunday test.

---

## 5. How the app follows the timetable

### 5.1 Today screen (the home screen)

- A greeting with the day number and an exam countdown: "Good evening, Avantika! 🌙 Day 23 · 31 days to exams."
- **Now card:** the slot that matches the current time, with a big **Start** button (for study slots) or a friendly message (for activities, e.g. "Enjoy Bharatanatyam! 💃 See you at 7:30.").
- **Next card:** what comes next and at what time.
- **Day timeline:** every slot for today, in subject colours, each marked ✅ done / ▶️ now / ⏳ later / ⚠️ catch up.
- **Progress ring:** today's app lessons done out of the total, plus streak 🔥 and stars ⭐.

### 5.2 Timing rules ("the timetable guides, it doesn't lock her in")

- All of **today's** study slots can be started at any time today, in any order. The Now card just highlights the one that matches the clock.
- A study slot not started by the end of its time window shows as **Catch up** (amber, never red). It stays available until bedtime.
- **Future days are locked.** The parent can unlock one with the PIN.
- If a lesson is never done, it **stays at the front of that subject's queue** (§9.2), so the next slot for that subject picks it up. This is how the plan reshuffles itself.
- **Bedtime:** after 21:45 on school nights (Sunday to Thursday nights), the app shows "Time to sleep! 🌙 Your stars are safe." Studying is blocked. The parent PIN can override this. The time is configurable.

### 5.3 Homework-first slots (`homework_lesson`)

School homework comes first and is done offline in her notebook. When she starts the slot:

1. The app asks: "Do you have school homework for Maths today?" with options **No / 15 min / 30 min / 45 min**.
2. A homework timer runs, with a big "I've finished my homework ✅" button.
3. The remaining minutes choose a lesson template from §5.4. If 20–29 minutes are left, she gets a **mini lesson** (Watch + 3-question check). If under 20 minutes are left, she gets a **Check only** (3 questions on the last lesson). The skipped part of the lesson goes back into the queue.

### 5.4 Lesson templates by slot length (minutes)

| Slot | Warm-up | Watch | Learn cards | Try it | Notebook task | Lesson Check |
|---|---|---|---|---|---|---|
| 30 | 2 | 1 video ≤ 6 | 4 | 8 | 3 | 3 questions (~4 min) |
| 45 | 3 | 1 video ≤ 8 | 6 | 12 | 5 | 5 questions (~6 min) |
| 60 | 3 | 2 parts ≤ 6 each | 8 | 15 | 5 | 6 questions (~8 min), plus an eye break halfway |

**The day's final app lesson** also hosts the **Daily Assignment** (§8.1). In that slot the template shrinks by 10 minutes and the Lesson Check is folded into the Daily Assignment, so the day does not run late. Using Appendix A, the final app lesson is: Mon Geography, Tue Biology, Wed History/Civics revise, Thu Geography, Fri Physics, Sat History/Civics fix-it. On Sunday, the test replaces the Daily Assignment.

---

## 6. Lesson flow (what happens inside one study slot)

Each step is a full-screen card with a big **Next** button and a step indicator. The kid can go back but cannot skip ahead past the Lesson Check.

1. **Warm-up recall (2–3 min).** Two flashcards from that subject's previous lesson or weak topics. Tap to reveal, then "I knew it 👍 / Not yet 🤔". This feeds mastery (§8.5).
2. **Watch (video explanation).** A built-in concept explainer or a curated video (§7), with 1–3 checkpoint questions inside it.
3. **Learn cards.** One idea per card, each with a diagram or emoji, a worked example, a "Did you know? 🤩" fact, and tap-to-reveal answers.
4. **Try it (interactive practice).** Guided questions with hints:
   - first wrong answer → a hint 💡
   - second wrong answer → a "watch this bit again" button that jumps to the matching moment in the video
   - third wrong answer → show the worked answer.

   Use the question types from §8.2, especially drag-and-drop, matching, and labelling a diagram.
5. **Notebook task (offline).** "Draw and label a leaf in your notebook 📓", "Solve these 3 sums in your notebook". She taps "Done ✅". This keeps some learning off-screen on purpose (§12).
6. **Lesson Check.** 3–6 questions, no hints, marked instantly.
7. **Feedback.** Score, a celebration, and a **mini correction report** for every wrong answer (§8.4).
8. **Key rules card + stars.** The "rules to remember" for this lesson, stars earned, streak update, and "Up next: …".

The app autosaves after every step. If it is closed, the lesson resumes from the same step.

---

## 7. Video-based explanations

### 7.1 Two kinds of video

| Kind | What it is | When to use it |
|---|---|---|
| **Concept Explainer** (built-in) | An animated, narrated, video-like sequence built in code: React + SVG + Framer Motion, with narration from the Web Speech API and on-screen captions. Defined by scene JSON (Appendix C). | The **difficult concepts** in §7.5. Works offline, always matches the syllabus exactly, and can be paused at any point for a question. |
| **Curated Video** | A parent-approved YouTube clip (with start/end times) or a local MP4 in `content/media/`. | Topics where a good existing video is clearer or more engaging. |

A lesson can have a `primary` video and an optional `alternate` video. The **"I didn't get it — explain it another way 🔄"** button plays the alternate (or replays the explainer scene slower, at 0.75×).

### 7.2 Video player (same for both kinds)

- Play/pause, **back 10 s**, speed (0.75× / 1× / 1.25×), fullscreen.
- Captions **on by default**, in large text.
- A progress bar with **checkpoint markers** (⭐) and named chapters ("Shadows", "Pinhole camera").
- Big tap targets: at least 56 px for play/pause.
- The app remembers where she stopped. "Watched" means she reached the end with all checkpoints answered.

### 7.3 Checkpoints (pause-and-answer)

Each video has 1–3 checkpoints: `{ at: seconds, questionId, rewindTo: seconds }`.

1. At `at`, the video pauses and a question appears over it.
2. Correct → "Yes! ⭐" plus 1 star, and the video continues.
3. Wrong → a hint, plus a "Watch that part again" button that jumps to `rewindTo` and comes back to the same checkpoint.
4. Wrong a second time → show the answer with a one-line explanation, then continue. **Never trap her in the video.**
5. Checkpoint results count towards mastery (§8.5) with a low weight.

### 7.4 Concept Explainer engine

- An explainer is a list of **scenes**. Each scene has: a `visual` (a component name from the registry), `props`, `narration` text, `captions` (defaults to the narration), `minDuration`, optional `steps` (animation states the visual moves through as the narration plays), and an optional checkpoint at the end.
- **Narration:** use `speechSynthesis`. Prefer an `en-IN` voice, fall back to any English voice, and if no voice exists show captions only. Speak at rate 0.95, sentence by sentence, keeping captions in sync. The parent can mute narration in settings.
- **Scene timing:** a scene lasts until its narration ends or `minDuration`, whichever is longer, then moves on automatically. Play/pause/seek work across scenes like a normal video.
- **Visual registry:** `src/explainers/visuals/` contains reusable, prop-driven SVG components (§7.5). Each must be responsive, follow `prefers-reduced-motion` (show still frames step by step instead), and use the subject colour tokens.
- Explainers must run fully offline.

### 7.5 Difficult concepts that need explainers (visual component library)

Build the components the seed content needs first (Phase 2: `ParticleBox`, `LightRay`, `NumberLine`). Build the rest in Phase 7, or as soon as the parent's real chapters need them.

| Subject | Visual component | Concepts it explains |
|---|---|---|
| Maths | `NumberLine` | Integers (temperature, lift floors), fractions and decimals on a line, adding and subtracting integers as jumps |
| Maths | `FractionBar` | Equivalent fractions, comparing fractions, simplifying to lowest terms (pizza and bar views) |
| Maths | `RatioMixer` | Ratio and proportion (mixing juice, recipe scaling) |
| Maths | `AngleTool` | Types of angles, using a protractor, angle sum of a triangle |
| Maths | `GridArea` | Perimeter and area on a square grid |
| Physics | `MeasureRuler` | Reading a scale, correct eye position, units and conversion |
| Physics | `ForceArrows` | Push and pull, effects of force, friction |
| Physics | `LeverSeesaw` | Fulcrum, load and effort, the three classes of lever |
| Physics | `LightRay` | Light travels in straight lines, shadows, transparent/translucent/opaque, pinhole camera image |
| Physics | `MagnetField` | Poles, attraction and repulsion, magnetic and non-magnetic materials, compass |
| Chemistry | `ParticleBox` | States of matter, particle movement when heating and cooling, melting, boiling, condensation |
| Chemistry | `SeparationLab` | Hand-picking, sieving, decantation, filtration, evaporation, magnetic separation |
| Chemistry | `ChangeSorter` | Physical and chemical changes (drag to sort, animated examples) |
| Chemistry | `AirMix` | Composition of air (about 78% nitrogen, 21% oxygen, 1% other gases) |
| Biology | `CellExplorer` | Plant cell and animal cell parts and their functions (tap to zoom) |
| Biology | `LeafFactory` | Photosynthesis: sunlight, water and carbon dioxide in, food (glucose) and oxygen out |
| Biology | `DigestiveJourney` | The path of food from mouth to large intestine, and what happens at each stop |
| Biology | `FlowerParts` | Parts of a flower, with labelling |
| Biology | `FoodChain` | Producers, consumers, food chains and webs |
| History/Civics | `TimelineScrubber` | BCE/CE, reading timelines, ordering events |
| History/Civics | `CityMap` | Planned cities (grid streets, drains, citadel), as in the Indus Valley Civilisation |
| History/Civics | `FlowChart` | Local self-government structures (rural and urban), how decisions are made |
| Geography | `EarthMotion` | Rotation → day and night, revolution → seasons |
| Geography | `GlobeGrid` | Latitudes, longitudes, Equator, Prime Meridian, hemispheres |
| Geography | `LandformMorph` | Mountains, plateaus, plains, how landforms are formed |
| Geography | `MapReader` | Directions, symbols, scale, reading a map |
| English | `TenseTimeline` | Past, present and future tenses on a timeline |
| English | `SentenceBuilder` | Sentence order, parts of speech (drag words to build sentences) |

### 7.6 Curated videos (YouTube or MP4)

- Use the **YouTube IFrame Player API** with the privacy-enhanced domain `https://www.youtube-nocookie.com/embed/{id}` and the parameters `enablejsapi=1&rel=0&playsinline=1&start={s}&end={e}&cc_load_policy=1`.
- The player is controlled by the app's own controls and checkpoint logic. When a clip ends (or reaches `end`), **immediately cover the player with the app's own "Next" screen**, so YouTube's suggested videos are never shown.
- Only video IDs listed in content files may play. There is no search box, no comments and no links out (§12).
- If a video ID is missing or marked `REPLACE_ME`, or the device is offline, play the lesson's explainer if it has one. Otherwise skip straight to the Learn cards with the message "Video not available right now — let's learn with cards! 🃏". Never show an error screen to the kid.
- **Parent adds videos in the Content Manager (§11):** paste a link → the app extracts the ID → preview → set start/end and checkpoints → save. Suggested trusted sources for the parent to choose from: Khan Academy, NCERT/CIET official channels, DIKSHA. The parent must confirm each video matches her board and chapter.
- Local MP4 files go in `content/media/videos/`, use the same player and checkpoint logic, and work offline.

### 7.7 Screen-time guardrails

- Each video segment is ≤ 8 minutes, and there is at most 15 minutes of video per lesson. The content validator warns when these limits are exceeded.
- After 20 minutes of continuous screen time, show an **eye-break prompt** (20-20-20 rule): "Look at something far away for 20 seconds 👀". It is skippable once.
- Every lesson has an offline notebook task (§6, step 5).

---

## 8. Tests and assessments

### 8.1 Test levels

| Level | When | Size | Purpose |
|---|---|---|---|
| **Checkpoint** | Inside videos | 1 question | Is she following the video? |
| **Lesson Check** | End of every lesson | 3–6 questions | Did today's lesson work? |
| **Daily Assignment** | End of the day's final app lesson (§5.4) | 6–8 questions, about 10 minutes | Mixed questions from *every* lesson done today (2–3 per lesson). **Required every study day.** |
| **Saturday Test** | Sat 15:30–16:15 | 3 sections × 15 min | English, History/Civics, Geography, each marked separately |
| **Sunday Test** | Sun 09:30–10:30 | 4 sections × 15 min | Maths, Physics, Chemistry, Biology, each marked separately |
| **Mock Exam** | Revision window (§9.3) | Full paper per subject | Practises the real exam paper format |

### 8.2 Question types

| type | UI | Marking |
|---|---|---|
| `mcq` | 2–4 big option buttons (options shuffled) | Automatic |
| `true_false` | Two big buttons | Automatic |
| `fill_blank` | Text input in the sentence | Automatic. Ignore case and extra spaces, accept any answer in `accept[]`, and for numbers allow `tolerance` and optional units. |
| `match` | Drag-and-drop pairs (dnd-kit, touch-friendly), with tap-tap as an alternative | Automatic, partial marks per pair |
| `order` | Drag to arrange in sequence (timelines, steps) | Automatic, partial marks for pieces in the right order |
| `label_diagram` | Drag labels onto hotspots on an SVG or image | Automatic, partial marks per label |
| `numeric` | Number pad, with a unit picker if needed | Automatic, with `tolerance` |
| `short_answer` | Text box | **Self-check:** show the model answer and keywords; she picks "Got it ✅ / Partly 🤏 / Missed ❌" (100 / 50 / 0%). The parent can change the mark later. |
| `think_write` | Larger text box, "think and write" | Self-check like `short_answer`, flagged for the parent to review |

### 8.3 Weekly online tests (Saturday and Sunday)

**Structure of one subject section (15 minutes, 15 marks):**
- 6 objective questions × 1 mark (`mcq`, `true_false`, `fill_blank`, `match`, `order`, `label_diagram`, `numeric`)
- 3 short questions × 2 marks
- 1 think-and-write question × 3 marks

**Choosing the questions (blueprint in Appendix D):**
- 60% from lessons she studied in that subject **since that subject's last weekly test**
- 20% from her **weak topics** (§8.5)
- 20% **spaced review** from older lessons
- Difficulty mix: 40% easy, 40% medium, 20% challenge
- Prefer bank questions she hasn't seen. If a question is reused, shuffle its options.

**Test mode rules:**
- Start screen: "Ready? 3 sections, 15 minutes each. You've got this! 💪" with a big **Start** button.
- **No hints, no videos, no going back to lessons.** Request fullscreen. The bottom navigation is hidden.
- Each section has its own gentle timer (a progress bar, not a scary countdown). In the last 2 minutes the bar turns amber and shows "2 minutes left — check your answers 🙂".
- She can flag ⚑ questions and review them within the same section before submitting.
- When the time runs out, the section saves and submits automatically and the next section starts after a 30-second breather screen.
- The parent PIN can add +5 minutes to a section.
- **One attempt only.** Every answer is saved as she goes, so if the app closes, the test resumes where she left off and the timer continues from what was left.
- **Test windows:** the Saturday Test is open from Sat 15:30 to Sun 20:00, and the Sunday Test from Sun 09:30 to Mon 21:30. A test not taken by then is marked *Missed* (amber). It can still be taken later as *Practice*, which counts for mastery but not for weekly scores.

### 8.4 Results and the correction report

**Subject-wise report card** after every test:
- One row per subject: marks out of 15, percentage, stars and a band:
  - ≥ 90% 🌟 **Superstar**
  - 75–89% 👍 **Great work**
  - 60–74% 💪 **Getting there**
  - < 60% 🌱 **Let's grow this one**
- A trend arrow compared with last week's score for that subject (▲ ▼ ●).
- Confetti if any subject scores 100%.

**Correction report** (the same style as the project's earlier correction reports). For every wrong or partly wrong answer:

| Your answer | Correct answer | Why — and how to get it next time |
|---|---|---|
| "1%" | 10% | To turn a decimal into a percentage, multiply by 100: 0.1 × 100 = 10%. |

Each row has a **"Watch this bit again ▶️"** button that jumps to the matching video timestamp (`question.videoRef`) and a **"Try a similar one 🔁"** button that gives a variant question if one exists.

Mistakes are always described as "here's how to get it next time". Never use words like "wrong", "bad" or "careless" in kid-facing text. Use "Not quite", "Almost!" and "Let's fix this one".

### 8.5 Mastery and weak topics

- Mastery is tracked **per lesson** (one concept), from 0 to 100.
- Mastery = the weighted average of her last 5 marked results on that lesson's questions. Weights: checkpoint 0.5, warm-up recall 0.5, Lesson Check 1, Daily Assignment 1, weekly test 2.
- **Weak** = mastery below 70, or a test score below 60% on that lesson's questions. **Strong** = mastery of 85 or more.
- Weak lessons feed: Saturday and Sunday fix-it sessions, warm-up flashcards in later lessons of the same subject, 20% of the next weekly test, and the revision window (weakest first).

### 8.6 Fix-it sessions (Saturday evening and Sunday 16:30)

1. List the mistakes from that day's test for the subject(s) in the slot.
2. For each mistake: rewatch the matching video moment (≤ 2 minutes) → retry a variant question → mark it fixed ✅ if correct.
3. Badge progress: "Mistake Fixer" (§10).
4. If time is left, continue with the next lesson in that subject's queue. On Sunday, show a preview of next week's topics.

---

## 9. Study plan engine (Day 1 → exam day)

### 9.1 Inputs (from the parent, stored in `content/plan.json`)

- Start date, and **exam date(s)**. Exams can be one date for everything, or a separate date per subject (common in schools).
- The ordered list of chapters per subject. Each chapter file holds its ordered `lessons[]`.
- The number of revision days (default 7, see §9.3).

### 9.2 Queue-based scheduling

- Each subject has an **ordered lesson queue** made of its chapters' lessons in order.
- Each `lesson` or `homework_lesson` slot for that subject takes the **next unfinished lesson** in the queue. A `fixit` slot does its fix-it part first, then takes the next lesson.
- **A missed slot never loses content.** The lesson simply stays at the front of the queue. This is the automatic reshuffle.
- **Coverage forecast** (shown in the parent dashboard and as a gentle note to the kid): compare remaining lessons per subject with the remaining subject slots before the revision window.
  - **On track ✅:** enough slots.
  - **Slightly behind 🟡:** short by 1–2 lessons.
  - **Behind 🟠:** short by 3 or more.
  - When behind, suggest catch-up options to the parent, never to the kid:
    - "double up" in 60-minute slots (two short lessons)
    - use the extra time in a fix-it slot
    - add an optional weekend catch-up slot (the parent approves it in the timetable editor).

### 9.3 Revision window and mock exams

- **Revision window length:** the configured revision days (default 7). If fewer than 21 days remain at setup, use 3 days instead.
- **Inside the revision window:**
  - every `lesson` slot for a subject becomes `revise` for that subject (flashcards + mixed quiz, weakest lessons first)
  - the weekly tests become **subject Mock Exams**, laid out like the real paper using `examPattern` (§13).
- **Separate exam date per subject:** revision for that subject focuses on the days before its exam. The day before its exam is **light revision of that subject only** (key rules + one short quiz), with nothing new.
- **Final weekend before exams:** one full mock paper per subject, following the real exam pattern. The default pattern, matching the earlier practice papers in this project, is:
  - A — Fill in the blanks
  - B — True/False and MCQ
  - C — Match the following
  - D — Short answers
  - E — Long answers
  - F — Think and write.

  Marks per section are configurable per subject.

---

## 10. Rewards and engagement

- **Stars ⭐:**
  - +1 for finishing a lesson
  - +1 for a Lesson Check of 80% or more
  - +1 for answering every checkpoint correctly
  - +2 for finishing the Daily Assignment
  - +5 for finishing each weekly test
  - +1 for each subject scoring 90% or more.
- **Streak 🔥:** a day counts when all of that day's app lessons **and** the Daily Assignment are done (on test days, when the test is done). Offline items and activities never affect the streak. She gets **1 streak shield per week**, used automatically, so one missed day (illness, a function at home) doesn't break the streak.
- **Levels:** every 100 stars is a new level with a fun title (Explorer → Thinker → Scholar → Champion → Legend).
- **Badges:**
  - First Lesson
  - First 100%
  - 5-Day Streak
  - 2-Week Streak
  - Full Week Done
  - Test Taker (first weekly test)
  - Subject Star (90% or more in a subject test)
  - Mistake Fixer (10 mistakes fixed)
  - Video Detective (20 checkpoints right in a row)
  - Chapter Complete (per chapter)
  - All Chapters Covered
  - Revision Hero
  - Mock Exam Master
- **Mascot (optional):** a friendly elephant guide, "Tara 🐘" by default (the name can be changed in settings). Tara gives one short encouraging line on screens such as Today, Results and Badges. **No leaderboards and no comparing her with other children.**
- **Celebrations:** confetti for 100% and badges, and a gentle "pop" for stars. All animations respect `prefers-reduced-motion`. Sound effects are off by default and can be turned on in settings.

---

## 11. Parent area (PIN-protected)

- **Dashboard:**
  - this week's lessons done out of planned
  - streak
  - stars
  - weekly test scores per subject (a line chart over the weeks)
  - average mastery per subject
  - **weak topics list**
  - time spent on screen
  - videos watched
  - the coverage forecast (§9.2) per subject
  - **On track / Needs attention** for the exam date.
- **Test review:** see every test answer. Re-mark `short_answer` and `think_write` questions. Add a comment for the kid ("Super effort! — Amma"), which she sees on her results.
- **Content Manager:**
  - add or edit subjects, chapters, lessons and questions using forms (the forms write to the content override store)
  - add video links with preview, start/end times and checkpoints
  - reorder a subject's queue
  - mark a chapter "taught in school already" (moves it to revision)
  - **Chapter review:** approve chapters imported from her textbooks (§13A). Shows `needsReview` items first, each with its book page number. Buttons: Looks right / Edit / Remove, then Approve chapter.
- **Plan settings:** exam date(s), revision days, test windows, bedtime time, and a **timetable editor** (edit slot times, subjects and kinds, with validation that nothing overlaps).
- **Backup:** export all data and content changes as one JSON file, and import it. A reminder to back up every Sunday.
- **Weekly report:** a printable or shareable summary (print to PDF using the browser, or the Web Share API).

---

## 12. Safety, privacy and wellbeing (non-negotiable)

- **No accounts, no server, no analytics, no tracking, no ads, no in-app purchases.** All progress is stored in IndexedDB on the device and leaves it only through the parent's export file.
- **Videos:**
  - only parent-approved IDs from content files
  - the `youtube-nocookie.com` domain
  - `rel=0`
  - the app's own end-screen overlay (§7.6)
  - no search, comments or outbound links in kid mode
  - external links open only from the parent area.
- **Kind words only:** no shaming copy, no red ✗ floods (use soft amber), and no comparison with others.
- **Wellbeing:**
  - bedtime block (§5.2)
  - eye-break prompts (§7.7)
  - notebook tasks keep some learning off-screen
  - the weekday app time stays inside the existing timetable slots, and the app never adds extra slots by itself.
- **Accessibility:**
  - base font 18 px, with 22 px for questions
  - tap targets of at least 48 px
  - WCAG AA contrast in light and dark themes
  - full keyboard support on laptop
  - visible focus rings
  - captions on by default
  - `prefers-reduced-motion` respected everywhere.

---

## 13. Content model (everything editable lives in `/content`)

```
content/
  subjects.json              # §3 table (Appendix A2)
  timetable.json             # Appendix A — single source of truth for slots
  plan.json                  # exam dates, chapter order, revision days, exam patterns (Appendix D)
  test-blueprint.json        # weekly test rules (Appendix D)
  chapters/
    physics/light.json       # one file per chapter (Appendix B)
    chemistry/matter.json
    ...
  explainers/
    states-of-matter.json    # scene scripts (Appendix C)
  media/
    images/                  # diagrams for label_diagram questions, cards
    videos/                  # optional local MP4s
```

- Content JSON is bundled at build time (`import.meta.glob`). At runtime it is merged with the **parent's overrides** from IndexedDB (written by the Content Manager).
- Everything is validated with Zod when it loads. If an override is invalid, ignore it and show the parent a warning. Never crash the kid's view.
- `npm run validate-content` must check:
  - the schemas
  - that IDs are unique across all content
  - that every `questionId`, `explainerId` and `videoRef` points to something that exists
  - that timetable slots don't overlap and that every slot `subject` exists
  - the video length limits (§7.7)
  - that every lesson has at least 3 `check` questions and a `notebook` task
  - that every chapter's `questionBank` has at least 10 questions with a mix of difficulties
  - for every non-sample chapter: a `status` and `book` are set, and every lesson, card, question and explainer scene has a `source` (page numbers or a notes file) (§13A).

### Core types (TypeScript + Zod; build these exactly, extend only if needed)

```ts
type SubjectId = string; // e.g. "maths" — from subjects.json

type SlotKind = "lesson" | "homework_lesson" | "revise" | "fixit" | "test" | "review"
              | "activity" | "break" | "offline_task";

interface Slot {
  start: string;            // "HH:MM" 24h, Asia/Kolkata
  end: string;
  kind: SlotKind;
  subject?: SubjectId;      // lesson, homework_lesson, revise, fixit (single subject)
  subjects?: SubjectId[];   // test, review, revise, fixit covering several subjects
  testId?: "sat" | "sun";   // for kind "test"
  label?: string;           // shown text, e.g. "Bharatanatyam class"
  focus?: string;           // e.g. "practice", "writing", "numericals & diagrams"
  emoji?: string;
  colour?: string;          // colour token name for non-subject slots, e.g. "dance"
}

interface Source { pages?: number[]; notes?: string }   // book page numbers, or a notes/worksheet file name

interface Chapter {
  id: string; subject: SubjectId; title: string; order: number;
  sample?: boolean;               // true for seed content in this spec
  status: "draft" | "approved";   // only "approved" chapters reach the kid (§13A)
  book?: { title: string; publisher: string; edition?: string; chapterNo?: number };
  sourceDir?: string;             // e.g. "source/physics/04-light"
  parentNotes?: string[];         // gaps, conflicts, suggested video search words
  lessons: Lesson[];              // one lesson ≈ one study slot
  questionBank: Question[];       // used by Daily Assignment, weekly tests, mocks
}

interface Lesson {
  id: string; title: string;
  videos: Video[];                // first item with role "primary" plays first
  warmup?: Flashcard[];
  cards: LearnCard[];             // { title, body, emoji?, image?, example?, didYouKnow?, reveal? }
  practice: Question[];           // must have hints
  notebook: string;               // offline task text
  check: Question[];              // Lesson Check (3–6)
  keyRules: string[];             // keep the book's definitions and wording
  source: Source;                 // pages this lesson covers
}
// LearnCard also carries  source?: Source  (required for non-sample chapters)

type Video =
  | { role: "primary" | "alternate"; kind: "explainer"; explainerId: string }
  | { role: "primary" | "alternate"; kind: "youtube"; youtubeId: string; title: string;
      start?: number; end?: number; checkpoints: Checkpoint[] }
  | { role: "primary" | "alternate"; kind: "mp4"; src: string; title: string;
      checkpoints: Checkpoint[] };

interface Checkpoint { at: number; questionId: string; rewindTo: number }

interface Question {
  id: string;
  type: "mcq" | "true_false" | "fill_blank" | "match" | "order" | "label_diagram"
      | "numeric" | "short_answer" | "think_write";
  prompt: string;
  difficulty: "easy" | "medium" | "challenge";
  marks: number;
  lessonId?: string;              // required inside questionBank (for mastery/weak topics)
  explanation: string;            // the "Why" column of the correction report
  hints?: string[];
  videoRef?: { video: "primary" | "alternate"; at?: number; scene?: number };
  variantOf?: string;             // links "try a similar one" variants
  // type-specific fields:
  options?: string[]; answer?: string | number | boolean | string[];
  accept?: string[]; tolerance?: number; unit?: string;
  pairs?: [string, string][]; sequence?: string[];
  image?: string; hotspots?: { id: string; x: number; y: number; label: string }[];
  modelAnswer?: string; keywords?: string[];
  // where it came from (required for non-sample chapters):
  source?: Source;
  fromBook?: boolean;             // true = exercise question copied from the textbook
  bookRef?: string;               // the book's own numbering, e.g. "Ex. B Q4"
  needsReview?: boolean;          // unclear photo or answer not found → the parent must check
}
```

---

## 13A. Content from her real textbooks (no guessing)

All real lessons, cards, questions and explainers must come from **Avantika's own textbooks and school material**. Claude Code creates this content **on the parent's computer, while building the app**, by reading photos or PDFs of her books. The app itself never calls an AI service (§14).

### What the parent provides

| Material | Why it matters | How to give it |
|---|---|---|
| **Exam portion list** (which chapters are in this exam) | Decides what goes into the study plan | Photo of the school circular, or typed into `source/portions.md` |
| **Textbook chapters** | The actual teaching content | The PDF if the school or publisher provides one, otherwise phone photos of every page |
| **Back-of-chapter exercises** | Teachers often set exam questions from these | Included in the chapter pages |
| **School notebook notes, worksheets, the teacher's question-answers** | Shows what the teacher stressed and the answer wording she expects | Photos |
| **Previous test papers or the school's sample paper** | The real exam pattern and question style (sets `examPattern`) | Photos or PDF |

**Photo tips:** one page per photo, the page lying flat, daylight with no shadows, the whole page in the frame. Name files in page order (`p061.jpg`, `p062.jpg`…).

### Folder layout

```
source/
  books.json                 # which book each subject uses (Appendix F)
  portions.md                # exam portions per subject
  papers/                    # previous papers, sample paper
  physics/
    04-light/
      pages/                 # p061.jpg p062.jpg … or chapter.pdf
      notes/                 # notebook-1.jpg, worksheet-1.jpg
      extract.md             # written by Claude Code in step 1
  chemistry/ …
```

`source/` stays private to the family. If the project is ever pushed to an online repository, add `source/` to `.gitignore`. Host the finished app privately (§14), because it contains material based on her textbooks.

### The import process (one chapter at a time)

The parent tells Claude Code: **"Import `source/physics/04-light` using SPEC §13A and Appendix F."** Claude Code then:

1. **Extracts.** Reads every page and note, and writes `extract.md`: a clean page-by-page transcription of headings, definitions (exact wording), key facts, examples, activities, diagrams (described, with their page numbers) and **all exercise questions** in the book's numbering. Anything it cannot read clearly is marked `[UNCLEAR p.62]`. It tells the parent which pages to photograph again.
2. **Plans the lessons.** Splits the chapter, in book order, into lessons that fit the timetable slots (30, 45 or 60 minutes, §5.4). It shows this plan to the parent and **waits for an OK**.
3. **Writes the chapter file** `content/chapters/physics/04-light.json`, with `status: "draft"`, following the grounding rules below.
4. **Writes explainers** for any difficult concepts from §7.5 that appear in the chapter, using the book's own examples and diagrams.
5. **Validates.** Runs `validate-content`, including the source checks, and fixes any problems.
6. **Reports:** number of lessons, number of questions (book vs new), items marked `needsReview`, unclear pages, and `parentNotes`.
7. **The parent reviews and approves** in the app (Parent → Chapter review, §11). Only approved chapters appear on Avantika's trail.

Import chapters **at least a week before** the timetable reaches them. The planner warns the parent if a chapter scheduled in the next 7 days is still a draft or missing.

### Grounding rules (cannot be skipped)

- **Teach only what is on the provided pages and notes.** Do not add facts, topics, examples, numbers or dates from general knowledge. If something important seems to be missing, write it in `parentNotes`, never in the lessons.
- **Use the book's own terms and spellings.** For example, if the book says "rectilinear propagation", teach that exact term. Kid-friendly explanations go around the book's words; they never replace them.
- **Definitions stay in the book's wording.** Use the exact or near-exact words in definition cards and `keyRules`, because exam answers are marked against them.
- **Every item records its source.** Every card, question, key rule and explainer scene has `source.pages`. Items taken from notebooks or worksheets have `source.notes` (the file name).
- **Every book exercise question goes into `questionBank`**, with `fromBook: true` and the book's numbering in `bookRef`. Answers come from the chapter pages or the teacher's notes. If the answer can't be found there, set `needsReview: true` and give a draft answer for the parent to check.
- **If the teacher's notes and the book disagree,** use the teacher's version for answers, since that is how she will be marked, and record the difference in `parentNotes`.
- **Extra practice questions** (beyond the book's) are allowed only if they test facts on the given pages. Mark them `fromBook: false`.
- **Never guess** a number, date, name or spelling from an unclear photo. Mark it `needsReview: true`.
- **Diagrams:** for `label_diagram` questions, crop the diagram from a clear page photo into `content/media/images/`. If the photo isn't clear enough, redraw a simple SVG that uses the book's labels.
- **Videos:** Claude Code does not choose YouTube videos. It suggests search words for each lesson in `parentNotes` (e.g. "rectilinear propagation of light class 6"). The parent finds, previews and approves videos in the Content Manager.

### Draft and approved

- A chapter is `draft` after import and becomes `approved` after the parent reviews it. Avantika's app shows **approved chapters only**. Draft chapters count as "not ready" in the coverage forecast (§9.2).
- **Parent → Chapter review** lists every card and question with its page number, with `needsReview` items first. Each item has three buttons: **Looks right ✅**, **Edit ✏️** and **Remove 🗑️**. **Approve chapter** becomes available once no `needsReview` items are left.
- Edits the parent makes in the app are saved as content overrides on the device. They are also included in the backup export, so Claude Code can merge them back into the chapter files.

---

## 14. Tech stack and architecture

| Concern | Choice |
|---|---|
| App | **Vite + React + TypeScript** (strict mode) |
| Styling | Tailwind CSS, with design tokens as CSS variables (subject colours, light and dark) |
| Routing / state | React Router · Zustand |
| Storage | **Dexie (IndexedDB)**. This is a standalone app, not a Claude artifact, so browser storage is correct here. |
| Validation | Zod |
| Animation | Framer Motion + SVG (explainers, celebrations) |
| Drag and drop | @dnd-kit (touch-friendly) |
| Dates | date-fns + date-fns-tz, fixed to `Asia/Kolkata` |
| Charts (parent) | Recharts |
| Offline / install | vite-plugin-pwa (precache the app, content, fonts and local media) |
| Fonts | `@fontsource/fredoka` (headings), `@fontsource/nunito` (body). Bundled so they work offline. |
| Tests | Vitest + React Testing Library · Playwright (end-to-end) |
| Quality | ESLint + Prettier, run `validate-content` before every commit |

**Commands:** `npm run dev` · `npm test` · `npm run e2e` · `npm run validate-content` · `npm run build` · `npm run preview`

**Folder map:**
```
src/
  engine/        # PURE, fully unit-tested logic — no React, no DOM
    clock.ts           # injectable Clock; dev-only ?now=2026-11-02T16:20 override
    timetable.ts       # slots for a date, now/next, catch-up state, bedtime
    queue.ts           # subject lesson queues
    planner.ts         # coverage forecast, revision window, exam-mode transforms
    lessonTemplate.ts  # slot minutes → lesson template (§5.4)
    grading.ts         # every question type, partial marks, tolerance
    mastery.ts         # §8.5
    testBuilder.ts     # blueprint → seeded, deterministic question selection
    rewards.ts         # stars, streak + shield, levels, badges
  content/       # loaders, Zod schemas, override merge
  db/            # Dexie schema + repositories
  explainers/    # engine + visuals/ registry
  features/      # today, week, lesson, video, test, results, progress, revise, parent
  components/    # shared UI (BigButton, SubjectChip, ProgressRing, Confetti...)
  styles/        # tokens.css
content/         # §13
docs/            # SPEC.md, DECISIONS.md
tests/e2e/       # Playwright
```

**Dexie tables:**
- `slotLog` — date, slot index, status
- `lessonProgress` — lessonId, status, current step, timestamps
- `attempts` — source, lessonId, questionId, response, score, time
- `tests` — testId such as `2026-W45-sat`, status, sections, answers, remaining seconds, results
- `mastery`
- `rewards` — stars, level, badges, streak, shields
- `settings`
- `contentOverrides`

### Backend: none in version 1

- The app is a **static web app with no server**. Her progress is stored in IndexedDB on the tablet, and the content files are built into the app. There are no accounts, no AI calls while she uses it, no running costs, and her data never leaves the device. It works offline.
- **AI is used only at build time:** Claude Code reads the book photos and writes the content files on the parent's computer (§13A).
- **Adding new chapters:** import → approve → rebuild and redeploy. The installed app picks up the update the next time it opens (show a friendly "New lessons are ready! 🎉" prompt). Her progress is not affected.
- **Hosting:** keep it private. Either run `npm run preview` on the home network, or use a static host that offers password protection or a private link. Install it as a PWA on the tablet. Do not put it on a public website, because the content is based on her textbooks.

### Optional backend later (Phase 8, only if the family needs it)

| Need | What would be added |
|---|---|
| The parent sees her progress on their own phone | A sync service with a family login (for example Supabase or Firebase) |
| Importing chapters inside the app by taking photos, without Claude Code | A small server function that calls the Claude API. The API key stays on the server, never inside the app, and each import has a cost. |
| More than one child or device | Accounts plus sync |

Build for this possibility now: all storage goes through the `src/db` repositories, so a sync layer can be added later without changing any feature code.

---

## 15. Screens, theme and navigation

### 15.0 Name and branding

- **App name:** **Avantika’s Adventure**. Use it in the page title, the PWA install name, the splash screen and the parent's weekly report.
- **PWA manifest:**
  - `name`: "Avantika’s Adventure"
  - `short_name`: "Adventure" (fits under the tablet icon)
  - `theme_color`: the current world's `--go` colour
  - `background_color`: `--sky2`
- **App icon:** Tara's face on a round stepping stone in Physics purple, with the gold ✓ badge. Provide 192 px and 512 px PNG versions plus a maskable icon. The browser-tab icon (favicon) is 🐘.
- **Splash and first launch:** Tara waves and says "Welcome to your adventure, Avantika! 🗺️" Then the parent sets the PIN and chooses a world.
- **Wording:** the whole experience is "her adventure". Today's screen is still "Today’s trail", finished weeks are "chapters of your adventure", and the end of the exams is "Adventure complete! 🏆".

A working, tappable prototype of this theme exists. **Match it closely.** Save a copy as `docs/theme-prototype.html` and treat it as the visual reference. Port its look into React components. Do not copy its single-file code structure.

### 15.1 Kid screens and the bottom tab bar

There are **four tabs**, always visible except inside a lesson or test. Each tab has a big emoji and a word under it, and is at least 68 px tall. The active tab gets a tinted pill and a slightly bigger emoji.

| Tab | Route | What it shows |
|---|---|---|
| 🗺️ Today | `/` | Tara's greeting, streak/stars/exam chips, the **Up now** card with a big Start button, and **Today's trail** (§15.3) |
| 📅 Week | `/week` | 7 day bubbles (Mon–Sun), each with coloured dots for that day's subjects. Tap a day to see its slots as big rows. |
| 🏆 Rewards | `/progress` | A level medal with a progress bar to the next level, the streak row (last 7 days with 🔥), and a **sticker book** of badges (locked badges show as grey 🔒 stickers) |
| 😊 Me | `/me` | Pick your world (theme), night colours (Auto/Day/Night), text size (Big/Bigger), sounds (Off/On) |

These screens open from the tabs and hide the tab bar: `/lesson/:date/:slot`, `/test/:testId`, `/results/:id`, `/revise/:subject`. The parent area is `/parent` (PIN) → dashboard, tests, content, plan, timetable, backup (§11). The parent area uses a calmer, plain version of the same tokens.

### 15.2 Navigation rules (keep it easy for a child)

1. **Two taps at most** from opening the app to starting the current lesson: open → **Start** on the Up now card, or tap the glowing stone.
2. **One big action per screen**, always the chunky green "go" button at the bottom of the content. Secondary actions use the soft button style.
3. **Focus mode inside lessons and tests:** the tab bar disappears. At the top there is a big ✕ button (56 px) that asks "Leave the lesson? Your progress is saved." with **Keep going** as the default choice.
4. **The step caterpillar** at the top of a lesson always shows where she is: 🎬 Watch · 🃏 Learn · ✋ Try · ✅ Check · ⭐ Stars. Finished steps turn gold with ✓, the current step is filled in the subject colour, and later steps are white.
5. **Feedback slides up from the bottom** (a bottom sheet). It is green for "Yes! ⭐ Spot on!" and soft amber for "Almost! Here's a clue 💡", and has one big button (Continue / Try again). The sheet never covers the question while she is choosing an answer.
6. **No hidden navigation:** no hamburger menus, no swipe-only actions, no long-press, no icons without a word next to them.
7. **Tapping a stone that isn't ready** shows a friendly sheet ("Maths starts at 4:15. Finish the glowing stone first!") instead of doing nothing.
8. **Never more than about 5 choices on one screen.** Week rows and badges are big cards, not dense lists.

### 15.3 The signature element: Today's trail

- Today's slots appear as **stepping stones on a winding path**, zig-zagging left and right (offsets 50% → 74% → 50% → 26%, repeating).
- The path is drawn as an SVG curve through the stone centres, in two layers: a wide soft "ground" stroke, plus a **dotted line in a kolam style** (round line caps, dasharray `0 17`). This dotted motif is the theme's signature. Use it again as a light decoration on empty states and certificates.
- **Stone states:**
  - **Done:** filled in the subject colour, with a gold ✓ badge.
  - **Now:** larger (104 px), with a white ring, a gentle pulsing halo and a green "Start here!" tag above it.
  - **Later:** a white stone with a dashed border in the subject colour.
- Each stone shows the subject emoji, with the subject name and time underneath.
- Dance, tuition and badminton appear as **rest stops**: pill-shaped markers on the path with an emoji, a label and a time, bordered in the activity colour.
- When a lesson is finished, its stone turns to done and the next stone starts glowing straight away.

### 15.4 Worlds (themes she chooses)

| World | Feel | Sky | "Go" button | Decoration |
|---|---|---|---|---|
| 🌻 **Meadow** (default) | Sunny, light | `#bfe7ff` → `#f1fbff` | Green `#1f9d55` (dark edge `#137a3f`), white text | Sun and soft clouds |
| 🐠 **Ocean** | Fresh, light | `#86e0ef` → `#eafcff` | Pink `#e8436f` (dark edge `#bd2853`), white text | Bubbles and a wave line |
| 🚀 **Space** | Cosy, dark | `#151038` → `#2b2168` | Yellow `#ffc93c` (dark edge `#d9a000`), dark text `#2a1d00` | Tiny stars and a ringed planet |

- **Night colours:** Auto follows the device. Day and Night force a choice. In night mode, Meadow and Ocean switch to deep-indigo surfaces. Space is always dark.
- The chosen world, night setting, text size and sound setting are saved on the device.
- **Subject colours (§3) never change between worlds**, so Physics is always purple.

### 15.5 Design tokens (`src/styles/tokens.css`)

- **Per world:**
  - `--sky1`, `--sky2`, `--surface`, `--surface2`, `--ink`, `--ink-soft`, `--line`
  - `--ledge` (the "3D" bottom edge colour)
  - `--go`, `--go-d`, `--on-go`
  - `--trail`, `--trail-bg`, `--tab-on`
  - `--ok-bg`, `--ok-ink`, `--hint-bg`, `--hint-ink`
  - `--deco`, `--deco2`
  - `--tara`, `--tara-ear`
- **Shared:**
  - subject colours, each with a darker `-d` edge (e.g. `--physics:#7a5af8; --physics-d:#5536d1`)
  - activity colours
  - `--gold:#ffc83d; --gold-d:#d99e00` for stars, ticks and medals.
- **Text on subject colours:** use white, except Chemistry and Geography, which need dark text (`#08343a`) to stay readable.

### 15.6 Building blocks (components)

- **ChunkyButton:** at least 60 px tall, 20 px corners, solid `--go` fill with a 6 px solid bottom edge in `--go-d` (no blurry shadows). When pressed it moves down 5 px and the edge shrinks, so it feels like pressing a real button. There is a `soft` variant, and a disabled state at 45% opacity.
- **Card:** `--surface`, 26 px corners, 6 px solid bottom ledge in `--ledge`. **No grey drop shadows anywhere.** The flat "ledge" is part of the look.
- **Stone, RestStop, Chip, TabBar, Caterpillar, OptionButton, BottomSheet, StickerBadge, LevelMedal, WorldPicker, SegmentedControl, VideoFrame.** Their sizes and states are shown in the prototype.
  - **OptionButton:** at least 64 px tall, with a letter key (A/B/C/D) in a rounded square, a 3 px border, and the subject colour when selected.
- **Corner sizes by role:** stones are circles, cards 26 px, buttons 20 px, options 20 px, chips fully rounded, small keys 12 px.

### 15.7 Type, size and spacing

- **Fredoka** (500/600) for headings, buttons, tab labels, stone names and numbers.
- **Nunito** (700/800) for body text.
- Base size 18 px, with a "Bigger" setting of 20 px. Everything is in `rem`, so the setting scales the whole app.
- Questions are about 1.35 rem, Today's greeting about 1.45 rem.
- Lines stay under about 60 characters on tablets. Content width is at most 560 px, centred.

### 15.8 Tara the mascot

- A round, friendly elephant with pink inner ears, rosy cheeks and a small white jasmine flower (a nod to Bharatanatyam).
- Drawn as an inline SVG symbol that uses `--tara` and `--tara-ear`, so it fits every world.
- **Where Tara appears:**
  - Today: in a speech bubble with the greeting and today's progress
  - Results: cheering
  - empty states
  - the bedtime screen.
- One short line at a time. Tara never scolds.

### 15.9 Joy and feedback

- **Star pop:** a ⭐ rises and fades when she answers correctly on the first try.
- **Confetti:** for a 100% score, new badges and finishing a test.
- **Sounds:** an optional two-note chime, **off by default**.
- **Vibration:** an optional short buzz on correct answers (mobile only).
- **Motion she didn't trigger** is limited to the pulsing halo on the Now stone.
- With the device's reduce-motion setting on, all animation stops: no pulse, no confetti, and the video steps through still frames.

### 15.10 Kid-facing text

Short sentences, talking to her as "you", warm and specific, using the copy in Appendix E. Buttons say exactly what they do ("Check my answer", "Next: learn cards", "Back to my trail"). Never use words like "wrong", "fail" or "hurry".

---

## 16. Build phases (stop and report after each one)

| Phase | Build | Done when (acceptance criteria) |
|---|---|---|
| **0 — Foundation** | Scaffold, tooling, `CLAUDE.md`, `docs/DECISIONS.md`, `/content` with the Appendix A–D samples, Zod schemas, `validate-content`, design tokens for all three worlds (§15.4–15.5), fonts, Clock, empty routes, `docs/theme-prototype.html` saved | `validate-content` passes on the samples and gives a clear error for a deliberately broken file. `npm test` runs. A placeholder Today screen shows in light and dark mode. |
| **C — Textbook import (repeat for each chapter)** | Can start once Phase 0 is done. Import pipeline from §13A: `extract.md` → lesson plan (wait for the parent's OK) → chapter JSON with sources → explainers → validation → report. Before Phase 6 is ready, the parent approves by setting `status` to `approved` in the file; after Phase 6, approval happens in the Chapter review screen. | Importing one real chapter produces `extract.md` and a chapter file in which every item has page sources. All book exercise questions are present with `bookRef`. Nothing appears that isn't in the pages (spot-checked by the parent). `validate-content` passes. The chapter stays hidden from the kid until approved. |
| **1 — Timetable & Today** | Timetable engine, Today (now/next/timeline), Week view, tick-offs, catch-up state, bedtime block, future-day lock | Unit tests cover slot boundaries (Mon 18:29 vs 18:30, Sun 10:30). With the fake clock at Tue 17:20, the Now card shows Tuition. The Week view matches Appendix A exactly. |
| **2 — Lessons & videos** | Lesson flow (§6), templates (§5.4), homework-first flow, explainer engine + `ParticleBox`, `LightRay`, `NumberLine`, YouTube/MP4 player with checkpoints, end overlay and fallbacks, all question types, feedback + correction report, autosave/resume | The sample Physics lesson can be completed from start to finish. A checkpoint pauses at the right second. Two wrong answers let her continue. When offline, the explainer fallback plays. Reloading mid-lesson resumes at the same step. |
| **3 — Daily Assignment & rewards** | Daily Assignment in the final lesson, mastery, stars, streak with shield, levels, badges, Progress screen | Unit tests cover streak (shield, test days) and mastery weights. The Daily Assignment takes 2–3 questions from each lesson done today. |
| **4 — Weekly online tests** | Test builder (Appendix D), Saturday and Sunday tests, test-mode rules, windows, missed/practice, timer resume, report card, correction report with video jumps, fix-it sessions | The same seed always produces the same test. Sections auto-submit. Reloading keeps the remaining time. Saturday's English fix-it lists exactly that day's English mistakes. |
| **5 — Study plan** | `plan.json`, queue scheduling, coverage forecast, revision window, per-subject exam dates, mock exams, "taught already" chapters | Unit tests show: a missed slot keeps its lesson at the front of the queue; the forecast states are correct; the revision window changes the slots; the day before an exam is light revision of that subject only. |
| **6 — Parent area** | PIN, dashboard, test review and re-marking, Content Manager (including adding videos with preview), plan settings, timetable editor with overlap checks, backup, weekly report | Editing a slot time in the timetable editor changes the Today screen. Export → wipe → import restores exactly the same state. |
| **7 — Polish & PWA** | Remaining visuals from §7.5 as the real content needs them, PWA offline/install, accessibility pass, mascot, sound toggle, performance | Installs as a PWA. Lessons, explainers and tests work offline. Automated accessibility checks (axe) show no serious issues. Tested at 768×1024 (tablet) and 390×844 (phone). All three worlds, plus night mode, pass contrast checks and look like the prototype. |

---

## 17. Testing requirements

- `src/engine/*` needs **at least 90% line coverage**. These modules are pure functions, so test them directly with an injected Clock.
- Grading needs a unit test for every question type, including partial marks, `accept[]` alternatives, numeric `tolerance` and units.
- Playwright end-to-end flows (with the fake clock):
  1. Today → lesson → Lesson Check → stars
  2. Final lesson → Daily Assignment → streak goes up
  3. A full Saturday Test → report card → fix-it
  4. The parent edits the timetable, and Today updates
  5. Offline lesson with explainer fallback
  6. Resume a test after reload.
- `validate-content` runs in the test suite, so broken content fails the build.

---

## 18. Open questions for the parent (needed before Phase 5 and before adding real content)

1. Exam date(s): one date for all subjects, or the date of each subject's exam?
2. Board and textbooks (ICSE / CBSE / State board), plus the publisher for each subject.
3. The ordered chapter list for each subject, and which chapters are already taught in school.
4. Device(s): tablet, laptop or phone? Which browser?
5. Preferred video sources, and any channels to avoid.
6. Mascot name, and narration voice on or off by default.
7. Should Hindi and Kannada become app subjects later?
8. The parent PIN (set on first launch).
9. For each subject: the textbook's title, publisher and edition (`source/books.json`), and photos or PDFs of the chapters in the exam portion, plus any notebook notes, worksheets and previous papers (§13A).

---

## Appendix A — `content/timetable.json` (complete; single source of truth)

```json
{
  "timezone": "Asia/Kolkata",
  "bedtime": { "schoolNights": "21:45", "weekendNights": "22:15" },
  "schoolNights": ["sun", "mon", "tue", "wed", "thu"],
  "days": {
    "mon": [
      { "start": "15:30", "end": "16:15", "kind": "break", "label": "Reach home • snack & rest", "emoji": "🍎" },
      { "start": "16:15", "end": "17:15", "kind": "homework_lesson", "subject": "maths", "focus": "homework + practice" },
      { "start": "17:15", "end": "17:30", "kind": "break", "label": "Short break", "emoji": "☕" },
      { "start": "17:30", "end": "18:15", "kind": "lesson", "subject": "physics" },
      { "start": "18:15", "end": "18:30", "kind": "break", "label": "Get ready for dance", "emoji": "🎒" },
      { "start": "18:30", "end": "19:30", "kind": "activity", "label": "Bharatanatyam class", "emoji": "💃", "colour": "dance" },
      { "start": "19:30", "end": "20:15", "kind": "break", "label": "Dinner & rest", "emoji": "🍽️" },
      { "start": "20:15", "end": "21:00", "kind": "lesson", "subject": "english", "focus": "reading & grammar" },
      { "start": "21:00", "end": "21:30", "kind": "lesson", "subject": "geography" }
    ],
    "tue": [
      { "start": "15:30", "end": "16:15", "kind": "break", "label": "Snack & rest", "emoji": "🍎" },
      { "start": "16:15", "end": "17:00", "kind": "homework_lesson", "subject": "maths", "focus": "homework" },
      { "start": "17:00", "end": "18:00", "kind": "activity", "label": "Tuition — Hindi & Kannada", "emoji": "🧑‍🏫", "colour": "tuition" },
      { "start": "18:00", "end": "18:30", "kind": "break", "label": "Break & snack", "emoji": "☕" },
      { "start": "18:30", "end": "19:30", "kind": "lesson", "subject": "history" },
      { "start": "19:30", "end": "20:00", "kind": "break", "label": "Free play time", "emoji": "🎨" },
      { "start": "20:00", "end": "20:30", "kind": "break", "label": "Dinner", "emoji": "🍽️" },
      { "start": "20:30", "end": "21:00", "kind": "lesson", "subject": "biology" },
      { "start": "21:00", "end": "21:30", "kind": "offline_task", "label": "Hindi / Kannada tuition homework", "emoji": "✍️", "colour": "lang" }
    ],
    "wed": [
      { "start": "15:30", "end": "16:15", "kind": "break", "label": "Snack & rest", "emoji": "🍎" },
      { "start": "16:15", "end": "17:15", "kind": "lesson", "subject": "maths", "focus": "practice sums" },
      { "start": "17:15", "end": "17:30", "kind": "break", "label": "Short break", "emoji": "☕" },
      { "start": "17:30", "end": "18:15", "kind": "lesson", "subject": "chemistry" },
      { "start": "18:15", "end": "18:30", "kind": "break", "label": "Get ready for dance", "emoji": "🎒" },
      { "start": "18:30", "end": "19:30", "kind": "activity", "label": "Bharatanatyam class", "emoji": "💃", "colour": "dance" },
      { "start": "19:30", "end": "20:15", "kind": "break", "label": "Dinner & rest", "emoji": "🍽️" },
      { "start": "20:15", "end": "21:00", "kind": "lesson", "subject": "biology" },
      { "start": "21:00", "end": "21:30", "kind": "revise", "subject": "history" }
    ],
    "thu": [
      { "start": "15:30", "end": "16:15", "kind": "break", "label": "Snack & rest", "emoji": "🍎" },
      { "start": "16:15", "end": "17:00", "kind": "lesson", "subject": "physics" },
      { "start": "17:00", "end": "18:00", "kind": "activity", "label": "Tuition — Hindi & Kannada", "emoji": "🧑‍🏫", "colour": "tuition" },
      { "start": "18:00", "end": "18:30", "kind": "break", "label": "Break", "emoji": "☕" },
      { "start": "18:30", "end": "19:30", "kind": "lesson", "subject": "maths", "focus": "practice" },
      { "start": "19:30", "end": "20:00", "kind": "break", "label": "Free time", "emoji": "🎨" },
      { "start": "20:00", "end": "20:30", "kind": "break", "label": "Dinner", "emoji": "🍽️" },
      { "start": "20:30", "end": "21:00", "kind": "lesson", "subject": "geography", "focus": "maps & revision" },
      { "start": "21:00", "end": "21:30", "kind": "offline_task", "label": "Hindi / Kannada tuition homework", "emoji": "✍️", "colour": "lang" }
    ],
    "fri": [
      { "start": "15:30", "end": "16:15", "kind": "break", "label": "Snack & rest", "emoji": "🍎" },
      { "start": "16:15", "end": "17:00", "kind": "lesson", "subject": "english", "focus": "writing" },
      { "start": "17:00", "end": "18:00", "kind": "activity", "label": "Tuition — Hindi & Kannada", "emoji": "🧑‍🏫", "colour": "tuition" },
      { "start": "18:00", "end": "18:30", "kind": "break", "label": "Break", "emoji": "☕" },
      { "start": "18:30", "end": "19:15", "kind": "lesson", "subject": "chemistry" },
      { "start": "19:15", "end": "20:30", "kind": "break", "label": "Family & free time + dinner", "emoji": "🎉" },
      { "start": "20:30", "end": "21:30", "kind": "lesson", "subject": "physics", "focus": "numericals & diagrams" }
    ],
    "sat": [
      { "start": "09:00", "end": "10:00", "kind": "lesson", "subject": "maths", "focus": "practice & revision" },
      { "start": "10:00", "end": "10:15", "kind": "break", "label": "Short break", "emoji": "☕" },
      { "start": "10:15", "end": "11:00", "kind": "lesson", "subject": "chemistry" },
      { "start": "11:00", "end": "11:45", "kind": "lesson", "subject": "biology", "focus": "diagrams & terms" },
      { "start": "11:45", "end": "15:30", "kind": "break", "label": "Lunch, rest & play", "emoji": "🛌" },
      { "start": "15:30", "end": "16:15", "kind": "test", "testId": "sat", "subjects": ["english", "history", "geography"], "label": "Saturday Test", "emoji": "🖥️" },
      { "start": "16:15", "end": "16:30", "kind": "break", "label": "Breather", "emoji": "🧃" },
      { "start": "16:30", "end": "17:15", "kind": "fixit", "subject": "english" },
      { "start": "17:15", "end": "18:00", "kind": "fixit", "subject": "geography" },
      { "start": "18:00", "end": "18:15", "kind": "break", "label": "Short break", "emoji": "☕" },
      { "start": "18:15", "end": "19:00", "kind": "fixit", "subject": "history" }
    ],
    "sun": [
      { "start": "09:00", "end": "09:30", "kind": "revise", "subjects": ["maths", "physics", "chemistry", "biology"], "label": "Quick revision before the test", "emoji": "🔁" },
      { "start": "09:30", "end": "10:30", "kind": "test", "testId": "sun", "subjects": ["maths", "physics", "chemistry", "biology"], "label": "Sunday Test", "emoji": "🖥️" },
      { "start": "10:30", "end": "11:00", "kind": "review", "subjects": ["maths", "physics", "chemistry", "biology"], "label": "Results + get ready", "emoji": "✅" },
      { "start": "11:00", "end": "12:00", "kind": "activity", "label": "Badminton class", "emoji": "🏸", "colour": "sport" },
      { "start": "12:00", "end": "16:30", "kind": "break", "label": "Lunch, rest, hobby & family time", "emoji": "🌈" },
      { "start": "16:30", "end": "17:15", "kind": "fixit", "subjects": ["maths", "physics", "chemistry", "biology"], "label": "Fix-it + next week preview", "emoji": "💡" }
    ]
  }
}
```

**Check (each subject's weekly sessions):** Maths 5 · Physics 3 · Chemistry 3 · Biology 3 · English 3 · History/Civics 3 · Geography 3. Plus 2 online tests (Saturday and Sunday) and 2 fix-it blocks. The validator should assert these counts for the default timetable.

### Appendix A2 — `content/subjects.json`

```json
[
  { "id": "maths", "name": "Maths", "emoji": "📘", "colour": "#3f7bf6" },
  { "id": "physics", "name": "Physics", "emoji": "⚡", "colour": "#7a5af8" },
  { "id": "chemistry", "name": "Chemistry", "emoji": "🧪", "colour": "#14b8a6" },
  { "id": "biology", "name": "Biology", "emoji": "🌿", "colour": "#43a047" },
  { "id": "english", "name": "English", "emoji": "📖", "colour": "#f0643c" },
  { "id": "history", "name": "History / Civics", "emoji": "🏛️", "colour": "#b45309" },
  { "id": "geography", "name": "Geography", "emoji": "🌏", "colour": "#0ea5e9" }
]
```

---

## Appendix B — SAMPLE chapter file `content/chapters/physics/light.json`

This sample shows the expected shape and the level of detail. Real chapters come from the parent's syllabus.

```json
{
  "id": "phy-light",
  "subject": "physics",
  "title": "Light",
  "order": 4,
  "sample": true,
  "status": "approved",
  "lessons": [
    {
      "id": "phy-light-1",
      "title": "Light travels in a straight line",
      "videos": [
        { "role": "primary", "kind": "explainer", "explainerId": "light-straight-line" },
        { "role": "alternate", "kind": "youtube", "youtubeId": "REPLACE_ME", "title": "Rectilinear propagation of light", "start": 0, "end": 300,
          "checkpoints": [ { "at": 120, "questionId": "phy-light-1-cp1", "rewindTo": 80 } ] }
      ],
      "warmup": [
        { "front": "Name one natural source of light.", "back": "The Sun ☀️ (also fireflies, stars)." }
      ],
      "cards": [
        { "title": "Light goes straight!", "emoji": "🔦", "body": "Light always travels in a straight line. That's why a torch makes a straight beam." },
        { "title": "Why can't we see around corners?", "emoji": "🧱", "body": "Light from things behind a corner can't bend around it to reach our eyes.", "reveal": "Because light travels in straight lines!" },
        { "title": "Transparent, translucent, opaque", "emoji": "🪟", "body": "Transparent lets almost all light through (clear glass). Translucent lets some through (butter paper). Opaque lets none through (wood).",
          "didYouKnow": "Your hand looks red when you hold a torch behind it because a little light passes through thin skin!" },
        { "title": "Shadows", "emoji": "🌑", "body": "A shadow forms when an opaque object blocks light. Shadows need a light source, an opaque object and a screen." }
      ],
      "practice": [
        { "id": "phy-light-1-p1", "type": "match", "prompt": "Match each material to its type.", "difficulty": "easy", "marks": 3,
          "pairs": [["Clear glass", "Transparent"], ["Butter paper", "Translucent"], ["Wooden door", "Opaque"]],
          "hints": ["Ask: does light pass fully, partly, or not at all?"],
          "explanation": "Clear glass lets almost all light through, butter paper lets some through, and wood blocks it completely." }
      ],
      "notebook": "Draw a torch, a ball and a wall in your notebook. Show the straight light rays and the shadow on the wall.",
      "check": [
        { "id": "phy-light-1-c1", "type": "fill_blank", "prompt": "Light travels in a ____ line.", "difficulty": "easy", "marks": 1,
          "answer": "straight", "explanation": "Light always travels in straight lines — that's called rectilinear propagation." },
        { "id": "phy-light-1-c2", "type": "true_false", "prompt": "A shadow is formed when an opaque object blocks light.", "difficulty": "easy", "marks": 1,
          "answer": true, "explanation": "Opaque objects stop light completely, so a dark area — the shadow — forms behind them.", "videoRef": { "video": "primary", "scene": 3 } },
        { "id": "phy-light-1-c3", "type": "short_answer", "prompt": "Why can't we see an object hidden around a corner?", "difficulty": "medium", "marks": 2,
          "modelAnswer": "Light travels in straight lines, so light from the object cannot bend around the corner to reach our eyes.",
          "keywords": ["straight line", "cannot bend", "reach our eyes"],
          "explanation": "Remember: no light reaching your eyes = you can't see it." }
      ],
      "keyRules": [
        "Light travels in straight lines.",
        "Transparent = all light passes · Translucent = some · Opaque = none.",
        "Shadow = light source + opaque object + screen."
      ]
    }
  ],
  "questionBank": [
    { "id": "phy-light-1-cp1", "lessonId": "phy-light-1", "type": "mcq", "prompt": "Which of these is opaque?", "difficulty": "easy", "marks": 1,
      "options": ["Clear glass", "Butter paper", "A book", "Clean water"], "answer": "A book",
      "explanation": "A book blocks all light, so it is opaque." },
    { "id": "phy-light-1-q1", "lessonId": "phy-light-1", "type": "mcq", "prompt": "The image formed in a pinhole camera is:", "difficulty": "medium", "marks": 1,
      "options": ["Upright", "Upside down (inverted)", "Coloured differently", "Not formed at all"], "answer": "Upside down (inverted)",
      "explanation": "Rays from the top of the object go through the tiny hole in a straight line and land at the bottom, so the image is inverted." },
    { "id": "phy-light-1-q2", "lessonId": "phy-light-1", "type": "think_write", "prompt": "Your shadow is long in the evening and short at noon. Why?", "difficulty": "challenge", "marks": 3,
      "modelAnswer": "At noon the Sun is high overhead, so light falls almost straight down and the shadow is short. In the evening the Sun is low, so light comes from the side and the shadow stretches long.",
      "keywords": ["Sun high", "Sun low", "angle of light"],
      "explanation": "The lower the light source, the longer the shadow." }
  ]
}
```

Note: the real `questionBank` needs at least 10 questions per chapter (§13). This sample is shortened.

---

## Appendix C — SAMPLE explainer `content/explainers/states-of-matter.json`

```json
{
  "id": "states-of-matter",
  "subject": "chemistry",
  "title": "Solids, liquids and gases — what are particles doing?",
  "sample": true,
  "scenes": [
    { "visual": "ParticleBox", "props": { "state": "solid", "temperature": 0 }, "minDuration": 8,
      "narration": "Everything around you is made of tiny particles. In a solid, like ice, the particles are packed tightly and can only wiggle in place. That's why a solid keeps its shape." },
    { "visual": "ParticleBox", "props": { "state": "solid", "temperature": 0 },
      "steps": [ { "at": 0, "props": { "temperature": 40, "state": "liquid" } } ], "minDuration": 10,
      "narration": "Now let's heat it. The particles get energy, move faster and start sliding past each other. The ice melts into water — a liquid. A liquid flows and takes the shape of its container." },
    { "visual": "ParticleBox", "props": { "state": "liquid", "temperature": 40 },
      "steps": [ { "at": 0, "props": { "temperature": 100, "state": "gas" } } ], "minDuration": 10,
      "narration": "Heat it even more and the particles zoom around freely, far apart from each other. The water boils and becomes steam — a gas. A gas spreads out to fill any space.",
      "checkpoint": { "questionId": "sm-cp1" } },
    { "visual": "ParticleBox", "props": { "state": "gas", "temperature": 100 },
      "steps": [ { "at": 0, "props": { "temperature": 20, "state": "liquid" } } ], "minDuration": 8,
      "narration": "Cool the steam down and the particles slow down and come closer again. Steam turns back into water drops. This is called condensation — like water drops on a cold glass!" }
  ],
  "questions": [
    { "id": "sm-cp1", "type": "mcq", "prompt": "In which state are the particles farthest apart?", "difficulty": "easy", "marks": 1,
      "options": ["Solid", "Liquid", "Gas"], "answer": "Gas",
      "explanation": "Gas particles move freely and spread far apart — that's why gases fill any space." }
  ]
}
```

The explainer `light-straight-line` that Appendix B uses follows the same shape with the `LightRay` visual. Build it in Phase 2, with scenes for: torch beam, the corner problem, transparent/translucent/opaque, shadow formation, and the pinhole camera.

---

## Appendix D — `content/plan.json` and `content/test-blueprint.json` (SAMPLE values)

```json
{
  "startDate": "2026-11-02",
  "exams": {
    "mode": "per_subject",
    "dates": {
      "maths": "REPLACE_ME", "physics": "REPLACE_ME", "chemistry": "REPLACE_ME", "biology": "REPLACE_ME",
      "english": "REPLACE_ME", "history": "REPLACE_ME", "geography": "REPLACE_ME"
    }
  },
  "revisionDays": 7,
  "chapterOrder": {
    "physics": ["phy-light"],
    "chemistry": [],
    "maths": [],
    "biology": [],
    "english": [],
    "history": [],
    "geography": []
  },
  "taughtAlready": [],
  "examPattern": {
    "default": [
      { "section": "A", "title": "Fill in the blanks", "types": ["fill_blank"], "marks": 5 },
      { "section": "B", "title": "True/False & MCQ", "types": ["true_false", "mcq"], "marks": 10 },
      { "section": "C", "title": "Match the following", "types": ["match"], "marks": 5 },
      { "section": "D", "title": "Short answers", "types": ["short_answer", "numeric"], "marks": 20 },
      { "section": "E", "title": "Long answers", "types": ["short_answer", "label_diagram"], "marks": 25 },
      { "section": "F", "title": "Think and write", "types": ["think_write"], "marks": 15 }
    ]
  }
}
```

```json
{
  "sectionMinutes": 15,
  "sectionMarks": 15,
  "structure": [
    { "count": 6, "marksEach": 1, "types": ["mcq", "true_false", "fill_blank", "match", "order", "label_diagram", "numeric"] },
    { "count": 3, "marksEach": 2, "types": ["short_answer", "numeric", "label_diagram"] },
    { "count": 1, "marksEach": 3, "types": ["think_write"] }
  ],
  "sourceMix": { "sinceLastTest": 0.6, "weakTopics": 0.2, "spacedReview": 0.2 },
  "difficultyMix": { "easy": 0.4, "medium": 0.4, "challenge": 0.2 },
  "fallback": "If a source pool is empty, fill from sinceLastTest, then any studied lesson. Never include lessons not yet studied.",
  "windows": {
    "sat": { "opens": "sat 15:30", "closes": "sun 20:00" },
    "sun": { "opens": "sun 09:30", "closes": "mon 21:30" }
  },
  "bands": [
    { "min": 90, "label": "Superstar", "emoji": "🌟" },
    { "min": 75, "label": "Great work", "emoji": "👍" },
    { "min": 60, "label": "Getting there", "emoji": "💪" },
    { "min": 0, "label": "Let's grow this one", "emoji": "🌱" }
  ]
}
```

---

## Appendix E — Copy and tone examples (kid-facing)

| Moment | Say this |
|---|---|
| Today greeting | "Good evening, Avantika! 🌙 3 lessons today — you've got this!" |
| Activity slot | "Enjoy Bharatanatyam! 💃 Your next lesson is at 8:15." |
| Catch-up | "This one's waiting for you 🙂 Want to do it now?" |
| Correct answer | "Yes! ⭐ Spot on!" / "Brilliant thinking! 🧠" |
| Wrong (first try) | "Almost! Here's a clue 💡" |
| Wrong (after hint) | "Let's watch that part again — it'll click! ▶️" |
| Correction report header | "Let's fix these together 🛠️ — each one makes you stronger." |
| Test start | "Ready? 3 sections, 15 minutes each. Take a deep breath — you've got this! 💪" |
| Low score | "This one's a growing topic 🌱 We'll practise it in your fix-it session." |
| Streak | "🔥 6-day streak! Tara is doing a happy dance 🐘" |
| Bedtime | "Time to sleep! 🌙 Your stars are safe. See you tomorrow." |
| Streak shield used | "Missed a day? No worries — your streak shield saved it 🛡️" |

**Never say:** "Wrong!", "Bad", "Careless", "You failed", "Hurry up", or anything that compares her with other children.

---

## Appendix F — Textbook import kit

### `source/books.json` (the parent fills this in)

```json
{
  "board": "REPLACE_ME",
  "class": "VI",
  "academicYear": "2026-27",
  "books": {
    "maths":     { "title": "REPLACE_ME", "publisher": "REPLACE_ME", "edition": "REPLACE_ME" },
    "physics":   { "title": "REPLACE_ME", "publisher": "REPLACE_ME", "edition": "REPLACE_ME" },
    "chemistry": { "title": "REPLACE_ME", "publisher": "REPLACE_ME", "edition": "REPLACE_ME" },
    "biology":   { "title": "REPLACE_ME", "publisher": "REPLACE_ME", "edition": "REPLACE_ME" },
    "english":   { "title": "REPLACE_ME", "publisher": "REPLACE_ME", "edition": "REPLACE_ME" },
    "history":   { "title": "REPLACE_ME", "publisher": "REPLACE_ME", "edition": "REPLACE_ME" },
    "geography": { "title": "REPLACE_ME", "publisher": "REPLACE_ME", "edition": "REPLACE_ME" }
  }
}
```

### Checklist Claude Code follows for each import

1. Confirm the chapter folder exists. List the page files in order and point out any gaps in the page numbers.
2. Read every page and note → write `extract.md`, with `## Page N` headings, definitions in quotes, a section for exercises, and `[UNCLEAR p.N]` markers.
3. Stop if more than 2 pages are unclear. Ask the parent to photograph them again.
4. Propose the lesson split as a table (lesson title · pages · slot length · difficult concepts that need explainers) → **wait for the parent's OK**.
5. Write the chapter JSON:
   - `status: "draft"`, plus `book`, `sourceDir`, `parentNotes`
   - every lesson has cards, practice with hints, a notebook task, 3–6 check questions, keyRules in the book's wording, and `source`
   - `questionBank`: all book exercises (`fromBook`, `bookRef`), plus extra questions grounded in the pages, so that each lesson has at least 4 questions with a mix of difficulties.
6. Write the explainer scripts needed (Appendix C format), with each scene's `source.pages`.
7. Run `npm run validate-content` and fix everything it reports.
8. Self-check: pick 10 random items and confirm each one against its source page in `extract.md`. Remove anything that cannot be traced back to a page.
9. Report to the parent: lessons, questions (book / new), `needsReview` items, unclear pages, `parentNotes` (including video search words), and "Ready for your review in Parent → Chapter review".

