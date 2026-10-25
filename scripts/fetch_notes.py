#!/usr/bin/env python3
"""Fetch Yahoo Fantasy Basketball player notes from the last N hours as JSON.

Usage: python3 scripts/fetch_notes.py [--hours 24] [--out notes.json]

Yahoo shows 9 notes per page, newest first, paged with ?count=<offset>.
Timestamps are rendered in US/Eastern ("12 minutes ago", "Today, 8:35 pm",
"Yesterday, 11:02 am", "Tuesday, 8:08 pm", "Oct 23, 5:12 pm").
"""
import argparse
import html
import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

URL = "https://basketball.fantasysports.yahoo.com/nba/playernotes?pos={}&status=POS&count={}"
# Each feed holds only its newest ~100 notes, so ALL covers well under 24h on a busy
# night; the per-position feeds reach back days. Fetch them all and dedupe.
POSITIONS = ["ALL", "PG", "SG", "SF", "PF", "C"]
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
ET = ZoneInfo("America/New_York")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
MONTHS = {m: i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}


def clean(fragment):
    text = re.sub(r"<br\s*/?>", "\n", fragment)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"[ \t]+", " ", html.unescape(text)).strip()


def parse_time(stamp, now):
    stamp = stamp.strip()
    m = re.match(r"(\d+) (second|minute|hour)s? ago", stamp)
    if m:
        return now - timedelta(**{m.group(2) + "s": int(m.group(1))})
    m = re.match(r"(Today|Yesterday|[A-Z][a-z]+day|([A-Z][a-z]{2}) (\d+)), (\d+):(\d+) ([ap]m)", stamp)
    if not m:
        return None
    hour = int(m.group(4)) % 12 + (12 if m.group(6) == "pm" else 0)
    if m.group(1) == "Today":
        day = now.date()
    elif m.group(1) == "Yesterday":
        day = now.date() - timedelta(days=1)
    elif m.group(1) in WEEKDAYS:
        day = now.date() - timedelta(days=(now.weekday() - WEEKDAYS.index(m.group(1))) % 7 or 7)
    else:
        day = now.date().replace(month=MONTHS[m.group(2)], day=int(m.group(3)))
        if day > now.date():
            day = day.replace(year=day.year - 1)
    return datetime(day.year, day.month, day.day, hour, int(m.group(5)), tzinfo=ET)


def parse_page(page, now):
    notes = []
    for item in re.findall(r'<li class="Grid-h-mid Grid-2col Listitem.*?</li>\s*(?=<li class="Grid-h-mid|</ul>)', page, re.S):
        headline = re.search(r'<div class="Fw-b Fz-med Mbot-xl">(.*?)</div>', item, re.S)
        body = re.search(r'<div class="Fw-b Fz-med Mbot-xl">.*?</div>\s*<div>(.*?)<span class="Fz-xxs">', item, re.S)
        source = re.search(r'class="F-faded">(.*?)</a>', item)
        stamp = re.search(r'class="Ta-end F-timestamp">(.*?)</span>', item, re.S)
        player = re.search(r'data-ys-playerid="(\d+)"[^>]*title="([^"]+)"', item)
        status = re.search(r'ysf-player-status[^>]*><span[^>]*title="([^"]+)"[^>]*>([^<]+)</span>', item)
        team_pos = re.search(r'<span class="D-b"><span class="Fz-xxs">(.*?)</span>', item)
        game = re.search(r'ysf-game-status[^>]*>(?:<a[^>]*>)?(.*?)<', item, re.S)
        text = clean(body.group(1)) if body else ""
        note, _, advice = text.partition("Advice:")
        when = parse_time(clean(stamp.group(1)), now) if stamp else None
        notes.append({
            "player": player.group(2) if player else None,
            "yahoo_player_id": player.group(1) if player else None,
            "team_pos": clean(team_pos.group(1)) if team_pos else None,
            "status": status.group(2).strip() if status else None,
            "status_full": status.group(1) if status else None,
            "headline": clean(headline.group(1)) if headline else None,
            "note": note.strip(),
            "advice": advice.strip(),
            "source": clean(source.group(1)) if source else None,
            "time_et": when.isoformat() if when else None,
            "time_raw": clean(stamp.group(1)) if stamp else None,
            "game": clean(game.group(1)) if game else None,
        })
    return notes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", type=float, default=24)
    ap.add_argument("--max-pages", type=int, default=80)
    ap.add_argument("--out", default="-")
    args = ap.parse_args()

    now = datetime.now(ET)
    cutoff = now - timedelta(hours=args.hours)
    notes, errors, seen, pages = [], [], set(), 0
    for pos in POSITIONS:
        for page_no in range(args.max_pages):
            url = URL.format(pos, page_no * 9)
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                page = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
            except Exception as exc:  # throttled or blocked: report and move on
                errors.append(f"{url}: {exc}")
                break
            pages += 1
            batch = parse_page(page, now)
            if not batch:
                if page_no == 0:
                    errors.append(f"{url}: no notes parsed (page layout changed or blocked?)")
                break  # past the end of this feed
            for n in batch:
                key = (n["yahoo_player_id"], n["headline"])
                if key in seen:
                    continue
                if n["time_et"] is None:
                    errors.append(f"unparsed timestamp {n['time_raw']!r} for {n['player']}")
                    continue
                if datetime.fromisoformat(n["time_et"]) >= cutoff:
                    seen.add(key)
                    notes.append(n)
            oldest = [datetime.fromisoformat(n["time_et"]) for n in batch if n["time_et"]]
            if oldest and min(oldest) < cutoff:
                break
            time.sleep(1.5)

    notes.sort(key=lambda n: n["time_et"], reverse=True)
    result = {"fetched_at_et": now.isoformat(), "hours": args.hours, "count": len(notes),
              "pages": pages, "errors": errors, "notes": notes}
    out = json.dumps(result, indent=1, ensure_ascii=False)
    if args.out == "-":
        print(out)
    else:
        with open(args.out, "w") as f:
            f.write(out)
        print(f"{len(notes)} notes from {pages} pages -> {args.out}; errors: {errors}", file=sys.stderr)


if __name__ == "__main__":
    main()
