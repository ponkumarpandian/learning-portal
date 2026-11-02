# Import templates

## 1. `extract.md` format

```markdown
# <Subject> · Chapter <N>: <Title as printed>

Book: <title>, <publisher>, <edition> · Pages: 61–68 · Notes: notebook-1.jpg, worksheet-1.jpg
Page gaps: none (or: p.65 missing)
Unclear: [UNCLEAR p.62] line 3 (smudged number), or none

## Page 61

### <Heading as printed>

- Definition: "<exact wording, in quotes>"
- Key fact: <fact>
- Example: <the book's example>
- Activity <n>: <what to do, what is observed>
- Diagram (Fig. 4.1): <description; labels: A, B, C>

## Page 62

...

## Notes: notebook-1.jpg

- Q: <teacher's question> · A: "<teacher's answer wording>"
- Differs from book: <what differs>

## Exercises (book numbering)

### Ex. A: Fill in the blanks (p.66)

1. <question> · Answer: <from p.N> or [answer not found → needsReview]

### Ex. B: True or false (p.66)

...
```

## 2. Lesson-split proposal (show it, then WAIT for the OK)

```markdown
Here's how I'd split "<Chapter>" into lessons (book order). OK to go ahead?

| #   | Lesson title                     | Pages | Slot   | Explainer needed (§7.5)    | Book Qs | Extra Qs |
| --- | -------------------------------- | ----- | ------ | -------------------------- | ------- | -------- |
| 1   | Light travels in a straight line | 61–62 | 45 min | LightRay (torch, corner)   | 4       | 2        |
| 2   | Shadows and the pinhole camera   | 63–64 | 45 min | LightRay (shadow, pinhole) | 5       | 1        |

Unclear pages: none · Page gaps: none · Things I noticed: <e.g. the portion lists "eclipses" but the pages don't cover it>
```

The slot length should match the timetable slots for that subject (§5.4: 30 min means 4 cards and 3 checks; 45 means 6 and 5; 60 means 8 and 6).

## 3. Report to the parent

```markdown
## Imported: <Subject> · <Chapter> (draft)

- **Lessons:** N (<titles>)
- **Questions:** N total. Book: N (all exercises Ex. A–E), new: N. Mix: N easy / N medium / N challenge
- **Explainers:** <ids> (visuals: <names>; not built yet: <names, or none>)
- **Please check (needsReview):** N
  - <question id>: p.N, <why: answer not found / unclear photo>
- **Unclear pages:** <list, or none>
- **Notes for you (parentNotes):**
  - Video search words: lesson 1 "<words>", lesson 2 "<words>"
  - <gaps / teacher-vs-book differences>
- **Validation:** ✔ 0 errors, N warnings (<which>)
- **Self-check:** 10/10 items traced to their pages

Ready for your review in Parent → Chapter review. (Until that screen exists, change `"status": "draft"` to `"approved"` in `content/chapters/<subject>/<file>.json`.)
```
