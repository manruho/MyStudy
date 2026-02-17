(function () {
  const dataEl = document.getElementById('week-data');
  const detailEl = document.getElementById('week-detail');
  if (!dataEl || !detailEl) return;

  const payload = JSON.parse(dataEl.textContent);
  const byDate = new Map(payload.days.map((day) => [day.date, day]));
  const cards = Array.from(document.querySelectorAll('.day-card'));

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

  function setActive(date) {
    const day = byDate.get(date);
    if (!day) return;

    cards.forEach((card) => {
      const selected = card.dataset.date === date;
      card.classList.toggle('is-active', selected);
      const trigger = card.querySelector('.day-card-trigger');
      if (trigger) trigger.setAttribute('aria-expanded', selected ? 'true' : 'false');
    });

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

  document.querySelector('.week-strip')?.addEventListener('click', function (event) {
    const trigger = event.target.closest('.day-card-trigger');
    if (!trigger) return;
    setActive(trigger.dataset.date);
  });

  const defaultDate = byDate.has(payload.today) ? payload.today : payload.days[0]?.date;
  if (defaultDate) setActive(defaultDate);
})();
