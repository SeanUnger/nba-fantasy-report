#!/usr/bin/env python3
"""ESPN ids for a team's players, for report links to players who have no note.

Usage: python3 scripts/team_players.py TEAM [TEAM ...]   (NBA tricodes: GSW, NOP, NYK, ...)

Prints one line per player on each team's current roster (from the backend's
player pool): "TEAM  ESPN_ID  Full Name". Use the id as the link's data-espn-id.
"""
import json
import os
import sys
import urllib.parse
import urllib.request

BACKEND = os.environ.get("BASKETBALL_API", "https://i9708892i9.execute-api.us-west-1.amazonaws.com/prod")


def main():
    teams = [t.upper() for t in sys.argv[1:]]
    if not teams:
        sys.exit(__doc__)
    query = urllib.parse.urlencode({"team": ",".join(teams), "pageSize": 500, "sortBy": "playerName"})
    with urllib.request.urlopen(f"{BACKEND}/api/players?{query}", timeout=30) as response:
        players = json.loads(response.read())["players"]
    for p in sorted(players, key=lambda p: (p["team"], p["playerName"])):
        print(f"{p['team']}  {p['playerId']:<8} {p['playerName']}")


if __name__ == "__main__":
    main()
