# NBA Fantasy Pickup Report — agent instructions

You run in the cloud every hour from 9:00am to 11:00pm Pacific, so the owner can submit
waiver claims before midnight Pacific. The 9am run is the first of a new Pacific day and
should pick up anything from last night's games (in-game injuries, post-game updates). The
11pm run is the last chance before waivers lock, so be quick. Your job: find NBA news that
could **significantly raise the fantasy value of a player who is probably on waivers**,
keep a mobile-friendly HTML report up to date, and send a push notification when there is
actionable pickup news (see step 8). Many hourly runs should update the report quietly
without notifying.

The owner plays in standard 12-team head-to-head category leagues (9-cat style) on Yahoo/ESPN.
You do NOT have access to their leagues, so judge availability by reputation: assume anyone
outside roughly the top ~130 in preseason fantasy ranks, or rostered in fewer than ~50% of
Yahoo leagues, is likely available. Say how confident you are.

Live report URL: https://seanunger.github.io/nba-fantasy-report/

## What counts as a pickup signal (most to least common)

1. **Injury to a starter or rotation player** (Out, Doubtful, multi-week, surgery, rest
   management) that opens minutes or usage for a teammate. The card is about the *injured
   player* (see "Two kinds of cards" below), and its analysis names 1–3 beneficiaries and
   says why (same position, backup on depth chart, played extra minutes last time this
   player sat). Include in-game exits and players newly listed Questionable or Doubtful,
   not just confirmed absences, when the injured player is a star or key starter.
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
4. Read `state.json`. For each card (an injury or a pickup, see "Two kinds of cards")
   decide what changed **in this run**
   (used for notifications and the "since last run" marker):
   - **NEW**: not in state.
   - **UPDATED**: in state, but something material changed (injury status or timeline,
     e.g. Questionable → Out or Out → multi-week; starter vs. bench; a big new game; a new
     beneficiary). A repeat of the same news is not an update.
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
8. **Notify for actionable pickup news.** A push notification interrupts the owner, so
   send one when this run found at least one NEW or UPDATED card that clears either bar
   below, and at least one pickup on it has an **Add now** or **Speculative add** verdict
   (never for Watch, Drop watch or Injury watch alone).

   **A. Star injury (any length).** A star or key starter gets hurt and it creates a real
   pickup. "Star or key starter" means roughly a top-60 fantasy player, or a team's
   primary starter who plays heavy minutes and usage (about 30+ minutes a night). Notify
   on the *first* sign, without waiting for a timeline:
   - he leaves a game with an injury, or is reported hurt after one;
   - he is newly listed Questionable, Doubtful or Out for an upcoming game;
   - he is ruled out for a longer stretch, has surgery, or gets a multi-week timeline.
   Notify again each time his status **gets worse**: e.g. left the game → Questionable →
   Out → out multiple weeks / surgery. Example: a star exits his game with an ankle
   injury and is called questionable for the next one → notify; the next day he is ruled
   out for 2–3 weeks → notify again. Do not notify again if the status repeats or
   improves.

   **B. Other big, lasting opportunities:**
   - a non-star starter or key rotation player is out for **a week or more**,
     indefinitely, or for the season, or ruled out with no return date;
   - a trade, signing, release or buyout that hands this player a starting job or a big
     minutes jump;
   - a confirmed promotion to the starting lineup (injury, coaching decision, etc.), or a
     sustained jump in minutes (30+ minutes in the last 2–3 games after playing far less
     before) for a likely available player.

   Never notify for: scheduled rest or back-to-back maintenance; Day-To-Day or
   Questionable tags on non-stars; a single big game on normal minutes; or an UPDATED card
   whose status, verdict and opportunity didn't really change (e.g. a confirmed absence
   that was already reported). Beyond the "status got worse" rule in A, only notify for a
   card again if a pickup's verdict was upgraded (e.g. Speculative add → Add now) or a new,
   clearly better pickup emerged.
   Record each notified card's `last_notified_pt` and `notified_for` (the status and
   verdict you notified for) in state.json, and compare against them to avoid repeats.
   Use the PushNotification tool with a short message (under 200 characters). For an
   injury, lead with the injured player and status, then the pickup, e.g.
   `Curry left game (ankle), Q for Tue → add Podziemski — https://seanunger.github.io/nba-fantasy-report/`.
   For other cards, lead with the pickup and reason, e.g.
   `Add Ryan Dunn: moved into PHX starting lineup — https://seanunger.github.io/nba-fantasy-report/`.
   One notification per run; if several cards qualify, combine them in one message.
9. Your final message is what the owner sees when they tap the notification, so its first
   line must be the bare report link: https://seanunger.github.io/nba-fantasy-report/
   Then list the NEW/UPDATED cards (one line each), whether you notified and why (or
   why not), and any errors. This run summary goes **only** in your final message and the
   commit, never on the page (see "No run log on the page").

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

### No run log on the page

Never put a run log, status paragraph or "what each run found" notes on the page (e.g.
"11:30pm: final check, quiet… 9pm: quiet… 8pm: …"), anywhere: not under a heading, not in
the header, not in the footer. If a run finds nothing new, the page simply stays the same
apart from the "updated" time. What changed is shown only by the small since-last-run tags
on cards. If today's page already has such a paragraph from an earlier run, delete it.

### Two kinds of cards

- **Injury cards**, for any pickup that exists because someone got hurt (or is out for
  rest, suspension or personal reasons). The card is titled and centered on the
  **injured player**: his name, team, position, the injury and his current status (e.g.
  "Stephen Curry · GSW · PG — ankle, left game Sun, Questionable Tue"). The body then
  explains the injury and timeline and points to **who is in line to capture his fantasy
  value**: 1–3 beneficiaries, each with expected role, likely availability and a verdict.
  One card per injured player; never a separate card per beneficiary. If two injuries on
  the same team feed the same beneficiary, give each injured player his own card and
  mention the overlap.
- **Pickup cards**, for everything that isn't caused by an injury: trades, signings,
  buyouts, a coaching decision to start someone, a minutes jump, a hot streak. These are
  titled by the **player to pick up**.

### Layout

- Header: "NBA Pickup Report", the Pacific date, the run label, and "updated h:mm pm PT".
  Nothing else above the first section.
- **Add tonight**: every card first seen or updated today, strongest first (by the best
  pickup verdict on it, then size of the opportunity). Each card shows:
  - a title line: the injured player (injury card) or the pickup (pickup card), team,
    position, and a NEW or UPDATED badge (UPDATED says what changed), plus the "since last
    run" tag if it changed in this run
  - **why**: one or two sentences. Injury card: injury, status and timeline. Pickup card:
    the trigger, e.g. "moved into the starting lineup over Bogdanovic".
  - **who gains** (injury card) or **expected role** (pickup card): for each pickup, the
    minutes or usage estimate and which categories he helps
  - **likely availability** for each pickup: e.g. "~20% rostered, likely available" with
    your confidence
  - **verdict** for each pickup: Add now / Speculative add / Watch
  - source links
- **Still relevant**: cards from earlier days with no material news today, compact
  one-line rows (injury rows lead with the injured player, then "→ pickup").
- **Drop watch**: fill-ins losing value because a starter is returning.
- **Injury watch**: notable players out or questionable with no clear pickup. One line
  each. If a pickup emerges later, promote the player to an injury card.
- Footer: links to the last 14 reports in `reports/` (newest first), data sources used, and
  any fetch errors.

Keep it skimmable: the owner reads it on a phone in a few minutes before midnight.

### Player names are links to the player modal

Every time you write an NBA player's name anywhere in the report (card titles, triggers like
"Banchero out", beneficiaries, one-line rows, drop watch, injury watch), wrap it like this:

```html
<a class="player" href="#" data-espn-id="4433134" data-name="Tristan da Silva" data-team="ORL">Tristan da Silva</a>
```

- `data-espn-id` is how the modal finds the player, so it must be right:
  - For a player with a note, copy the note's `espn_player_id` from fetch_notes.py's output.
  - For anyone else (beneficiaries, teammates, drop watch), run
    `python3 scripts/team_players.py TEAM` (one or more tricodes) and copy the id from the
    line with that player's name on that team.
  - Never guess or reuse an id from memory. If you can't find one (`espn_player_id` is null
    and the player isn't on the team list), leave `data-espn-id` out; the modal then says it
    can't load that player.
- `data-name` is the player's full name as Yahoo/ESPN spell it (keep suffixes like "Jr.").
  The visible text may be shorter (e.g. "Banchero"), but `data-name` must be the full name.
  It's only used as the modal's title.
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
  "run_label": "7pm",  // the Pacific hour of this run, e.g. "9am", "1pm", "11pm"
  "items": {
    "injury:stephen-curry": {
      "kind": "injury",
      "player": "Stephen Curry",          // the injured player (card title)
      "team": "GSW",
      "injury": "ankle",
      "status": "questionable",           // left-game | questionable | doubtful | out | out-multi-week | out-season
      "status_note": "Left Sun game; Q for Tue",
      "beneficiaries": [
        {"player": "Brandin Podziemski", "verdict": "Speculative add",
         "summary": "Would start at guard; 30+ min, points/3s/assists"}
      ],
      "first_seen_pt": "2026-10-25T19:00:00-07:00",
      "last_updated_pt": "2026-10-25T19:00:00-07:00",
      "last_notified_pt": "2026-10-25T19:00:00-07:00",
      "notified_for": "status questionable; Podziemski Speculative add"
    },
    "pickup:ryan-dunn": {
      "kind": "pickup",
      "player": "Ryan Dunn",              // the player to pick up (card title)
      "team": "PHX",
      "trigger": "Moved into the starting lineup (coach's decision)",
      "verdict": "Add now",
      "summary": "Starting at SF; 30+ min, steals/blocks/3s",
      "first_seen_pt": "2026-10-25T19:00:00-07:00",
      "last_updated_pt": "2026-10-25T19:00:00-07:00",
      "last_notified_pt": null,
      "notified_for": null
    }
  },
  "drop_watch": [],
  "injury_watch": []
}
```

Keys are `injury:` or `pickup:` plus the lowercase hyphenated name of the card's title
player. Compare `status`, `trigger`, `verdict`s, `beneficiaries` and `summary` with the
previous state to decide NEW / UPDATED / ONGOING, and compare `status` against
`notified_for` to apply the "status got worse" rule in step 8.

**Migrating old entries.** Older entries have no `kind` and are keyed by the pickup's name
(e.g. `"ja-kobe-walter"` with `trigger: "Kawhi out 1+ wk"`). When you meet one, convert it:
if its trigger is an injury, fold it into the `injury:<injured player>` card as a
beneficiary (merging with any other old entries for the same injured player); otherwise
rename it to `pickup:<name>` with `kind: "pickup"`. Keep the earliest `first_seen_pt` and the
latest `last_notified_pt`/`notified_for`. A converted entry is **ONGOING**, not NEW, unless
the news itself changed, so the migration alone never triggers a notification or a NEW tag.
