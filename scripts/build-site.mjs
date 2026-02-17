import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const logsDir = path.join(root, 'content', 'logs');
const siteDir = path.join(root, '_site');
const assetsDir = path.join(siteDir, 'assets');

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

function subjectClassName(subject) {
  const normalized = subject
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-');
  return `subject-${normalized || 'other'}`;
}

function loadLogs() {
  if (!fs.existsSync(logsDir)) return [];
  const files = fs
    .readdirSync(logsDir)
    .filter((name) => name.endsWith('.json'))
    .sort();

  const logs = [];
  for (const file of files) {
    const full = path.join(logsDir, file);
    const json = JSON.parse(fs.readFileSync(full, 'utf8'));
    if (!isValidYmd(json.date)) continue;
    logs.push(json);
  }

  logs.sort((a, b) => a.date.localeCompare(b.date));
  return logs;
}

function aggregateWeek(weekLogs) {
  const recordDays = weekLogs.filter((log) => log.study.length > 0 || log.toshin.length > 0).length;
  const studyDays = weekLogs.filter((log) => log.study.length > 0).length;
  const toshinDays = weekLogs.filter((log) => log.toshin.length > 0).length;

  const focusCounts = new Map();
  const toshinBySubject = new Map();

  for (const log of weekLogs) {
    for (const item of log.study) {
      const key = item.focus.trim();
      focusCounts.set(key, (focusCounts.get(key) || 0) + 1);
    }
    for (const item of log.toshin) {
      const key = item.subject.trim();
      toshinBySubject.set(key, (toshinBySubject.get(key) || 0) + item.koma);
    }
  }

  const topFocus = [...focusCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
    .slice(0, 5);

  const toshinSummary = [...toshinBySubject.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));

  return { recordDays, studyDays, toshinDays, topFocus, toshinSummary };
}

function renderDayCard(ymd, log) {
  const dt = new Date(Date.UTC(...Object.values(parseYmd(ymd)).map((n, idx) => (idx === 1 ? n - 1 : n))));
  const wday = new Intl.DateTimeFormat('ja-JP', {
    weekday: 'short',
    timeZone: 'UTC'
  }).format(dt);

  const header = `<h3><a href="day/${ymd}/">${ymd} (${wday})</a></h3>`;

  const studyBlock = log && log.study.length > 0
    ? `<ul>${log.study
        .map(
          (item) =>
            `<li><strong>${escapeHtml(item.subject)} / ${escapeHtml(item.focus)}</strong><p>${nl2brSafe(item.detail)}</p></li>`
        )
        .join('')}</ul>`
    : '<p class="empty">自学記録なし</p>';

  const toshinBlock = log && log.toshin.length > 0
    ? `<ul class="toshin-list">${log.toshin
        .map((item) => {
          const klass = subjectClassName(item.subject);
          const memo = item.memo ? `<p>${nl2brSafe(item.memo)}</p>` : '';
          return `<li class="toshin-item ${klass}"><strong>${escapeHtml(item.subject)} / ${escapeHtml(item.course)} / ${item.koma}コマ</strong>${memo}</li>`;
        })
        .join('')}</ul>`
    : '<p class="empty">東進記録なし</p>';

  const notesBlock = log && log.notes
    ? `<details><summary>メモ</summary><p>${nl2brSafe(log.notes)}</p></details>`
    : '';

  return `<article class="day-card">${header}<section><h4>自学</h4>${studyBlock}</section><section><h4>東進</h4>${toshinBlock}</section>${notesBlock}</article>`;
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
    <h1>学習記録サイト</h1>
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
  const weekLogs = weekDates.map((d) => logMap.get(d) || { date: d, notes: '', study: [], toshin: [] });
  const summary = aggregateWeek(weekLogs);

  const focusHtml = summary.topFocus.length
    ? `<ol>${summary.topFocus.map(([focus, count]) => `<li>${escapeHtml(focus)} (${count})</li>`).join('')}</ol>`
    : '<p class="empty">なし</p>';

  const toshinHtml = summary.toshinSummary.length
    ? `<ul>${summary.toshinSummary.map(([subject, koma]) => `<li>${escapeHtml(subject)}: ${koma}コマ</li>`).join('')}</ul>`
    : '<p class="empty">なし</p>';

  const cards = weekDates.map((d) => renderDayCard(d, logMap.get(d))).join('');

  return renderLayout({
    title: 'Week | 学習記録サイト',
    navToday: logMap.has(todayYmd) ? todayYmd : null,
    basePath: '',
    body: `
<section class="panel">
  <h2>今週（JST / 月曜開始）</h2>
  <p class="caption">対象週: ${weekDates[0]} 〜 ${weekDates[6]}</p>
  <div class="summary-grid">
    <div><h3>記録あり</h3><p>${summary.recordDays} / 7 日</p></div>
    <div><h3>自学あり</h3><p>${summary.studyDays} 日</p></div>
    <div><h3>東進あり</h3><p>${summary.toshinDays} 日</p></div>
  </div>
  <section><h3>強化頻度 Top5</h3>${focusHtml}</section>
  <section><h3>東進 科目別コマ数</h3>${toshinHtml}</section>
</section>
<section class="week-grid">${cards}</section>`
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
      hasStudy: log.study.length > 0,
      hasToshin: log.toshin.length > 0
    }))
  };

  const monthOptions = monthList.map((m) => `<option value="${m}">${m}</option>`).join('');

  return renderLayout({
    title: 'Month | 学習記録サイト',
    navToday: logMap.has(todayYmd) ? todayYmd : null,
    basePath: '',
    body: `
<section class="panel">
  <h2>Month カレンダー</h2>
  <p class="caption">記録あり: ● / 東進あり: ●（赤）</p>
  <label for="month-select">月を選択:</label>
  <select id="month-select">${monthOptions}</select>
  <div id="calendar" class="calendar"></div>
</section>
<script id="month-data" type="application/json">${escapeHtml(JSON.stringify(payload))}</script>
<script src="assets/month.js"></script>`
  });
}

function buildDayPage(log, todayYmd) {
  const study = log.study.length
    ? `<ul>${log.study
        .map((item) => `<li><strong>${escapeHtml(item.subject)} / ${escapeHtml(item.focus)}</strong><p>${nl2brSafe(item.detail)}</p></li>`)
        .join('')}</ul>`
    : '<p class="empty">自学記録なし</p>';

  const toshin = log.toshin.length
    ? `<ul class="toshin-list">${log.toshin
        .map((item) => {
          const memo = item.memo ? `<p>${nl2brSafe(item.memo)}</p>` : '';
          const klass = subjectClassName(item.subject);
          return `<li class="toshin-item ${klass}"><strong>${escapeHtml(item.subject)} / ${escapeHtml(item.course)} / ${item.koma}コマ</strong>${memo}</li>`;
        })
        .join('')}</ul>`
    : '<p class="empty">東進記録なし</p>';

  const notes = log.notes ? `<p>${nl2brSafe(log.notes)}</p>` : '<p class="empty">メモなし</p>';

  return renderLayout({
    title: `${log.date} | 学習記録サイト`,
    navToday: todayYmd,
    basePath: '../../',
    body: `
<section class="panel">
  <h2>${log.date}</h2>
  <section><h3>自学</h3>${study}</section>
  <section><h3>東進</h3>${toshin}</section>
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
      title: 'Not Found | 学習記録サイト',
      navToday: logMap.has(todayYmd) ? todayYmd : null,
      basePath: '',
      body: '<section class="panel"><h2>ページが見つかりません</h2><p><a href="index.html">トップへ戻る</a></p></section>'
    })
  );

  console.log(`Built ${logs.length} day page(s) into _site`);
}

build();
