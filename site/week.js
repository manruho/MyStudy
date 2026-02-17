(function () {
  const dataEl = document.getElementById('week-data');
  const detailEl = document.getElementById('week-detail');
  const stripEl = document.getElementById('week-strip');
  const rangeEl = document.getElementById('week-range');
  const toshinDaysEl = document.getElementById('week-toshin-days');
  const detailCountEl = document.getElementById('week-detail-count');
  const prevBtn = document.getElementById('week-prev');
  const nextBtn = document.getElementById('week-next');

  if (!dataEl || !detailEl || !stripEl || !rangeEl || !toshinDaysEl || !detailCountEl || !prevBtn || !nextBtn) return;

  const payload = JSON.parse(dataEl.textContent);
  const byDate = new Map((payload.logs || []).map((day) => [day.date, day]));

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

  function parseYmd(ymd) {
    const [y, m, d] = ymd.split('-').map(Number);
    return { y, m, d };
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

  function startOfWeekMonday(epochDay) {
    const mondayBasedDow = (epochDay + 3) % 7;
    return epochDay - mondayBasedDow;
  }

  function weekDates(offset) {
    const currentWeekStart = startOfWeekMonday(ymdToEpochDay(payload.today));
    const start = currentWeekStart - offset * 7;
    return Array.from({ length: 7 }, (_, i) => epochDayToYmd(start + i));
  }

  function formatWday(ymd) {
    const { y, m, d } = parseYmd(ymd);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return new Intl.DateTimeFormat('ja-JP', { weekday: 'short', timeZone: 'UTC' }).format(dt);
  }

  function renderToshinBadges(items) {
    if (!items || items.length === 0) return '<p class="empty">東進なし</p>';
    return `<div class="subject-grid">${items.map((name) => `<span class="subject-chip">${escapeHtml(name)}</span>`).join('')}</div>`;
  }

  function renderDetailsList(details) {
    if (!details || details.length === 0) return '<p class="empty">詳細なし</p>';
    return `<ul>${details.map((item) => `<li>${nl2brSafe(item)}</li>`).join('')}</ul>`;
  }

  function renderCard(date, log, selected) {
    const activeClass = selected ? ' is-active' : '';
    const expanded = selected ? 'true' : 'false';
    return `<article class="day-card${activeClass}" data-date="${date}">
      <button class="day-card-trigger" type="button" data-date="${date}" aria-controls="week-detail" aria-expanded="${expanded}">
        <h3>${date} (${formatWday(date)})</h3>
        <p class="label">今日やった東進</p>
        ${renderToshinBadges(log?.toshinToday || [])}
      </button>
    </article>`;
  }

  let offset = 0;
  let selectedDate = null;

  const search = new URLSearchParams(window.location.search);
  const q = Number.parseInt(search.get('w') || '0', 10);
  if (Number.isInteger(q) && q >= 0) offset = q;

  function syncQuery() {
    const url = new URL(window.location.href);
    if (offset === 0) url.searchParams.delete('w');
    else url.searchParams.set('w', String(offset));
    window.history.replaceState({}, '', url);
  }

  function setActive(date) {
    const day = byDate.get(date) || { date, toshinToday: [], details: [] };

    detailEl.innerHTML = `
      <div class="detail-head">
        <h2>${escapeHtml(day.date)} の詳細</h2>
        <a href="day/${escapeHtml(day.date)}/">日別ページを開く</a>
      </div>
      <section><h3>今日やった東進</h3>${renderToshinBadges(day.toshinToday)}</section>
      <section><h3>今日やったこと</h3>${renderDetailsList(day.details)}</section>
    `;
    detailEl.classList.add('is-active');
  }

  function renderWeek() {
    const dates = weekDates(offset);
    const logs = dates.map((d) => byDate.get(d) || { date: d, toshinToday: [], details: [] });

    const toshinDays = logs.filter((log) => (log.toshinToday || []).length > 0).length;
    const detailCount = logs.reduce((sum, log) => sum + ((log.details || []).length), 0);

    rangeEl.textContent = `${dates[0]} - ${dates[6]} (JST)`;
    toshinDaysEl.textContent = `${toshinDays} / 7 日`;
    detailCountEl.textContent = `${detailCount} 件`;

    if (!selectedDate || !dates.includes(selectedDate)) {
      selectedDate = dates.includes(payload.today) ? payload.today : dates[0];
    }

    stripEl.innerHTML = dates.map((date) => renderCard(date, byDate.get(date), selectedDate === date)).join('');
    setActive(selectedDate);

    nextBtn.disabled = offset === 0;
    nextBtn.setAttribute('aria-disabled', offset === 0 ? 'true' : 'false');
  }

  stripEl.addEventListener('click', function (event) {
    const trigger = event.target.closest('.day-card-trigger');
    if (!trigger) return;
    selectedDate = trigger.dataset.date;
    renderWeek();
  });

  prevBtn.addEventListener('click', function () {
    offset += 1;
    selectedDate = null;
    syncQuery();
    renderWeek();
  });

  nextBtn.addEventListener('click', function () {
    if (offset === 0) return;
    offset -= 1;
    selectedDate = null;
    syncQuery();
    renderWeek();
  });

  renderWeek();
})();
