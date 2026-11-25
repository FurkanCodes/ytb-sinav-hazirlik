# Animated lesson storyboards (film/<id>.json)

App: Turkish exam-prep PWA for the YTB Uzman Yardımcılığı exam (19.12.2026). The user is a visual learner. Each lesson in `lessons.json` gets an animated, narrated "film" that the player `film.js` renders: scenes appear step by step, every step is read aloud by Turkish speech synthesis and shown as a caption.

Study two finished examples first: `film/u5.json` (rich, ~6 min) and `film/b1.json` (short lesson, ~3 min). Match their tone and density.

## Hard rules
1. **Facts only from the lesson.** Use only the lesson's `title`, `intro`, `points`, `tl`, `traps`, `recall`. No outside knowledge, no new numbers, dates, names, article numbers or claims. Rephrasing and reordering are fine. The checker rejects any number not present in the lesson text (0-12 are allowed as plain counting words).
2. **Cover everything.** Every point, every timeline row, every trap and every recall question must appear somewhere. Every number/date in the lesson should be shown on screen at least once.
3. **Turkish**, natural spoken style, short sentences (one idea per narration, about 8-25 words). Write numbers in narration the way they should be spoken ("12 Mart 1947", "yüzde 75,83", "madde 736", "5978 sayılı Kanun"); avoid abbreviations in narration that TTS reads badly (write "madde" not "md.", "Cumhurbaşkanlığı Kararnamesi" not "CBK" on first mention, "Resmî Gazete" not "RG"). On-screen text (`l`, `t`, `d`, `s`) may use the short forms.
4. No HTML. Highlight key words with `*asterisks*` (balanced). Use highlights sparingly (1-2 per text).
5. Length follows content: about 10-24 scenes. Short lessons 3-4 minutes, rich ones 6-9 minutes. Don't pad.
6. Structure: first scene `title`, last scene `end`. Put a `quiz` after each major block (use the lesson's `recall` items, plus extra quiz questions built from the points). Each lesson `trap` becomes a `trap` scene. Vary the scene kinds: pick the visual that fits the fact (dates → timeline, numbers → count/bars, hierarchy/membership → tree, procedure/sequence/causes → flow, true/false or two categories or "which are included" → compare, several facts on one subject → list).
7. Visual-first: each scene should make a *picture* of the idea, not a wall of text. On-screen labels short (≤ ~90 chars); the narration carries the detail.

## Schema
Top: `{"id":"<lessonId>","scenes":[...]}`. Every scene may have `t` (heading), `ic` (icon), `n` (narration spoken when the scene opens; optional if items exist). Every item needs `n` (spoken when that item appears).

Icons (`ic`): law, globe, people, building, money, calendar, vote, book, warn, q, flag, shield, chart, link, star.

| k | fields | items |
|---|---|---|
| title | tag (area name, e.g. "Kurum bilgisi", "Hukuk", "Uluslararası ilişkiler", "Genel kültür", "Yabancı dil"), t, sub, ic, n | – |
| say | t, ic, big (one big statement), n | optional `{l, n}` sub-lines |
| list | t, ic, n? | `{h?, l, n}` (h = short bold label) |
| timeline | t, ic, n? | `{d, l, n}` (d = date as in lesson) |
| count | t, ic, n? | `{v (number), pre?, suf?, dec?, l, n}` animated counter; `v` must be a plain number, `dec` = decimals |
| bars | t, ic, n? | `{l, v (number), txt? (label shown, e.g. "%75,83 hayır"), suf?, c? (0 blue,1 gold,2 green,3 red), n}` |
| flow | t, ic, n? | `{l, s?, n}` boxes joined by arrows (sequence/procedure) |
| tree | t, ic, root (top box text), n? | `{l, s?, n}` children of root |
| compare | t, ic, cols:[colA, colB], n? | `{c (0/1), l, n}`; col 0 drawn green, col 1 red (use for doğru/yanlış, var/yok, sayılır/sayılmaz, or two eras/categories) |
| trap | t, wrong, right, n (states the trap), n2 (gives the truth) | – |
| quiz | q, a, n? (spoken question, defaults to q), na? (spoken answer) | – (player pauses 5 s before the answer) |
| end | t ("Bu konu bitti"), sub, n | – |

## Check
Run `node tools/filmcheck.js <id> [<id>...]` from the repo root (`C:\Users\Furkan\ytb-sinav-hazirlik`). It must print `OK` for each of your ids. Fix every reported problem (usually a number not in the lesson: remove it or use the lesson's exact figure). Write JSON without a BOM, UTF-8.

Only create/edit `film/<your ids>.json`. Do not touch other files (the checker rewrites `film/index.json` itself; that's fine).
