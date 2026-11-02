---
name: import-chapter
description: Use when the parent asks to import a textbook chapter ("Import source/physics/04-light using SPEC §13A and Appendix F"), gives page photos, PDFs, notebook notes or worksheets, or asks to turn book material into a chapter JSON, lessons, questions or explainers. This is SPEC Phase C. Covers extract.md, the lesson-split proposal, the grounding rules, chapter and explainer JSON, validation, the self-check and the parent report.
---

# Import one textbook chapter (SPEC §13A + Appendix F)

**Golden rule:** teach only what is on the given pages and notes. Never use general knowledge. If something seems missing, write it in `parentNotes`, never in lessons. Do one chapter per run.

## Folder conventions

| What                         | Where                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| Book per subject             | `source/books.json` (if it says `REPLACE_ME`, ask the parent)                               |
| Exam portions                | `source/portions.md`                                                                        |
| Page images or PDF           | `source/<subject>/<NN-slug>/pages/` (`p061.jpg`… or `chapter.pdf`)                          |
| Notes and worksheets         | `source/<subject>/<NN-slug>/notes/`                                                         |
| Transcription (you write it) | `source/<subject>/<NN-slug>/extract.md`                                                     |
| Chapter file (you write it)  | `content/chapters/<subject>/<NN-slug>.json`. The folder must equal `subject`.               |
| Explainers (you write them)  | `content/explainers/<explainer-id>.json`                                                    |
| Cropped diagrams             | `content/media/images/<chapterId>-fig<N>.png` (or a simple SVG that uses the book's labels) |

`source/` is git-ignored and family-private.

**Ids:** lowercase and dashes, unique across **all** content.

- chapter: `<subj3>-<slug>` (e.g. `phy-light`)
- lessons: `<chapterId>-1`, `-2`…
- questions: `<lessonId>-p1` (practice), `-c1` (check), `-q1` (bank), `-cp1` (checkpoint)
- explainer: `<slug>`; its questions: `<explainerId>-cp1`

## Steps (do them in order, and stop where it says STOP)

1. **Inventory.** Confirm the folder exists. List the page files in order, and point out any **gaps** in the page numbers.
2. **Extract.** Read every page and note, and write `extract.md` in the format in [templates.md](templates.md) §1. Use `## Page N` headings, put definitions in quotes with exact wording, and keep all exercises in the book's numbering. Mark anything unreadable `[UNCLEAR p.N]`. Never guess.
3. **STOP if more than 2 pages are unclear.** Ask the parent to photograph them again, and list the pages.
4. **Propose the lesson split** as the table in templates.md §2: lesson title, pages, slot length (30/45/60 min, §5.4), the explainers needed (§7.5 visual names), and the number of questions. Book order only. **STOP and WAIT for the parent's OK.**
5. **Write the chapter JSON.** Start from [chapter-template.json](chapter-template.json). It passes the real schema and validator, and shows every question type. Each lesson needs:
   - `source.pages`
   - `videos` (the primary is usually an explainer, plus an optional `REPLACE_ME` YouTube alternate)
   - `cards` (one idea each, each with `source`)
   - `practice`, and **every practice question has `hints`**
   - `notebook` (an offline task)
   - `check` with 3–6 questions
   - `keyRules` in the book's wording
   - an optional `warmup`

   The chapter itself has `status: "draft"`, `book`, `sourceDir` and `parentNotes`. **Never** set `sample`.

6. **Write the questionBank.**
   - **Every** book exercise question goes in, with `fromBook: true` and `bookRef` (e.g. `"Ex. B Q4"`).
   - Add extra questions with `fromBook: false`, only when they test facts on the pages.
   - Each lesson needs at least 4 bank questions. The chapter needs at least 10, with easy, medium and challenge all present.
   - Every bank question has a `lessonId`.
7. **Write the explainers** for the §7.5 concepts in this chapter. Start from [explainer-template.json](explainer-template.json), and use the book's own examples. Every scene has `source.pages`. Use at most 3 checkpoints, and keep the explainer to 8 minutes or less (words ÷ 2.3 s, or `minDuration`, whichever is more). For visuals, props and the registry, see the `explainer-visual` skill. Use only names from `VISUAL_NAMES`. A visual that isn't built yet is fine in JSON, but note it in the report.
8. **Plan.** Add the chapter id to `content/plan.json` `chapterOrder.<subject>`, in book order.
9. **Validate.** Run `npm run validate-content` and fix **every error**. Read the warnings; the expected ones are listed below.
10. **Self-check.** Pick 10 random items (cards, keyRules, questions, scenes), and check each one against its page in `extract.md`. **Remove** anything you can't trace to a page. Run validate again.
11. **Report** to the parent with templates.md §3. End with "Ready for your review in Parent → Chapter review". Until Phase 6 exists, it says: "set `status` to `approved` in the file when you're happy".

## Grounding rules (these can't be skipped)

- **Only the given pages and notes.** Add no facts, topics, examples, numbers or dates from outside them.
- **Book terms and spellings** exactly as printed (e.g. "rectilinear propagation"). Kid-friendly words go _around_ the book's term and never replace it.
- **Definitions** in definition cards and `keyRules` stay in the book's exact or near-exact wording, because exams are marked against it.
- **Every item has a source.** Every lesson, card, warm-up card, question and explainer scene gets `source: { "pages": [..] }`. Anything from a notebook or worksheet gets `source.notes: "<file name>"`; you can use both.
- **Answers** come from the pages or the teacher's notes. If you can't find one, set `needsReview: true` and write a draft answer.
- **Teacher's notes vs the book:** the teacher's version wins for answers. Record the difference in `parentNotes`.
- **Unclear photo:** never guess a number, date, name or spelling. Set `needsReview: true`.
- **Diagrams:** crop a clear photo into `content/media/images/`, or redraw a simple SVG with the book's labels. The validator doesn't check that image files exist, so check them yourself.
- **Videos:** never choose YouTube videos. Put **search words** for each lesson in `parentNotes` (e.g. `"rectilinear propagation of light class 6"`), and leave `youtubeId: "REPLACE_ME"`. The parent picks the videos.
- **Kid copy:** short sentences that talk to her as "you". Use the explanations as "how to get it next time", and never write "wrong", "bad" or "careless" (see the `kid-ui` skill).

## Expected validator output for a fresh draft

- **Errors: none allowed.** The usual causes are:
  - a missing `source` on some item
  - a missing `book`
  - practice without hints
  - `fromBook` without `bookRef`
  - a bank question without `lessonId`
  - fewer than 10 bank questions, or no mix of difficulties
  - fewer than 3 checks
  - a dangling `questionId` or `explainerId`
  - a duplicate id
- **Warnings you can expect:**
  - `youtubeId is still "REPLACE_ME"`
  - `N question(s) are marked needsReview`
  - a lesson with fewer than 4 bank questions (fix this if you can)
  - a chapter not in `chapterOrder` (fix this in step 8)

## The 10-item self-check (copy it into your working notes)

- [ ] 1–10: item id → page → found in extract.md? (yes, or remove it)
- [ ] Every exercise in extract.md's Exercises section is in `questionBank` with a `bookRef`
- [ ] No `[UNCLEAR]` text was turned into content without `needsReview`
- [ ] Definitions match the quoted text in extract.md word for word
- [ ] `status` is `"draft"` and `sample` is absent, and no lesson uses a `sample: true` explainer (validate-content errors on it)
