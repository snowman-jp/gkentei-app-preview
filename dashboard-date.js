(() => {
  const date = document.getElementById('dashboard-date');
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short'
  });

  function updateDate() {
    const parts = Object.fromEntries(formatter.formatToParts(new Date())
      .map(({ type, value }) => [type, value]));
    date.textContent = `${parts.year}年${parts.month}月${parts.day}日（${parts.weekday}）`;
    date.dateTime = `${parts.year}-${parts.month.padStart(2, '0')}-${parts.day.padStart(2, '0')}`;
  }

  updateDate();
  // Refresh across midnight and after returning to a suspended mobile tab.
  setInterval(updateDate, 1000);
  document.addEventListener('visibilitychange', updateDate);
  window.addEventListener('pageshow', updateDate);
})();
