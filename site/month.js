(function () {
  const dataEl = document.getElementById('month-data');
  if (!dataEl) return;

  const payload = JSON.parse(dataEl.textContent);
  const logsByDate = new Map(payload.logs.map((log) => [log.date, log]));
  const calendar = document.getElementById('calendar');
  const select = document.getElementById('month-select');

  const dayHeaders = ['月', '火', '水', '木', '金', '土', '日'];

  function ymd(y, m, d) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function render(monthValue) {
    const [year, month] = monthValue.split('-').map(Number);
    const first = new Date(Date.UTC(year, month - 1, 1));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const mondayStartOffset = (first.getUTCDay() + 6) % 7;

    const cells = [];
    for (const head of dayHeaders) {
      cells.push(`<div class="head">${head}</div>`);
    }

    for (let i = 0; i < mondayStartOffset; i += 1) {
      cells.push('<div class="cell"></div>');
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = ymd(year, month, day);
      const log = logsByDate.get(date);

      const hasStudyOrToshin = Boolean(log && (log.hasStudy || log.hasToshin));
      const hasToshin = Boolean(log && log.hasToshin);

      const dots = hasStudyOrToshin
        ? `<span class="dot"></span>${hasToshin ? '<span class="dot toshin"></span>' : ''}`
        : '';

      const content = `<div class="day-num">${day}</div><div class="dot-wrap">${dots}</div>`;
      const body = log ? `<a href="day/${date}/">${content}</a>` : content;

      cells.push(`<div class="cell">${body}</div>`);
    }

    calendar.innerHTML = cells.join('');
  }

  const search = new URLSearchParams(window.location.search);
  const qMonth = search.get('m');
  const defaultMonth = payload.months.includes(qMonth) ? qMonth : payload.today.slice(0, 7);

  if (payload.months.length > 0) {
    select.value = payload.months.includes(defaultMonth) ? defaultMonth : payload.months[payload.months.length - 1];
  }

  render(select.value);

  select.addEventListener('change', function (event) {
    const m = event.target.value;
    render(m);
    const url = new URL(window.location.href);
    url.searchParams.set('m', m);
    window.history.replaceState({}, '', url);
  });
})();
