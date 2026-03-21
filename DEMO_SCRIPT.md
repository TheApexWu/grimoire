# Grimoire Demo Script (~3 min)

## Setup Before Recording
- Browser open to localhost:3000, home view
- Second tab: localhost:3000/shapes (for B-roll cutaway)
- Text ready to paste: a short paragraph of YOUR writing (3-4 sentences)
- Pick target author: Hemingway (biggest visual contrast against most writing)

---

## BEAT 1: The Hook (0:00 - 0:25)

**[Screen: Home page, hero visible]**

> "Every writer has a statistical fingerprint. Sentence length, syllable density, comma cadence. Invisible patterns that make Hemingway sound like Hemingway and Kafka sound like Kafka."

**[Click into the library: load Hemingway]**

> "Grimoire makes those patterns visible."

**[Click "Diagnose My Writing" with Hemingway loaded]**

---

## BEAT 2: The Fingerprint (0:25 - 0:55)

**[Screen: Diagnose view loads - 3D shape, metrics, voice reading]**

> "This is Hemingway's voice shape. 84% monosyllables. Six-word average sentences. Almost zero semicolons. The shape encodes the style."

**[Pause on the 3D shape rotating. Let it breathe for 2 seconds.]**

> "Now compare that against Kafka."

**[Click "START OVER", load Kafka in first field, Hemingway in second, click "Compare Voices"]**

---

## BEAT 3: The Contrast (0:55 - 1:20)

**[Screen: Compare view - overlay radar, side-by-side shapes, distance metric]**

> "Distance: 0.18. Completely different rhythms. Different comma density, different sentence variation, different vocabulary range. Two distinct literary DNAs."

**[Let the overlay radar chart be visible for 3 seconds]**

> "Now the real question: can an AI agent close that gap?"

**[Click "Run Style Coach"]**

---

## BEAT 4: The Agent Loop (1:20 - 2:15)

**[Screen: Coaching view - spinner, live convergence chart updating]**

> "The agent generates three candidates per round at different temperatures. Each one gets scored against the target fingerprint. Best one advances. Gap analysis feeds back into the next round's prompt."

**[Point out the convergence chart as it updates]**

> "Watch the distance drop. Round one, the agent is guessing. By round three, it's locking in on the target metrics. By round five, it's converged."

**[Wait for coaching to complete. ~60-70 seconds. You can speed this up in editing or talk over it.]**

**If time is tight during recording:** Pre-run a coaching session, screenshot the coached view, and narrate over it. Cut back to live for the final reveal.

---

## BEAT 5: The Proof (2:15 - 2:50)

**[Screen: Coached view - three shapes side-by-side, convergence chart, text comparison]**

> "Three shapes. My original. The coached version. The target. You can see the coached shape converging toward Hemingway's profile."

**[Scroll to text comparison]**

> "And the text itself: shorter sentences, simpler words, stripped-down punctuation. The metrics drove the rewrite."

**[Scroll to blind authorship test]**

> "Final validation: a separate LLM judge reads both texts blind. It doesn't know which is real. [If FOOLED:] It couldn't tell the difference. [If DETECTED:] It flagged subtle differences, but the statistical gap closed by [X]%."

---

## BEAT 6: The Close (2:50 - 3:00)

> "Grimoire: paste any text, target any voice, watch an agent converge on it with statistical proof. Built with Next.js, Vercel AI SDK, and Gemini."

**[Hold on the coached view for 2 seconds. End.]**

---

## Fallback Plans

| Failure | Recovery |
|---------|----------|
| Coaching takes too long | Pre-record a coaching run. Splice in the coached results. |
| OCR/upload fails | Paste text directly. Never demo the upload path unless you tested it 30 seconds ago. |
| Judge says DETECTED | That's fine. Say "the judge flagged differences, but the distance metric shows convergence." The proof is the chart, not the judge. |
| API rate limit | Load a pre-cached author from the library. The fingerprint + shape still demo perfectly without any API call. |
| Shapes page as backup | If main flow breaks, switch to /shapes tab. "Here are six canonical voices rendered as 3D shapes from pure statistics." Still impressive. |

## Recording Tips
- Record at 1920x1080 or 1280x720
- Use a clean browser window (no bookmarks bar, no extensions visible)
- Dark mode is already on. The app looks best on a dark desktop wallpaper.
- If narrating live, speak slower than you think you need to
- Total video should be 2-3 min. Judges watch a lot of these. Respect their time.
