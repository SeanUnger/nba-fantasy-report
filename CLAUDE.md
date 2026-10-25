# NBA Fantasy Pickup Report — agent instructions

You run in the cloud on a schedule (7:00pm, 10:00pm and 11:30pm Pacific) so the owner can
submit waiver claims before midnight Pacific. Your job: find NBA news that could
**significantly raise the fantasy value of a player who is probably on waivers**, publish
it as a mobile-friendly HTML report, and send a push notification only when the report has
changed since the previous run.

The owner plays in standard 12-team head-to-head category leagues (9-cat style) on Yahoo/ESPN.
You do NOT have access to their leagues, so judge availability by reputation: assume anyone
outside roughly the top ~130 in preseason fantasy ranks, or rostered in fewer than ~50% of
Yahoo leagues, is likely available. Say how confident you are.

Live report URL: https://sean-unger.github.io/nba-fantasy-report/

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
4. Read `state.json`. For each pickup candidate decide:
   - **NEW**: not in state.
   - **UPDATED**: in state, but something material changed (injury status or timeline,
     starter vs. bench, a big new game, a new beneficiary). A repeat of the same news is not
     an update.
   - **ONGOING**: in state and still relevant, nothing material new.
   - Drop items with no new news in 4 days, or whose trigger player has returned.
5. Write the report (format below) to `index.html`, and copy it to
   `reports/YYYY-MM-DD.html` (Pacific date). Later runs the same evening overwrite that
   day's file.
6. Update `state.json` (schema below), including `last_run_pt` and `run_label`.
7. `git add -A && git commit -m "Report YYYY-MM-DD <run label>" && git push origin main`.
   If pushing to main is rejected, push to a branch instead and say so in your final
   message.
8. **Notify only if at least one item is NEW or UPDATED compared with the state at the start
   of this run.** Use the PushNotification tool with a short message (under 200 characters),
   e.g. `3 new: Ryan Dunn (Durant out 2 wks), ... — https://sean-unger.github.io/nba-fantasy-report/`.
   If nothing changed, do not notify. Your final message should say whether you notified
   and why.

## Report format (`index.html`)

One self-contained HTML file: inline CSS, no external scripts, readable on a phone (max width
about 640px, 16px side padding, system font, base text 16px or larger). Support dark mode with
`prefers-color-scheme`. Content in this order:

- Header: "NBA Pickup Report", the Pacific date, the run label, and "updated h:mm pm PT".
- **Add tonight**: NEW and UPDATED candidates, strongest first. Each card shows:
  - player, team, position, and a NEW or UPDATED badge (UPDATED says what changed)
  - **why**: the trigger, e.g. "Durant (ankle) out 2+ weeks", in one or two sentences
  - **expected role**: minutes or usage estimate and which categories he helps
  - **likely availability**: e.g. "~20% rostered, likely available" with your confidence
  - **verdict**: Add now / Speculative add / Watch
  - source links
- **Still relevant**: ONGOING candidates, compact one-line rows.
- **Drop watch**: fill-ins losing value because a starter is returning.
- **Injury watch**: notable stars out or questionable with no clear pickup. One line each.
- Footer: links to the last 14 reports in `reports/` (newest first), data sources used, and
  any fetch errors.

Keep it skimmable: the owner reads it on a phone in a few minutes before midnight.

## `state.json` schema

```json
{
  "last_run_pt": "2026-10-25T19:00:00-07:00",
  "run_label": "7pm",
  "items": {
    "ryan-dunn": {
      "player": "Ryan Dunn",
      "team": "PHX",
      "trigger": "Kevin Durant (ankle) out 2+ weeks",
      "trigger_status": "out",
      "verdict": "Add now",
      "summary": "Starting at SF; 30+ min, steals/blocks/3s",
      "first_seen_pt": "2026-10-25T19:00:00-07:00",
      "last_updated_pt": "2026-10-25T19:00:00-07:00"
    }
  },
  "drop_watch": [],
  "injury_watch": []
}
```

Keys are lowercase hyphenated player names. Compare `trigger`, `trigger_status`, `verdict` and
`summary` with the previous state to decide NEW / UPDATED / ONGOING.
