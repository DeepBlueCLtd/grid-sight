/**
 * Shared demo navigation (spec 014 review follow-up).
 *
 * Single source of truth for the cross-demo nav bar. Each demo page drops a
 * `<nav data-gs-demo-nav></nav>` placeholder and includes this script; the list
 * below is rendered into it with the current page promoted to plain text.
 * Adding a future demo means editing only this file.
 *
 * Hrefs are resolved against the `/demo/` segment of the current URL, so the
 * same script works from every demo depth (sliders/*, toggle/*, virtual-
 * columns.html, freeze-panes/index.html, …) and from any mount point
 * (`/grid-sight/…`, site root, or `file://`).
 */
(function () {
  var DEMOS = [
    { path: 'sliders/interpolation.html', label: '1. Interpolation' },
    { path: 'sliders/alternate-calc-models.html', label: '2. Alternate calc models' },
    { path: 'sliders/synced-tables.html', label: '3. Persistent URL' },
    { path: 'toggle/live-enrichments.html', label: '4. Live toggles' },
    { path: 'toggle/opt-in-playground.html', label: '5. Opt-in playground' },
    { path: 'virtual-columns.html', label: '6. Virtual columns' },
    { path: 'annotations/index.html', label: '7. Cell annotations' },
    { path: 'outlier/measurements.html', label: '8. Outlier marker' },
    { path: 'freeze-panes/index.html', label: '9. Freeze panes' },
    { path: 'statistics/index.html', label: '10. Statistics' },
    { path: 'summary-row/index.html', label: '11. Summary row' },
    { path: 'find-in-table/index.html', label: '12. Find in table' }
  ];

  var STYLE_ID = 'gs-demo-nav-styles';
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '[data-gs-demo-nav]{margin:0 0 24px;padding:8px 0;border-top:1px solid #ddd;' +
      'border-bottom:1px solid #ddd;font-size:14px;line-height:1.8}' +
      '[data-gs-demo-nav] strong{margin-right:6px}' +
      '[data-gs-demo-nav] a{color:#1976d2;text-decoration:none}' +
      '[data-gs-demo-nav] a:hover{text-decoration:underline}' +
      '[data-gs-demo-nav] [aria-current="page"]{color:#222;font-weight:600}';
    document.head.appendChild(s);
  }

  function render() {
    var host = document.querySelector('[data-gs-demo-nav]');
    if (!host) return;
    ensureStyles();

    var pathname = location.pathname;
    var marker = '/demo/';
    var idx = pathname.indexOf(marker);
    // Fall back to a trailing 'demo/' (e.g. file:// without a leading slash).
    if (idx < 0) {
      var alt = pathname.lastIndexOf('demo/');
      idx = alt < 0 ? -1 : alt - 1;
    }
    if (idx < 0) return;

    var demoRoot = pathname.slice(0, idx + marker.length); // …/demo/
    var siteRoot = pathname.slice(0, idx + 1);              // …/ (landing dir)
    var current = pathname.slice(demoRoot.length);          // e.g. sliders/x.html

    var html = '<strong>Grid-Sight demos:</strong> <a href="' + siteRoot + '">Home</a>';
    for (var i = 0; i < DEMOS.length; i++) {
      var d = DEMOS[i];
      html += ' · ';
      if (current === d.path) {
        html += '<span aria-current="page">' + d.label + '</span>';
      } else {
        html += '<a href="' + demoRoot + d.path + '">' + d.label + '</a>';
      }
    }
    host.innerHTML = html;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
