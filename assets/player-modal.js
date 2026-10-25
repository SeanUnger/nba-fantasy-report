// Player modal for the pickup report. Any element with class "player" and a
// data-name (plus data-team as a tiebreaker) opens a bottom sheet with:
//   - the FantasyPros ROS 9-cat value chart, with each category's projected
//     per-game stat under its bar (port of the Chrome extension's
//     labeledChartSvg in basketball/chrome-extension/content/common.js)
//   - the player's latest ESPN news (same Rotowire feed as the extension's
//     depth-chart news popover)
// Both are fetched live from the browser when the modal opens; the backend
// and site.api.espn.com both allow any origin.

(() => {
    const API_BASE_URL = 'https://i9708892i9.execute-api.us-west-1.amazonaws.com/prod';
    const ESPN_NEWS_URL = 'https://site.api.espn.com/apis/fantasy/v2/games/fba/news/players';
    const WINDOW = 'fantasyProsRosProjection';
    const SUFFIX = 'L156R120B2400C9';
    const NEWS_ITEMS = 3;

    const CATS = [
        { key: 'pts', label: 'PTS', name: 'Points', color: '#0f9b7c', stat: 'pointsPerGame' },
        { key: 'fg', label: 'FG%', name: 'Field Goal %', color: '#2a78d6', stat: 'fieldGoalPct', att: 'fieldGoalsAttemptedPerGame' },
        { key: 'ft', label: 'FT%', name: 'Free Throw %', color: '#eb6834', stat: 'freeThrowPct', att: 'freeThrowsAttemptedPerGame' },
        { key: 'tpm', label: '3PM', name: 'Three-Pointers Made', color: '#1baf7a', stat: 'threePointersMadePerGame' },
        { key: 'reb', label: 'REB', name: 'Rebounds', color: '#eda100', stat: 'reboundsPerGame' },
        { key: 'ast', label: 'AST', name: 'Assists', color: '#008300', stat: 'assistsPerGame' },
        { key: 'stl', label: 'STL', name: 'Steals', color: '#e87ba4', stat: 'stealsPerGame' },
        { key: 'blk', label: 'BLK', name: 'Blocks', color: '#4a3aa7', stat: 'blocksPerGame' },
        { key: 'to', label: 'TO', name: 'Turnovers', color: '#e34948', stat: 'turnoversPerGame' },
    ];
    const MAX_DOLLAR = 15;

    const escapeHtml = (text) =>
        String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const dollar = (n) => {
        const rounded = Math.round(n);
        return (rounded < 0 ? '-$' : '$') + Math.abs(rounded);
    };
    const fmt1 = (n) => (n ?? 0).toFixed(1);
    const pct3 = (n) => (n ?? 0).toFixed(3).replace(/^0\./, '.');

    // Same as the backend's normalize_name() and the extension's normalizeName.
    const normalizeName = (name) =>
        (name || '')
            .normalize('NFKD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/\./g, '')
            .trim()
            .replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/, '')
            .replace(/\s+/g, ' ')
            .trim();
    const stripAccents = (name) => (name || '').normalize('NFKD').replace(/[̀-ͯ]/g, '');

    // Report team codes are NBA tricodes, but accept Yahoo/ESPN short forms too.
    const TEAM_ALIASES = { GS: 'GSW', NO: 'NOP', NY: 'NYK', SA: 'SAS', PHO: 'PHX', UTAH: 'UTA', WSH: 'WAS', BRK: 'BKN', CHO: 'CHA' };
    const toTricode = (team) => TEAM_ALIASES[(team || '').toUpperCase()] ?? (team || '').toUpperCase();

    // ---------- data ----------

    const playerCache = new Map();
    // The backend's ?name= is a case-insensitive substring match without
    // accent folding, so query the accent-stripped name and pick the exact
    // normalized match, with team as the tiebreaker (the extension's rule).
    async function fetchPlayer(name, team) {
        const key = `${normalizeName(name)}|${team}`;
        if (playerCache.has(key)) return playerCache.get(key);
        const promise = (async () => {
            const url =
                `${API_BASE_URL}/api/players?pageSize=10&name=${encodeURIComponent(stripAccents(name).replace(/\./g, '').replace(/\s+(Jr|Sr|II|III|IV|V)$/i, ''))}` +
                `&statsFantasyProsRosProjection&categoryValue`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`player lookup failed (${response.status})`);
            const players = (await response.json()).players ?? [];
            const exact = players.filter((p) => normalizeName(p.playerName) === normalizeName(name));
            const pool = exact.length ? exact : players;
            if (pool.length <= 1) return pool[0] ?? null;
            const tricode = toTricode(team);
            return pool.filter((p) => p.team === tricode)[0] ?? (exact.length === 1 ? exact[0] : null);
        })();
        playerCache.set(key, promise);
        promise.catch(() => playerCache.delete(key));
        return promise;
    }

    async function fetchNews(playerId) {
        const response = await fetch(`${ESPN_NEWS_URL}?playerId=${encodeURIComponent(playerId)}&limit=15`);
        if (!response.ok) throw new Error(`news failed (${response.status})`);
        // The feed mixes in highlight clips ("Media", headline only); keep the write-ups.
        const feed = (await response.json()).feed ?? [];
        return feed.filter((item) => item.type !== 'Media').slice(0, NEWS_ITEMS).map((item) => ({
            headline: item.headline,
            story: item.story ?? item.description ?? '',
            published: item.published,
            source: item.type ?? '',
        }));
    }

    // ---------- rendering ----------

    function rawStat(cat, stats) {
        if (!stats) return '';
        if (cat.att) return pct3(stats[cat.stat]);
        return fmt1(stats[cat.stat]);
    }

    // The extension's labeledChartSvg plus a row under the labels with each
    // category's projected per-game stat (and FGA/FTA under the percentages).
    function chartSvg(value, stats) {
        const CW = 460;
        const CH = 206;
        const BASE_Y = 75;
        const BAR_W = 32;
        const GAP = 16;
        const MAX_H = 48;
        const LABEL_Y = 160;
        const STAT_Y = 180;
        const ATT_Y = 196;
        const startX = (CW - (CATS.length * BAR_W + (CATS.length - 1) * GAP)) / 2;
        const bars = CATS.map((cat, i) => {
            const x = startX + i * (BAR_W + GAP);
            const cx = x + BAR_W / 2;
            const v = value[cat.key] ?? 0;
            const h = Math.max(Math.min(Math.abs(v) / MAX_DOLLAR, 1) * MAX_H, 3);
            const positive = v >= 0;
            const y = positive ? BASE_Y - h : BASE_Y;
            const amountY = positive ? y - 5 : y + h + 12;
            const att = cat.att && stats ? `<text class="att" x="${cx}" y="${ATT_Y}" text-anchor="middle">${Math.round(stats[cat.att] ?? 0)} att</text>` : '';
            return `<g>
                <rect x="${x}" y="${y}" width="${BAR_W}" height="${h}" rx="4" fill="${cat.color}" opacity="${positive ? 1 : 0.5}"><title>${cat.name}: ${dollar(v)}</title></rect>
                <text class="amount${Math.round(v) < 0 ? ' neg' : ''}" x="${cx}" y="${amountY}" text-anchor="middle">${dollar(v)}</text>
                <text class="label" x="${cx}" y="${LABEL_Y}" text-anchor="middle">${cat.label}</text>
                <text class="stat" x="${cx}" y="${STAT_Y}" text-anchor="middle">${rawStat(cat, stats)}</text>${att}
            </g>`;
        }).join('');
        return `<svg class="pm-chart" viewBox="0 0 ${CW} ${CH}" role="img" aria-label="9-category value and projected per-game stats">
            <line x1="${startX - 6}" y1="${BASE_Y}" x2="${CW - startX + 6}" y2="${BASE_Y}" class="baseline" />
            <line x1="${startX - 6}" y1="${LABEL_Y + 6}" x2="${CW - startX + 6}" y2="${LABEL_Y + 6}" class="divider" />
            ${bars}
        </svg>`;
    }

    // "Sat, Oct 24, 10:23 AM", like ESPN's Recent News.
    const newsTime = (iso) =>
        iso ? new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

    function newsHtml(items) {
        if (!items.length) return '<div class="pm-empty">No recent news.</div>';
        return items
            .map(
                (n) => `<article class="pm-news">
                    <div class="pm-news-meta"><span>${escapeHtml(newsTime(n.published))}</span><span>${escapeHtml(n.source)}</span></div>
                    <div class="pm-news-headline">${escapeHtml(n.headline)}</div>
                    ${n.story ? `<div class="pm-news-story">${escapeHtml(n.story.replace(/<[^>]+>/g, ''))}</div>` : ''}
                </article>`
            )
            .join('');
    }

    function valueHtml(player) {
        const value = player?.categoryValue?.[WINDOW];
        const stats = player?.stats?.[WINDOW];
        if (!value || value.total == null) return '<div class="pm-empty">No FantasyPros ROS projection.</div>';
        return chartSvg(value, stats);
    }

    function headerMeta(player) {
        const stats = player?.stats?.[WINDOW];
        const total = player?.categoryValue?.[WINDOW]?.total;
        const bits = [];
        if (total != null) bits.push(`<span class="pm-total${Math.round(total) < 0 ? ' neg' : ''}">${dollar(total)}</span> per game`);
        if (stats) bits.push(`${fmt1(stats.minutesPerGame)} mpg`, `${Math.round(stats.gamesPlayed ?? 0)} games left`);
        return bits.join('<span class="pm-sep">&middot;</span>');
    }

    // ---------- modal ----------

    const CSS = `
        .player { color: inherit; font-weight: 700; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; cursor: pointer; }
        .pm-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(10, 12, 16, 0.5); display: flex; align-items: flex-end; justify-content: center; }
        .pm-sheet {
            --pm-bg: #ffffff; --pm-border: #dde1e8; --pm-text: #14181f; --pm-text2: #4c5563; --pm-muted: #8890a0; --pm-danger: #c0392b; --pm-success: #006300;
            width: 100%; max-width: min(640px, 100vw); min-width: 0; max-height: 88vh; overflow-y: auto; box-sizing: border-box;
            background: var(--pm-bg); color: var(--pm-text); border-radius: 16px 16px 0 0; padding: 16px 16px 28px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.45;
            box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.25);
        }
        @media (prefers-color-scheme: dark) {
            .pm-sheet { --pm-bg: #1b1f27; --pm-border: #2e3440; --pm-text: #eef1f5; --pm-text2: #b8c0cc; --pm-muted: #8a93a3; --pm-danger: #ff6b5e; --pm-success: #5fd068; }
        }
        .pm-head { display: flex; gap: 12px; align-items: center; }
        .pm-head img { width: 64px; height: 47px; object-fit: cover; border-radius: 8px; background: var(--pm-border); flex: none; }
        .pm-titles { flex: 1; min-width: 0; }
        .pm-name { font-size: 18px; font-weight: 800; }
        .pm-sub { font-size: 13px; color: var(--pm-muted); }
        .pm-meta { font-size: 13px; color: var(--pm-muted); margin-top: 2px; }
        .pm-total { font-weight: 800; color: var(--pm-success); }
        .pm-total.neg { color: var(--pm-danger); }
        .pm-sep { margin: 0 6px; }
        .pm-close { flex: none; align-self: flex-start; border: 0; background: transparent; color: var(--pm-muted); font-size: 26px; line-height: 1; padding: 4px 6px; cursor: pointer; }
        .pm-section { margin-top: 18px; }
        .pm-section h3 { margin: 0 0 6px; font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--pm-muted); }
        .pm-chart { display: block; width: 100%; height: auto; }
        .pm-chart .baseline, .pm-chart .divider { stroke: var(--pm-border); stroke-width: 1; }
        .pm-chart .amount { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; font-weight: 600; fill: var(--pm-text); }
        .pm-chart .amount.neg { fill: var(--pm-danger); }
        .pm-chart .label { font-size: 11px; font-weight: 800; letter-spacing: 0.02em; fill: var(--pm-muted); }
        .pm-chart .stat { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; font-weight: 700; fill: var(--pm-text); }
        .pm-chart .att { font-size: 10px; fill: var(--pm-muted); }
        .pm-news { padding: 10px 0; border-top: 1px solid var(--pm-border); }
        .pm-news:first-child { border-top: 0; padding-top: 2px; }
        .pm-news-meta { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--pm-muted); margin-bottom: 4px; }
        .pm-news-headline { font-weight: 700; margin-bottom: 4px; }
        .pm-news-story { color: var(--pm-text2); font-size: 14px; }
        .pm-empty { font-style: italic; color: var(--pm-muted); padding: 8px 0; }
        .pm-empty.error { color: var(--pm-danger); font-style: normal; }
        body.pm-open { overflow: hidden; }
    `;

    let backdrop = null;
    let openToken = 0;

    function close() {
        backdrop?.remove();
        backdrop = null;
        document.body.classList.remove('pm-open');
        openToken++;
    }

    async function open(el) {
        close();
        const token = ++openToken;
        const name = el.dataset.name || el.textContent.trim();
        const team = el.dataset.team || '';
        backdrop = document.createElement('div');
        backdrop.className = 'pm-backdrop';
        backdrop.innerHTML = `<div class="pm-sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(name)}">
            <div class="pm-head">
                <img alt="" hidden>
                <div class="pm-titles"><div class="pm-name">${escapeHtml(name)}</div><div class="pm-sub">${escapeHtml(team)}</div><div class="pm-meta"></div></div>
                <button class="pm-close" type="button" aria-label="Close">&times;</button>
            </div>
            <section class="pm-section"><h3>9-Cat Value &middot; FantasyPros ROS per game</h3><div class="pm-value"><div class="pm-empty">Loading&hellip;</div></div></section>
            <section class="pm-section"><h3>Latest news</h3><div class="pm-newslist"><div class="pm-empty">Loading&hellip;</div></div></section>
        </div>`;
        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop || event.target.closest('.pm-close')) close();
        });
        document.body.appendChild(backdrop);
        document.body.classList.add('pm-open');

        const $ = (sel) => backdrop?.querySelector(sel);
        let player;
        try {
            player = await fetchPlayer(name, team);
        } catch (error) {
            if (token !== openToken) return;
            $('.pm-value').innerHTML = `<div class="pm-empty error">Couldn't load projections: ${escapeHtml(error.message)}</div>`;
            $('.pm-newslist').innerHTML = '<div class="pm-empty">No player id, so no news.</div>';
            return;
        }
        if (token !== openToken) return;
        if (!player) {
            $('.pm-value').innerHTML = '<div class="pm-empty">Player not found in the projection pool.</div>';
            $('.pm-newslist').innerHTML = '<div class="pm-empty">No player id, so no news.</div>';
            return;
        }
        $('.pm-sub').textContent = [player.team, player.position].filter(Boolean).join(' · ');
        $('.pm-meta').innerHTML = headerMeta(player);
        if (player.headshotUrl) {
            const img = $('.pm-head img');
            img.src = player.headshotUrl;
            img.hidden = false;
        }
        $('.pm-value').innerHTML = valueHtml(player);
        try {
            const news = await fetchNews(player.playerId);
            if (token === openToken) $('.pm-newslist').innerHTML = newsHtml(news);
        } catch (error) {
            if (token === openToken) $('.pm-newslist').innerHTML = `<div class="pm-empty error">Couldn't load news: ${escapeHtml(error.message)}</div>`;
        }
    }

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    document.addEventListener('click', (event) => {
        const el = event.target.closest?.('.player');
        if (!el) return;
        event.preventDefault();
        open(el);
    });
    document.addEventListener('keydown', (event) => event.key === 'Escape' && close());
})();
