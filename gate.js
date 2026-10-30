/*
 * ─────────────────────────────────────────────────────────────────────────
 *  TEMPORARY "COMING SOON" PASSWORD GATE — CLIENT-SIDE ONLY
 * ─────────────────────────────────────────────────────────────────────────
 *  This keeps casual visitors and search engines off the public site until
 *  Kelly is ready to take clients. It is NOT real security: the pages are
 *  still served to anyone who disables JavaScript or fetches them directly.
 *  Never rely on it to protect private information.
 *
 *  Gated pages load this file as the FIRST thing in <head>:
 *      <script src="gate.js"></script>
 *  Gated: index, qest4, before-your-visit, intake-form, animal-intake-form.
 *  Not gated: client-portal, admin-panel (they have their own logins).
 *
 *  TO REMOVE THE GATE LATER: delete the <script src="gate.js"></script> line
 *  (and the robots "noindex, nofollow" meta tag, so search engines can list
 *  the site again) from each gated page. Then delete gate.js and
 *  coming-soon.html.
 *
 *  TO CHANGE THE PASSWORD: replace PASSWORD_SHA256 below with the SHA-256 of
 *  the new password. Get it by running this in a terminal:
 *      node -e "console.log(require('crypto').createHash('sha256').update('NewPassword').digest('hex'))"
 *  (Only the fingerprint is stored here, so the password isn't readable in the page source.)
 * ─────────────────────────────────────────────────────────────────────────
 */
(function () {
  var PASSWORD_SHA256 = '4ce781e3cb60e0db36fb1a813fa4c2e32dd31c51b941d581e0be4391b079d50c';
  var KEY = 'qfw-gate';
  var GATE_URL = '/coming-soon';

  function isUnlocked() {
    try { if (sessionStorage.getItem(KEY) === '1') return true; } catch (e) {}
    return document.cookie.split('; ').indexOf(KEY + '=1') !== -1;
  }

  // Remembered until the browser is closed (session cookie, plus sessionStorage as a fallback)
  function remember() {
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    document.cookie = KEY + '=1; path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
  }

  // Only allow redirects back to a page on this site
  function safeNext(raw) {
    return typeof raw === 'string' && /^\/(?![\/\\])/.test(raw) ? raw : '/';
  }

  function nextUrl() {
    try { return safeNext(new URLSearchParams(location.search).get('next')); } catch (e) { return '/'; }
  }

  async function check(password) {
    if (!window.crypto || !crypto.subtle) throw new Error('insecure-context');
    var bytes = new TextEncoder().encode(password);
    var digest = await crypto.subtle.digest('SHA-256', bytes);
    var hex = Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    return hex === PASSWORD_SHA256;
  }

  var script = document.currentScript;
  var onGatePage = script && script.getAttribute('data-gate') === 'page';

  if (onGatePage) {
    // coming-soon.html: already unlocked? go straight through. Otherwise expose the checker.
    if (isUnlocked()) { location.replace(nextUrl()); return; }
    window.QFWGate = {
      check: check,
      unlock: function () { remember(); location.replace(nextUrl()); }
    };
    return;
  }

  if (!isUnlocked()) {
    // Hide the page immediately so its content never flashes, then send to the gate
    document.documentElement.style.display = 'none';
    location.replace(GATE_URL + '?next=' + encodeURIComponent(location.pathname + location.search + location.hash));
  }
})();
