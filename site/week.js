(function () {
  const dataEl = document.getElementById('week-data');
  const detailEl = document.getElementById('week-detail');
  const stripEl = document.getElementById('week-strip');
  const rangeEl = document.getElementById('week-range');
  const totalEl = document.getElementById('week-total-koma');
  const recordedEl = document.getElementById('week-recorded-days');
  const prevBtn = document.getElementById('week-prev');
  const nextBtn = document.getElementById('week-next');
  if (!dataEl || !detailEl || !stripEl || !rangeEl || !totalEl || !recordedEl || !prevBtn || !nextBtn) return;

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

  function renderCard(date, log, selected) {
    const koma = log ? log.toshinKoma : 0;
    const plan = log?.plan ? `<p class="plan">${nl2brSafe(log.plan)}</p>` : '<p class="empty">予定なし</p>';
    const activeClass = selected ? ' is-active' : '';
    const expanded = selected ? 'true' : 'false';
    return `<article class="day-card${activeClass}" data-date="${date}">
      <button class="day-card-trigger" type="button" data-date="${date}" aria-controls="week-detail" aria-expanded="${expanded}">
        <h3>${date} (${formatWday(date)})</h3>
        <p class="koma"><strong>${koma}</strong><span>コマ</span></p>
        ${plan}
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
    if (offset === 0) {
      url.searchParams.delete('w');
    } else {
      url.searchParams.set('w', String(offset));
    }
    window.history.replaceState({}, '', url);
  }

  function setActive(date) {
    const day = byDate.get(date) || { date, toshinKoma: 0, plan: '', notes: '' };

    const plan = day.plan ? `<p>${nl2brSafe(day.plan)}</p>` : '<p class="empty">予定なし</p>';
    const notes = day.notes ? `<p>${nl2brSafe(day.notes)}</p>` : '<p class="empty">メモなし</p>';

    detailEl.innerHTML = `
      <div class="detail-head">
        <h2>${escapeHtml(day.date)} の詳細</h2>
        <a href="day/${escapeHtml(day.date)}/">日別ページを開く</a>
      </div>
      <section><h3>進めたコマ数</h3><p class="koma-inline"><strong>${day.toshinKoma}</strong><span>コマ</span></p></section>
      <section><h3>予定</h3>${plan}</section>
      <section><h3>メモ</h3>${notes}</section>
    `;
    detailEl.classList.add('is-active');
  }

  function renderWeek() {
    const dates = weekDates(offset);
    const logs = dates.map((d) => byDate.get(d) || { date: d, toshinKoma: 0, plan: '', notes: '' });

    const totalKoma = logs.reduce((sum, log) => sum + log.toshinKoma, 0);
    const recordedDays = logs.filter((log) => log.toshinKoma > 0).length;

    rangeEl.textContent = `${dates[0]} - ${dates[6]} (JST)`;
    totalEl.textContent = `${totalKoma} コマ`;
    recordedEl.textContent = `${recordedDays} / 7 日`;

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
