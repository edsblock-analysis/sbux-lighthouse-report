const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, 'reports');

const TIER_FILES = {
  '95-plus': 'dashboard-95-plus.html',
  '90-94': 'dashboard-90-94.html',
  'below-90': 'dashboard-below-90.html',
  'no-score': 'dashboard-no-score.html',
};

const STYLES = `
    :root {
      --bg: #0f1419;
      --card: #1a2332;
      --text: #e7ecf3;
      --muted: #8b9cb3;
      --accent: #3b82f6;
      --good: #22c55e;
      --mid: #eab308;
      --bad: #ef4444;
    }
    * { box-sizing: border-box; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 2rem clamp(1rem, 4vw, 3rem);
      line-height: 1.5;
    }
    h1 { font-size: 1.75rem; font-weight: 600; margin: 0 0 0.25rem; }
    .sub { color: var(--muted); font-size: 0.9rem; margin-bottom: 1rem; }
    nav.tier-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
      margin-bottom: 2rem;
      padding: 0.75rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      font-size: 0.9rem;
    }
    nav.tier-nav a {
      color: var(--accent);
      text-decoration: none;
    }
    nav.tier-nav a:hover { text-decoration: underline; }
    nav.tier-nav a.active { color: var(--text); font-weight: 600; pointer-events: none; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 1rem;
      margin-bottom: 2.5rem;
    }
    .card {
      background: var(--card);
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      border: 1px solid rgba(255,255,255,0.06);
      transition: border-color 0.15s;
    }
    a.card-wrap {
      text-decoration: none;
      color: inherit;
      display: block;
    }
    a.card-wrap:hover .card {
      border-color: rgba(59, 130, 246, 0.45);
    }
    .card .n {
      font-size: 2.25rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .card .lbl { font-size: 0.85rem; color: var(--muted); margin-top: 0.25rem; }
    .card.g95 .n { color: var(--good); }
    .card.g90 .n { color: var(--mid); }
    .card.low .n { color: var(--bad); }
    .card.na .n { color: var(--muted); }
    h2 {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0 0 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    li {
      padding: 0.6rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.5rem 1rem;
    }
    li:last-child { border-bottom: none; }
    ul a {
      color: var(--accent);
      text-decoration: none;
      word-break: break-all;
    }
    ul a:hover { text-decoration: underline; }
    .score {
      font-size: 0.85rem;
      color: var(--muted);
      white-space: nowrap;
    }
`;

function extractLighthouseJson(html) {
  const m = html.match(/window\.__LIGHTHOUSE_JSON__\s*=\s*(\{[\s\S]*?\});<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function scoreToPercent(score) {
  if (score == null || Number.isNaN(score)) return null;
  return Math.round(score * 100);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderList(rows) {
  return rows
    .map((r) => {
      const label = r.pct != null ? `${r.pct}` : '—';
      const href = encodeURI(`reports/${r.file}`);
      return `    <li><a href="${href}">${esc(r.url)}</a> <span class="score">Performance: ${label}</span></li>`;
    })
    .join('\n');
}

function tierNav(active) {
  const items = [
    ['index.html', 'Overview', active === 'index'],
    [TIER_FILES['95-plus'], '95+', active === '95-plus'],
    [TIER_FILES['90-94'], '90–94', active === '90-94'],
    [TIER_FILES['below-90'], 'Below 90', active === 'below-90'],
    [TIER_FILES['no-score'], 'No score', active === 'no-score'],
  ];
  return items
    .map(([href, label, isActive]) => {
      const cls = isActive ? ' class="active"' : '';
      return `    <a href="${href}"${cls}>${label}</a>`;
    })
    .join('\n');
}

function buildDashboard() {
  if (!fs.existsSync(REPORTS_DIR)) {
    console.warn('No reports/ folder yet.');
    return;
  }

  const files = fs
    .readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith('.html') && f !== 'index.html');

  const rows = [];
  let g95 = 0;
  let g90 = 0;
  let low = 0;
  let na = 0;

  for (const file of files) {
    const filePath = path.join(REPORTS_DIR, file);
    const html = fs.readFileSync(filePath, 'utf-8');
    const json = extractLighthouseJson(html);
    const url = json?.requestedUrl || json?.finalUrl || '';
    const raw = json?.categories?.performance?.score;
    const pct = scoreToPercent(raw);

    if (pct == null) {
      na++;
    } else if (pct >= 95) {
      g95++;
    } else if (pct >= 90) {
      g90++;
    } else {
      low++;
    }

    rows.push({
      file,
      url: url || file,
      pct,
    });
  }

  const byScore = (a, b) => {
    const ap = a.pct ?? -1;
    const bp = b.pct ?? -1;
    return bp - ap;
  };

  rows.sort(byScore);

  const r95 = rows.filter((r) => r.pct != null && r.pct >= 95);
  const r90 = rows.filter((r) => r.pct != null && r.pct >= 90 && r.pct < 95);
  const rLow = rows.filter((r) => r.pct != null && r.pct < 90);
  const rNa = rows.filter((r) => r.pct == null);

  const generated = new Date().toISOString();

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Lighthouse reports dashboard</title>
  <style>${STYLES}</style>
</head>
<body>
  <h1>Lighthouse dashboard</h1>
  <p class="sub">Performance score (mobile). ${rows.length} report(s). Generated ${esc(generated)}.</p>
  <nav class="tier-nav" aria-label="Score tiers">
${tierNav('index')}
  </nav>
  <p class="sub">Click a card to open only that tier.</p>
  <div class="grid">
    <a class="card-wrap" href="${TIER_FILES['95-plus']}">
      <div class="card g95">
        <div class="n">${g95}</div>
        <div class="lbl">95+</div>
      </div>
    </a>
    <a class="card-wrap" href="${TIER_FILES['90-94']}">
      <div class="card g90">
        <div class="n">${g90}</div>
        <div class="lbl">90–94</div>
      </div>
    </a>
    <a class="card-wrap" href="${TIER_FILES['below-90']}">
      <div class="card low">
        <div class="n">${low}</div>
        <div class="lbl">Below 90</div>
      </div>
    </a>
    <a class="card-wrap" href="${TIER_FILES['no-score']}">
      <div class="card na">
        <div class="n">${na}</div>
        <div class="lbl">No score</div>
      </div>
    </a>
  </div>
  <h2>All reports</h2>
  <ul>
${renderList(rows)}
  </ul>
</body>
</html>
`;

  function tierPage(tierKey, title, tierRows) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)} — Lighthouse</title>
  <style>${STYLES}</style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <p class="sub">${tierRows.length} page(s). Generated ${esc(generated)}.</p>
  <nav class="tier-nav" aria-label="Score tiers">
${tierNav(tierKey)}
  </nav>
  <ul>
${renderList(tierRows)}
  </ul>
</body>
</html>
`;
  }

  fs.writeFileSync(path.join(__dirname, 'index.html'), indexHtml, 'utf-8');
  fs.writeFileSync(
    path.join(__dirname, TIER_FILES['95-plus']),
    tierPage('95-plus', 'Performance 95+', r95),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(__dirname, TIER_FILES['90-94']),
    tierPage('90-94', 'Performance 90–94', r90),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(__dirname, TIER_FILES['below-90']),
    tierPage('below-90', 'Performance below 90', rLow),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(__dirname, TIER_FILES['no-score']),
    tierPage('no-score', 'No performance score', rNa),
    'utf-8'
  );

  console.log(
    `Dashboard: index.html + tier pages (${rows.length} reports; 95+: ${r95.length}, 90-94: ${r90.length}, below 90: ${rLow.length}, N/A: ${rNa.length})`
  );
}

if (require.main === module) {
  buildDashboard();
}

module.exports = { buildDashboard };
