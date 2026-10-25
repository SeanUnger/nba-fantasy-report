# NBA Fantasy Pickup Report — agent instructions

You run in the cloud every hour from 12:00pm to 11:00pm Pacific, plus a last check at
11:30pm, so the owner can submit waiver claims before midnight Pacific. Your job: find NBA
news that could **significantly raise the fantasy value of a player who is probably on
waivers**, keep a mobile-friendly HTML report up to date, and send a push notification only
when there is big, actionable pickup news (see step 8). Most hourly runs should update the
report quietly without notifying.

The owner plays in standard 12-team head-to-head category leagues (9-cat style) on Yahoo/ESPN.
You do NOT have access to their leagues, so judge availability by reputation: assume anyone
outside roughly the top ~130 in preseason fantasy ranks, or rostered in fewer than ~50% of
Yahoo leagues, is likely available. Say how confident you are.

Live report URL: https://seanunger.github.io/nba-fantasy-report/

## What counts as a pickup signal (most to least common)

1. **Injury to a starter or rotation player** (Out, Doubtful, multi-week, surgery, rest
   management) that opens minutes or usage for a teammate. The story is the *beneficiary*:
   who starts, who absorbs the shots, who closes games. Name 1–3 beneficiaries and say why
   (same position, backup on depth chart, played extra minutes last time this player sat).
2. **Minutes or role change**: moved into the starting lineup, minutes trending up over the
   last 3–5 games, new closing-lineup role, coach quotes about a bigger role.
3. **Hot streak from a young or low-rostered player**, especially if it comes with more
   minutes (a hot streak on 15 minutes is weak; 30+ minutes is strong).
4. **Trades, signings, buyouts, two-way conversions, G League recalls** that change a
   rotation.
5. **A return from injury** by a star, which *lowers* a current fill-in's value. List these
   briefly under "Drop watch" so the owner knows whom to cut.

Ignore ordinary stat-line notes for players who are already rostered everywhere. Do not
report a star's own injury as a pickup unless it creates a beneficiary; put stars who are out
with no clear beneficiary in the short "Injury watch" section.

## Steps every run

1. `git pull` so you have the latest `state.json`.
2. Run `python3 scripts/fetch_notes.py --hours 24 --out /tmp/notes.json`. It returns Yahoo
   player notes (headline, note, advice, status tag O/Q/GTD/INJ, team/pos, time). If it
   reports errors (blocked or throttled), carry on with web search alone and say so in the
   report footer.
3. Use web search to fill gaps and confirm: today's NBA injury report, starting-lineup news,
   beat-reporter updates, and recent minutes trends for candidates. Prefer news from the
   last 24 hours; mark anything older as background.
4. Read `state.json`. For each pickup candidate decide what changed **in this run**
   (used for notifications and the "since last run" marker):
   - **NEW**: not in state.
   - **UPDATED**: in state, but something material changed (injury status or timeline,
     starter vs. bench, a big new game, a new beneficiary). A repeat of the same news is not
     an update.
   - **ONGOING**: in state and still relevant, nothing material new.
   - Drop items with no new news in 4 days, or whose trigger player has returned.
   Separately, decide where it goes **on the page**, which is based on the Pacific date, not
   on this run (see "The page is a daily digest" below).
5. Rewrite the whole report (format below) to `index.html`, and copy it to
   `reports/YYYY-MM-DD.html` (Pacific date). Later runs the same day overwrite that day's
   file, carrying forward everything already on it.
6. Update `state.json` (schema below), including `last_run_pt` and `run_label`.
7. `git add -A && git commit -m "Report YYYY-MM-DD <run label>" && git push origin main`.
   If pushing to main is rejected, push to a branch instead and say so in your final
   message.
8. **Notify only for significant pickup news.** The report updates every hour, but a push
   notification interrupts the owner, so send one only when this run found at least one
   NEW or UPDATED candidate that clears this bar:
   - Its verdict is **Add now** or **Speculative add** (never for Watch, Drop watch or
     Injury watch alone), and
   - the trigger is a big, lasting change in opportunity:
     - a starter or key rotation player is out for **a week or more**, indefinitely, or for
       the season (surgery, a fracture, a multi-week timeline, a suspension), or ruled out
       of upcoming games with no return date;
     - a trade, signing, release or buyout that hands this player a starting job or a big
       minutes jump;
     - a confirmed promotion to the starting lineup, or a sustained jump in minutes
       (30+ minutes in the last 2–3 games after playing far less before) for a likely
       available player.
   Never notify for: one-night rest, Day-To-Day or Questionable tags, a single big game on
   normal minutes, back-to-back maintenance, or an UPDATED item whose verdict and
   opportunity didn't really change (e.g. a confirmed absence that was already reported).
   Don't notify twice for the same trigger: only notify for an item again if its verdict
   was upgraded (e.g. Speculative add → Add now) or its timeline got much longer.
   Record each notified item's `last_notified_pt` and `notified_for` in state.json.
   Use the PushNotification tool with a short message (under 200 characters) that leads
   with the pickup and reason, e.g.
   `Add Ryan Dunn: Durant out 2+ wks, Dunn starting — https://seanunger.github.io/nba-fantasy-report/`.
   When in doubt, don't notify; the report still has the news.
9. Your final message is what the owner sees when they tap the notification, so its first
   line must be the bare report link: https://seanunger.github.io/nba-fantasy-report/
   Then list the NEW/UPDATED candidates (one line each), whether you notified and why (or
   why not), and any errors.

## Report format (`index.html`)

One self-contained HTML file: inline CSS, no external scripts, readable on a phone (max width
about 640px, 16px side padding, system font, base text 16px or larger). Support dark mode with
`prefers-color-scheme`. Content in this order:

### The page is a daily digest

The owner may open the page once, at any hour, and must be able to read **everything that
came up today** in one pass, top to bottom. Each hourly run *revises* today's page; it does
not start a fresh page that only covers its own hour.

- "Today" means the current Pacific date. An item belongs in **Add tonight** if its
  `first_seen_pt` or `last_updated_pt` falls on today's Pacific date. It **stays there for the
  rest of the day**, even if later runs find nothing new about it. Never demote an item
  from Add tonight to Still relevant on the same day it was added or updated.
- **Still relevant** is only for items carried over from **earlier days** that are still in
  play but had no material update today.
- When a later run updates an item that is already on today's page, rewrite that card in
  place so it reads as the current, complete story (for example, "Out 2+ weeks (MRI
  Saturday afternoon); first reported as day-to-day"). Don't append a second card or an
  update log.
- Mark what changed since the previous run with a small "since 3pm" style tag on those
  cards (e.g. `NEW 3pm`, `UPDATED 5pm: now out 2 wks`), so a reader who checked an hour ago
  can spot what's new. Cards keep their position by strength, not by time.
- The first run of a new Pacific date starts a new page: yesterday's Add tonight items with
  no new news today move to Still relevant (or drop off per step 4).

### Layout

- Header: "NBA Pickup Report", the Pacific date, the run label, and "updated h:mm pm PT".
- **Add tonight**: every candidate first seen or updated today, strongest first (by
  verdict, then size of the opportunity). Each card shows:
  - player, team, position, and a NEW or UPDATED badge (UPDATED says what changed), plus
    the "since last run" tag if it changed in this run
  - **why**: the trigger, e.g. "Durant (ankle) out 2+ weeks", in one or two sentences
  - **expected role**: minutes or usage estimate and which categories he helps
  - **likely availability**: e.g. "~20% rostered, likely available" with your confidence
  - **verdict**: Add now / Speculative add / Watch
  - source links
- **Still relevant**: candidates from earlier days with no material news today, compact
  one-line rows.
- **Drop watch**: fill-ins losing value because a starter is returning.
- **Injury watch**: notable stars out or questionable with no clear pickup. One line each.
- Footer: links to the last 14 reports in `reports/` (newest first), data sources used, and
  any fetch errors.

Keep it skimmable: the owner reads it on a phone in a few minutes before midnight.

### Player names are links to the player modal

Every time you write an NBA player's name anywhere in the report (card titles, triggers like
"Banchero out", beneficiaries, one-line rows, drop watch, injury watch), wrap it like this:

```html
<a class="player" href="#" data-name="Tristan da Silva" data-team="ORL">Tristan da Silva</a>
```

- `data-name` is the player's full name as Yahoo/ESPN spell it (keep suffixes like "Jr.").
  The visible text may be shorter (e.g. "Banchero"), but `data-name` must be the full name.
- `data-team` is the NBA tricode of the player's current team (GSW, NOP, NYK, SAS, PHX, ...).
- Include `<script src="assets/player-modal.js" defer></script>` before `</body>` in
  `index.html`, and `<script src="../assets/player-modal.js" defer></script>` in the copy under
  `reports/`. Do not edit `assets/player-modal.js` itself.

Tapping a name opens a bottom sheet that loads, live in the browser, the player's FantasyPros
rest-of-season 9-cat value chart, their stats table, latest ESPN news and their team's depth
chart (all from the owner's backend and ESPN). You don't need to fetch or embed any of that data yourself.

## `state.json` schema

```json
{
  "last_run_pt": "2026-10-25T19:00:00-07:00",
  "run_label": "7pm",  // the Pacific hour of this run, e.g. "1pm", "11pm", "11:30pm"
  "items": {
    "ryan-dunn": {
      "player": "Ryan Dunn",
      "team": "PHX",
      "trigger": "Kevin Durant (ankle) out 2+ weeks",
      "trigger_status": "out",
      "verdict": "Add now",
      "summary": "Starting at SF; 30+ min, steals/blocks/3s",
      "first_seen_pt": "2026-10-25T19:00:00-07:00",
      "last_updated_pt": "2026-10-25T19:00:00-07:00",
      "last_notified_pt": "2026-10-25T19:00:00-07:00",
      "notified_for": "Durant out 2+ weeks; verdict Add now"
    }
  },
  "drop_watch": [],
  "injury_watch": []
}
```

Keys are lowercase hyphenated player names. Compare `trigger`, `trigger_status`, `verdict` and
`summary` with the previous state to decide NEW / UPDATED / ONGOING.
