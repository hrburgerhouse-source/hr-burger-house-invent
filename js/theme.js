(function () {
  const DARK = 'dark';
  const LIGHT = 'light';
  const KEY = 'hrb-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = theme === DARK ? '☀️' : '🌙';
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || LIGHT;
    const next = current === DARK ? LIGHT : DARK;
    localStorage.setItem(KEY, next);
    applyTheme(next);
  }

  // Apply saved theme immediately (before paint)
  const saved = localStorage.getItem(KEY) || LIGHT;
  applyTheme(saved);

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.textContent = saved === DARK ? '☀️' : '🌙';
      btn.addEventListener('click', toggleTheme);
    }
  });
})();
