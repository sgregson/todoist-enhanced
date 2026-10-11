/*
  Never inside another site's frame.

  A page that frames this one can lay its own buttons over it and have a
  click land on Delete. The Content-Security-Policy's frame-ancestors 'none'
  refuses the frame, but only where the host sends it as a header (Apache,
  Vercel, Netlify): the <meta> copy of the policy cannot carry it, so on
  GitHub Pages this is the guard. A framed copy is hidden before the body is
  drawn, leaving nothing to click, and asks to take the whole window.
*/
if (window.top !== window.self) {
  document.documentElement.style.setProperty('display', 'none', 'important');
  try {
    window.top.location.replace(window.self.location.href);
  } catch { /* A sandboxed or cross-origin frame cannot be left; it stays hidden. */ }
}

/*
  The theme, before the first paint.

  Preferences live in IndexedDB and arrive a moment after the page does.
  Without this the app opens white and turns dark once they load, which
  is a flash of the wrong theme on every single launch. Only the choice
  is stored; "system" is still resolved against the device here, the
  same way the app resolves it afterwards.
*/
try {
  var choice = localStorage.getItem('theme');
  var dark = choice === 'dark' ||
    (choice !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  /* The accent, for the same reason: a red flash before the green
     arrives is the same wrong first paint in a different colour. */
  var accent = localStorage.getItem('accent');
  if (accent) document.documentElement.dataset.accent = accent;
  /* And the frame (layout and background), for the same reason. */
  var layout = localStorage.getItem('layout');
  if (layout) document.documentElement.dataset.layout = layout;
  var backdrop = localStorage.getItem('backdrop');
  if (backdrop) document.documentElement.style.setProperty('--back-gradient', backdrop);
  var background = localStorage.getItem('background');
  if (background) document.documentElement.dataset.background = background;
  /* A custom accent is not in the stylesheet — it is computed from one
     colour. Both schemes were worked out and stored when it was chosen,
     so the right one can be written here without repeating the recipe. */
  if (accent === 'custom') {
    var vars = JSON.parse(localStorage.getItem('accentVars') || 'null');
    var set = vars && vars[dark ? 'dark' : 'light'];
    for (var token in set) {
      document.documentElement.style.setProperty('--' + token, set[token]);
    }
  }
} catch { /* Storage may be unavailable; keep the default theme. */ }
