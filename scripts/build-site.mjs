import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const logsDir = path.join(root, 'content', 'logs');
const siteDir = path.join(root, '_site');
const assetsDir = path.join(siteDir, 'assets');

function listLogJsonFiles(baseDir) {
  const out = [];
  if (!fs.existsSync(baseDir)) return out;
  const monthDirs = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const dirent of monthDirs) {
    if (!dirent.isDirectory()) continue;
    const monthPath = path.join(baseDir, dirent.name);
    const files = fs.readdirSync(monthPath, { withFileTypes: true });
    for (const entry of files) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        out.push(path.join(monthPath, entry.name));
      }
    }
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function parseYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m, d };
}

function isValidYmd(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const { y, m, d } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function ymdToEpochDay(ymd) {
  const { y, m, d } = parseYmd(ymd);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function epochDayToYmd(epochDay) {
  const dt = new Date(epochDay * 86400000);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayInJst() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function startOfWeekMonday(epochDay) {
  const mondayBasedDow = (epochDay + 3) % 7;
  return epochDay - mondayBasedDow;
}

function escapeHtml(input) {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function nl2brSafe(input) {
  return escapeHtml(input).replace(/\n/g, '<br>');
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function toshinKomaFromLog(log) {
  if (Number.isInteger(log.toshinKoma) && log.toshinKoma >= 0) return log.toshinKoma;
  if (!Array.isArray(log.toshin)) return 0;
  return log.toshin.reduce((sum, item) => {
    const k = Number.isInteger(item?.koma) ? item.koma : 0;
    return sum + Math.max(0, k);
  }, 0);
}

function normalizeLog(json) {
  return {
    date: json.date,
    plan: typeof json.plan === 'string' ? json.plan : '',
    notes: typeof json.notes === 'string' ? json.notes : '',
    toshinKoma: toshinKomaFromLog(json),
    hasStudy: Array.isArray(json.study) && json.study.length > 0
  };
}

function loadLogs() {
  if (!fs.existsSync(logsDir)) return [];
  const files = listLogJsonFiles(logsDir);

  const logs = [];
  for (const full of files) {
    const json = JSON.parse(fs.readFileSync(full, 'utf8'));
    if (!isValidYmd(json.date)) continue;
    logs.push(normalizeLog(json));
  }

  logs.sort((a, b) => a.date.localeCompare(b.date));
  return logs;
}

function renderDayCard(ymd, log) {
  const dt = new Date(Date.UTC(...Object.values(parseYmd(ymd)).map((n, idx) => (idx === 1 ? n - 1 : n))));
  const wday = new Intl.DateTimeFormat('ja-JP', {
    weekday: 'short',
    timeZone: 'UTC'
  }).format(dt);

  const koma = log ? log.toshinKoma : 0;
  const plan = log?.plan
    ? `<p class="plan">${nl2brSafe(log.plan)}</p>`
    : '<p class="empty">予定なし</p>';

  return `<article class="day-card" data-date="${ymd}">
    <button class="day-card-trigger" type="button" data-date="${ymd}" aria-controls="week-detail" aria-expanded="false">
      <h3>${ymd} (${wday})</h3>
      <p class="koma"><strong>${koma}</strong><span>コマ</span></p>
      ${plan}
    </button>
  </article>`;
}

function renderLayout({ title, navToday, body, basePath }) {
  const todayLink = navToday
    ? `<a href="${basePath}day/${navToday}/">Today</a>`
    : '<span class="muted">Today</span>';

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${basePath}assets/style.css">
</head>
<body>
  <header class="site-header">
    <h1>Study Record</h1>
    <nav>
      <a href="${basePath}index.html">Week</a>
      <a href="${basePath}month.html">Month</a>
      ${todayLink}
    </nav>
  </header>
  <main>${body}</main>
</body>
</html>`;
}

function buildWeekPage(logMap, todayYmd) {
  const todayEpoch = ymdToEpochDay(todayYmd);
  const weekStart = startOfWeekMonday(todayEpoch);
  const weekDates = Array.from({ length: 7 }, (_, i) => epochDayToYmd(weekStart + i));
  const weekLogs = weekDates.map((d) => logMap.get(d) || { date: d, plan: '', notes: '', toshinKoma: 0, hasStudy: false });

  const totalKoma = weekLogs.reduce((sum, log) => sum + log.toshinKoma, 0);
  const recordedDays = weekLogs.filter((log) => log.toshinKoma > 0).length;
  const cards = weekDates.map((d) => renderDayCard(d, logMap.get(d))).join('');
  const weekPayload = {
    today: todayYmd,
    days: weekDates.map((date) => {
      const log = logMap.get(date);
      return {
        date,
        toshinKoma: log ? log.toshinKoma : 0,
        plan: log?.plan || '',
        notes: log?.notes || ''
      };
    })
  };

  return renderLayout({
    title: 'Week | Study Record',
    navToday: logMap.has(todayYmd) ? todayYmd : null,
    basePath: '',
    body: `
<section class="panel hero">
  <p class="caption">${weekDates[0]} - ${weekDates[6]} (JST)</p>
  <div class="hero-metrics">
    <div><p>今週合計</p><strong>${totalKoma} コマ</strong></div>
    <div><p>記録日数</p><strong>${recordedDays} / 7 日</strong></div>
  </div>
</section>
<section class="week-strip">${cards}</section>
<section id="week-detail" class="panel day-detail" aria-live="polite"></section>
<script id="week-data" type="application/json">${jsonForScript(weekPayload)}</script>
<script src="assets/week.js"></script>`
  });
}

function buildMonthPage(logs, logMap, todayYmd) {
  const months = new Set();
  for (const log of logs) months.add(log.date.slice(0, 7));
  months.add(todayYmd.slice(0, 7));
  const monthList = [...months].sort();

  const payload = {
    today: todayYmd,
    months: monthList,
    logs: logs.map((log) => ({
      date: log.date,
      hasStudy: log.hasStudy,
      hasToshin: log.toshinKoma > 0
    }))
  };

  const monthOptions = monthList.map((m) => `<option value="${m}">${m}</option>`).join('');

  return renderLayout({
    title: 'Month | Study Record',
    navToday: logMap.has(todayYmd) ? todayYmd : null,
    basePath: '',
    body: `
<section class="panel">
  <h2>Month</h2>
  <p class="caption">記録あり: ● / 東進コマあり: ●（赤）</p>
  <label for="month-select">月を選択:</label>
  <select id="month-select">${monthOptions}</select>
  <div id="calendar" class="calendar"></div>
</section>
<script id="month-data" type="application/json">${jsonForScript(payload)}</script>
<script src="assets/month.js"></script>`
  });
}

function buildDayPage(log, todayYmd) {
  const plan = log.plan ? `<p>${nl2brSafe(log.plan)}</p>` : '<p class="empty">予定なし</p>';
  const notes = log.notes ? `<p>${nl2brSafe(log.notes)}</p>` : '<p class="empty">メモなし</p>';

  return renderLayout({
    title: `${log.date} | Study Record`,
    navToday: todayYmd,
    basePath: '../../',
    body: `
<section class="panel">
  <h2>${log.date}</h2>
  <section><h3>進めたコマ数</h3><p class="koma-inline"><strong>${log.toshinKoma}</strong><span>コマ</span></p></section>
  <section><h3>予定</h3>${plan}</section>
  <section><h3>メモ</h3>${notes}</section>
</section>`
  });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyStaticAssets() {
  ensureDir(assetsDir);
  fs.copyFileSync(path.join(root, 'site', 'style.css'), path.join(assetsDir, 'style.css'));
  fs.copyFileSync(path.join(root, 'site', 'month.js'), path.join(assetsDir, 'month.js'));
  fs.copyFileSync(path.join(root, 'site', 'week.js'), path.join(assetsDir, 'week.js'));
}

function build() {
  const logs = loadLogs();
  const logMap = new Map(logs.map((log) => [log.date, log]));
  const todayYmd = todayInJst();

  fs.rmSync(siteDir, { recursive: true, force: true });
  ensureDir(siteDir);

  copyStaticAssets();

  fs.writeFileSync(path.join(siteDir, 'index.html'), buildWeekPage(logMap, todayYmd));
  fs.writeFileSync(path.join(siteDir, 'month.html'), buildMonthPage(logs, logMap, todayYmd));

  for (const log of logs) {
    const outDir = path.join(siteDir, 'day', log.date);
    ensureDir(outDir);
    fs.writeFileSync(path.join(outDir, 'index.html'), buildDayPage(log, logMap.has(todayYmd) ? todayYmd : log.date));
  }

  fs.writeFileSync(
    path.join(siteDir, '404.html'),
    renderLayout({
      title: 'Not Found | Study Record',
      navToday: logMap.has(todayYmd) ? todayYmd : null,
      basePath: '',
      body: '<section class="panel"><h2>ページが見つかりません</h2><p><a href="index.html">トップへ戻る</a></p></section>'
    })
  );

  console.log(`Built ${logs.length} day page(s) into _site`);
}

build();
