# Kid-facing copy (SPEC §15.10, §8.4, §12, Appendix E)

**Voice:** short sentences that talk to her as "you". Warm and specific, with one emoji at most per line. Buttons say exactly what they do: "Check my answer", "Next: learn cards", "Back to my trail". Tara says one short line at a time and never scolds.

**Never use:** "wrong", "bad", "careless", "fail" / "failed", "hurry" / "hurry up", "incorrect", "error", "lazy", or anything that compares her with other children. Never show a scary countdown or a red ✗. Use soft amber.

**Use instead:** "Not quite", "Almost!", "Let's fix this one", "here's how to get it next time", "This one's waiting for you", "growing topic".

| Moment                   | Say this                                                                       |
| ------------------------ | ------------------------------------------------------------------------------ |
| Today greeting           | "Good evening, Avantika! 🌙 3 lessons today — you've got this!"                |
| Activity slot            | "Enjoy Bharatanatyam! 💃 Your next lesson is at 8:15."                         |
| Stone not ready          | "Maths starts at 4:15. Finish the glowing stone first!"                        |
| Catch-up                 | "This one's waiting for you 🙂 Want to do it now?"                             |
| Correct answer           | "Yes! ⭐ Spot on!" / "Brilliant thinking! 🧠"                                  |
| Wrong (first try)        | "Almost! Here's a clue 💡"                                                     |
| Wrong (after the hint)   | "Let's watch that part again — it'll click! ▶️"                                |
| Video missing / offline  | "Video not available right now — let's learn with cards! 🃏"                   |
| Leave lesson             | "Leave the lesson? Your progress is saved." (default: **Keep going**)          |
| Correction report header | "Let's fix these together 🛠️ — each one makes you stronger."                   |
| Test start               | "Ready? 3 sections, 15 minutes each. Take a deep breath — you've got this! 💪" |
| Test, 2 minutes left     | "2 minutes left — check your answers 🙂"                                       |
| Low score                | "This one's a growing topic 🌱 We'll practise it in your fix-it session."      |
| Streak                   | "🔥 6-day streak! Tara is doing a happy dance 🐘"                              |
| Streak shield used       | "Missed a day? No worries — your streak shield saved it 🛡️"                    |
| Eye break                | "Look at something far away for 20 seconds 👀"                                 |
| Bedtime                  | "Time to sleep! 🌙 Your stars are safe. See you tomorrow."                     |
| New content              | "New lessons are ready! 🎉"                                                    |
| Welcome                  | "Welcome to your adventure, Avantika! 🗺️"                                      |
| End of exams             | "Adventure complete! 🏆"                                                       |

**Report bands** (from `test-blueprint.json`, never hard-coded): 🌟 Superstar (90% or more) · 👍 Great work (75–89%) · 💪 Getting there (60–74%) · 🌱 Let's grow this one (below 60%).

**Wording:** use "Today’s trail", "her adventure" and "chapters of your adventure". Times are in 12-hour form without am/pm (`fmtTime`), e.g. "4:15".

**Where copy lives:** generic app copy goes in components or `src/features/copy.ts`. Anything about a subject, lesson or slot comes from content: `slot.label`, `subject.name`, `lesson.title` and `question.explanation`.
