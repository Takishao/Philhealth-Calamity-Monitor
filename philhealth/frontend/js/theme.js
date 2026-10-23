// Blocking head script: resolve the saved choice before CSS or the app can paint.
(() => {
  const key = 'phcm-theme';
  const choices = ['automatic', 'light', 'dark'];
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let choice = 'automatic';
  try { const saved = localStorage.getItem(key); if (choices.includes(saved)) choice = saved; } catch {}
  function apply() {
    const resolved = choice === 'automatic' ? (media.matches ? 'dark' : 'light') : choice;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themeChoice = choice;
    document.documentElement.style.colorScheme = resolved;
    window.dispatchEvent(new CustomEvent('phcm-theme-change', { detail: { choice, resolved } }));
  }
  function setChoice(value) {
    choice = choices.includes(value) ? value : 'automatic';
    try { localStorage.setItem(key, choice); } catch {}
    apply();
  }
  media.addEventListener('change', () => { if (choice === 'automatic') apply(); });
  window.addEventListener('storage', event => {
    if (event.key === key) { choice = choices.includes(event.newValue) ? event.newValue : 'automatic'; apply(); }
  });
  window.philhealthTheme = Object.freeze({ get choice() { return choice; }, setChoice });
  apply();
})();
