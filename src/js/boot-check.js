/* BOOT CHECK: shows any startup failure on screen (phones have no console). Tap the red box to hide it. */
(function () {
  var box = null, notes = [], seen = {}, t0 = Date.now();
  function show(msg) {
    try {
      if (!box) {
        box = document.createElement('div');
        box.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:2147483647;background:#7f1d1d;color:#fff;font:12px/1.45 monospace;padding:10px 12px;border-radius:8px;white-space:pre-wrap;word-break:break-word;max-height:70vh;overflow:auto;box-shadow:0 4px 18px rgba(0,0,0,.5)';
        box.onclick = function () { box.style.display = 'none'; };
        box.textContent = 'BOSOM build 2.81 hit a problem. Screenshot this for Claude:\n';
        (document.body || document.documentElement).appendChild(box);
        notes.forEach(function (n) { box.textContent += '\n  (note) ' + n; }); notes = [];
      }
      box.style.display = 'block';
      box.textContent += '\n• ' + msg;
    } catch (e) {}
  }
  function fmt(args) { return Array.prototype.map.call(args, function (a) { return a && a.stack ? a.stack.split('\n').slice(0, 3).join(' | ') : String(a); }).join(' ').slice(0, 400); }
  window.__bosomShowError = show;
  window.addEventListener('error', function (e) {
    if (e && e.target && e.target !== window && e.target.tagName) { // a file failed to load: only our own scripts matter (fonts etc. are optional)
      if (e.target.tagName === 'SCRIPT' && e.target.src && e.target.src.indexOf(location.host) >= 0) show('Could not load script ' + e.target.src.slice(-60));
      return;
    }
    var k = (e.message || 'Error') + '  @ line ' + (e.lineno || '?') + ':' + (e.colno || '?'); if (!seen[k]) { seen[k] = 1; show(k); }
  }, true);
  window.addEventListener('unhandledrejection', function (e) { var r = e && e.reason; show('Promise: ' + (r && (r.stack || r.message) || r)); });
  var oe = console.error, ow = console.warn;
  console.error = function () { try { var m = fmt(arguments); if (m.indexOf('Failed to load resource') < 0 && !seen[m.slice(0, 120)]) { seen[m.slice(0, 120)] = 1; show('ERROR: ' + m); } } catch (e) {} return oe && oe.apply(console, arguments); };
  console.warn = function () { try { if (Date.now() - t0 < 30000) { var m = 'warn: ' + fmt(arguments); if (box) show(m); else notes.push(m); } } catch (e) {} return ow && ow.apply(console, arguments); };
  // web font: injected by script so it can never hold up the page (a stalled request just leaves monospace in place)
  try {
    var lf = document.createElement('link'); lf.rel = 'stylesheet'; lf.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
    (document.head || document.documentElement).appendChild(lf);
  } catch (e) {}
  function watchdog() {
    setTimeout(function () {
      if (window.__bosomBooted) return;
      var kb = Math.round(document.documentElement.outerHTML.length / 1024);
      show('The game code never finished starting.\nPage received: ' + kb + ' KB (the full build is about 4003 KB).\n' + (kb < 4003 * 0.97 ? 'The page arrived INCOMPLETE — the upload or download got cut off. Re-upload index.html.' : 'The page arrived complete, so the error above is the cause.'));
    }, 6000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchdog); else watchdog();
})();
