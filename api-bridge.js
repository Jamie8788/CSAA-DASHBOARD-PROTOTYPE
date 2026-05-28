/* API bridge — when the dashboard is served by the FastAPI backend:
 *   1. Fetches the live dataset from /api/communities and replaces
 *      window.COMMUNITIES BEFORE React mounts.
 *   2. Fetches /api/settings and /api/pages (live CMS content).
 *   3. Subscribes to /api/events (SSE) so the dashboard auto-refreshes when
 *      an admin uploads a new sheet, edits a community, or changes a page.
 *
 * Failing silently is fine: the dashboard falls back to the baked-in
 * communities-data.js when offline.
 */
(function () {
  const proto = location.protocol;
  if (proto !== 'http:' && proto !== 'https:') return;
  if (window.ATLAS_NO_BACKEND) return;

  const BASE = window.ATLAS_API_BASE || '';
  const stamp = Date.now();

  // -------------- initial parallel fetch (before React mount) ------------
  const datasetP = fetch(BASE + '/api/communities', {
    credentials: 'include',
    headers: { 'Accept': 'application/json' },
  }).then((r) => r.ok ? r.json() : null).catch(() => null);

  const settingsP = fetch(BASE + '/api/settings', { credentials: 'include' })
    .then((r) => r.ok ? r.json() : null).catch(() => null);

  const pagesP = fetch(BASE + '/api/pages?visible_only=true', { credentials: 'include' })
    .then((r) => r.ok ? r.json() : null).catch(() => null);

  const coverageP = fetch(BASE + '/api/communities/coverage85', { credentials: 'include' })
    .then((r) => r.ok ? r.json() : null).catch(() => null);

  const navP = fetch(BASE + '/api/nav?slot=main', { credentials: 'include' })
    .then((r) => r.ok ? r.json() : null).catch(() => null);

  const layoutsP = fetch(BASE + '/api/layouts', { credentials: 'include' })
    .then((r) => r.ok ? r.json() : null).catch(() => null);

  const stylesP = fetch(BASE + '/api/styles', { credentials: 'include' })
    .then((r) => r.ok ? r.json() : null).catch(() => null);

  window.__ATLAS_API_READY = Promise.all([datasetP, settingsP, pagesP, coverageP, navP, layoutsP, stylesP]).then(
    ([dataset, settings, pages, coverage, nav, layouts, styles]) => {
      if (dataset && Array.isArray(dataset.records) && dataset.records.length) {
        window.COMMUNITIES = dataset.records;
        window.ATLAS_DATASET_INFO = {
          version: dataset.datasetVersion,
          source: dataset.datasetSource,
          uploadedAt: dataset.datasetUploadedAt,
          count: dataset.count,
          fetchedAt: stamp,
        };
        console.info(`[atlas] Loaded ${dataset.count} records from backend `
          + `(dataset v${dataset.datasetVersion}, source ${dataset.datasetSource || '—'})`);
      }
      if (settings) {
        window.ATLAS_SETTINGS = settings;
        applySettingsToDocument(settings);
      }
      if (pages && pages.pages) {
        window.ATLAS_PAGES = {};
        pages.pages.forEach((p) => { window.ATLAS_PAGES[p.slug] = p; });
      }
      if (coverage) {
        window.ATLAS_COVERAGE85 = coverage;
      }
      if (nav && Array.isArray(nav.items)) {
        window.ATLAS_NAV = nav.items.filter((n) => n.visible);
      }
      if (layouts && typeof layouts === 'object') {
        window.ATLAS_LAYOUTS = layouts;
      }
      if (styles && typeof styles === 'object') {
        window.ATLAS_STYLES = styles;
        injectElementStyles(styles);
      }
    }
  );

  // --- per-element style injection ----------------------------------------
  // Compiles { selector: { properties, customCss } } into a single <style>
  // tag with rules that target [data-cms-bind] / [data-cms-section]
  // attributes.
  function selectorToCSS(sel) {
    if (sel.startsWith('bind:'))    return `[data-cms-bind="${sel.slice(5)}"]`;
    if (sel.startsWith('section:')) return `[data-cms-section="${sel.slice(8)}"]`;
    return sel;  // already a CSS selector (advanced use)
  }
  function camelToKebab(s) { return s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()); }
  // State + breakpoint suffixes mapped to CSS pseudo-classes and media queries.
  const STATE_SUFFIXES = { default: '', hover: ':hover', focus: ':focus', active: ':active' };
  const BREAKPOINT_QUERIES = {
    all: null,
    mobile:  '@media (max-width: 640px)',
    tablet:  '@media (min-width: 641px) and (max-width: 1024px)',
    desktop: '@media (min-width: 1025px)',
  };

  function compileEntryToRules(entry) {
    // Entry format (new):
    //   properties: { default: {…}, hover: {…}, focus: {…}, active: {…} }
    //               OR { default: { all:{…}, mobile:{…}, tablet:{…}, desktop:{…} },
    //                    hover: { all:{…}, … }, … }
    //               OR legacy flat: { fontSize: '32px', color: '#000' }
    //   customCss: same nested shape OR flat string
    const sel = selectorToCSS(entry.selector || '');
    if (!sel) return [];
    const rules = [];

    const properties = entry.properties || {};
    const customCss = entry.customCss || '';

    // Normalize legacy flat shapes to the new nested form.
    function normalize(blob) {
      if (typeof blob === 'string') return { default: { all: blob } };
      if (!blob || typeof blob !== 'object') return {};
      // Already nested by state?
      const keys = Object.keys(blob);
      if (keys.some((k) => STATE_SUFFIXES.hasOwnProperty(k))) {
        const out = {};
        for (const state of keys) {
          const inner = blob[state];
          if (typeof inner === 'string') { out[state] = { all: inner }; continue; }
          if (inner && typeof inner === 'object') {
            const innerKeys = Object.keys(inner);
            if (innerKeys.some((k) => BREAKPOINT_QUERIES.hasOwnProperty(k))) {
              out[state] = inner;
            } else {
              out[state] = { all: inner };
            }
          }
        }
        return out;
      }
      // Flat: properties are directly at the root — treat as default/all.
      return { default: { all: blob } };
    }

    const np = normalize(properties);
    const nc = normalize(customCss);

    function makeBody(propBlob, cssBlob) {
      const parts = [];
      if (propBlob && typeof propBlob === 'object') {
        for (const [k, v] of Object.entries(propBlob)) {
          if (v == null || v === '') continue;
          parts.push(`  ${camelToKebab(k)}: ${v};`);
        }
      }
      if (typeof cssBlob === 'string' && cssBlob.trim()) {
        const safe = cssBlob.replace(/<\/?(style|script)[^>]*>/gi, '');
        parts.push('  ' + safe.replace(/\n/g, '\n  '));
      }
      return parts.join('\n');
    }

    for (const state of Object.keys(STATE_SUFFIXES)) {
      const stateProps = np[state] || {};
      const stateCss = nc[state] || {};
      for (const bp of Object.keys(BREAKPOINT_QUERIES)) {
        const body = makeBody(stateProps[bp], stateCss[bp]);
        if (!body) continue;
        const rule = `${sel}${STATE_SUFFIXES[state]} {\n${body}\n}`;
        const wrapped = BREAKPOINT_QUERIES[bp] ? `${BREAKPOINT_QUERIES[bp]} {\n${rule}\n}` : rule;
        rules.push(wrapped);
      }
    }
    return rules;
  }

  function buildElementStylesCSS(styles) {
    const out = [];
    Object.values(styles).forEach((entry) => {
      out.push(...compileEntryToRules(entry));
    });
    return out.join('\n\n');
  }
  function injectElementStyles(styles) {
    const css = buildElementStylesCSS(styles);
    let el = document.getElementById('atlas-element-styles');
    if (!el) {
      el = document.createElement('style');
      el.id = 'atlas-element-styles';
      document.head.appendChild(el);
    }
    el.textContent = css;
  }
  window.__ATLAS_INJECT_STYLES = injectElementStyles;
  // Edit overlay uses this to compile a single entry into rules for live preview.
  window.__ATLAS_COMPILE_STYLE_ENTRY = compileEntryToRules;

  function applySettingsToDocument(s) {
    if (!s) return;
    if (s['site.title']) document.title = s['site.title'];

    // Theme — the CSS only defines: paper, dawn, forest, midnight.
    // Anything else falls back to paper.
    const validThemes = new Set(['paper', 'dawn', 'forest', 'midnight']);
    if (s['site.theme']) {
      const t = validThemes.has(s['site.theme']) ? s['site.theme'] : 'paper';
      document.documentElement.dataset.theme = t;
    }

    // Accent color — the dashboard's CSS uses --south (the medicine-wheel
    // colour) as the primary accent. We override it AND its variants by
    // injecting a <style> element with computed shades.
    if (s['site.accent']) {
      const accent = s['site.accent'].trim();
      const overrides = buildAccentOverrides(accent);
      injectStyle('atlas-settings-overrides', overrides);
    } else {
      injectStyle('atlas-settings-overrides', '');
    }

    // Dispatch a custom event so React components can re-read.
    window.dispatchEvent(new CustomEvent('atlas:settings', { detail: s }));
  }

  // Compute light + dark variants of a hex color (no library needed).
  function shadeHex(hex, percent) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    let r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    const t = percent < 0 ? 0 : 255;
    const p = Math.abs(percent);
    r = Math.round((t - r) * p + r);
    g = Math.round((t - g) * p + g);
    b = Math.round((t - b) * p + b);
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  function buildAccentOverrides(accent) {
    const deep  = shadeHex(accent, -0.35);   // darker
    const soft  = shadeHex(accent,  0.30);   // lighter
    const glaze = shadeHex(accent,  0.65);   // very light
    return `:root {
      --south: ${accent};
      --south-deep: ${deep};
      --south-soft: ${soft};
      --south-glaze: ${glaze};
      --p-physical: ${accent};
      --bridge: ${deep};
    }`;
  }

  function injectStyle(id, css) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = css;
  }

  // -------------- live SSE subscription -----------------------------------
  // Lazy — attach once React has mounted to avoid wasting cache during boot.
  function connectSSE() {
    let es;
    try {
      es = new EventSource(BASE + '/api/events');
    } catch (e) {
      console.warn('[atlas] SSE not available', e);
      return;
    }
    es.addEventListener('dataset.updated', async (e) => {
      console.info('[atlas] dataset.updated — reloading data');
      await refreshDataset();
      window.dispatchEvent(new CustomEvent('atlas:dataset', { detail: parseEvent(e) }));
      // Trigger a soft refresh by reloading the page so all views re-render.
      // (Could be replaced with a more granular React-side update later.)
      setTimeout(() => window.location.reload(), 400);
    });
    es.addEventListener('community.edited', async (e) => {
      console.info('[atlas] community.edited');
      await refreshDataset();
      window.dispatchEvent(new CustomEvent('atlas:community', { detail: parseEvent(e) }));
    });
    es.addEventListener('settings.updated', async () => {
      const s = await fetch(BASE + '/api/settings').then((r) => r.json()).catch(() => null);
      if (s) { window.ATLAS_SETTINGS = s; applySettingsToDocument(s); }
    });
    es.addEventListener('page.updated', async () => {
      const r = await fetch(BASE + '/api/pages?visible_only=true').then((r) => r.json()).catch(() => null);
      if (r && r.pages) {
        window.ATLAS_PAGES = {};
        r.pages.forEach((p) => { window.ATLAS_PAGES[p.slug] = p; });
        window.dispatchEvent(new CustomEvent('atlas:pages'));
      }
    });
    es.addEventListener('nav.updated', async () => {
      const r = await fetch(BASE + '/api/nav?slot=main').then((r) => r.json()).catch(() => null);
      if (r && r.items) {
        window.ATLAS_NAV = r.items.filter((n) => n.visible);
        window.dispatchEvent(new CustomEvent('atlas:nav'));
      }
    });
    es.addEventListener('layout.updated', async () => {
      const r = await fetch(BASE + '/api/layouts').then((r) => r.json()).catch(() => null);
      if (r && typeof r === 'object') {
        window.ATLAS_LAYOUTS = r;
        window.dispatchEvent(new CustomEvent('atlas:layouts'));
      }
    });
    es.addEventListener('style.updated', async () => {
      const r = await fetch(BASE + '/api/styles').then((r) => r.json()).catch(() => null);
      if (r && typeof r === 'object') {
        window.ATLAS_STYLES = r;
        if (window.__ATLAS_INJECT_STYLES) window.__ATLAS_INJECT_STYLES(r);
        window.dispatchEvent(new CustomEvent('atlas:styles'));
      }
    });
    es.onerror = () => {
      console.warn('[atlas] SSE disconnected — auto-retrying');
      // EventSource auto-reconnects; nothing to do.
    };
    window.__ATLAS_SSE = es;
  }
  function parseEvent(e) { try { return JSON.parse(e.data); } catch { return null; } }
  async function refreshDataset() {
    const r = await fetch(BASE + '/api/communities', { credentials: 'include' }).catch(() => null);
    if (!r || !r.ok) return;
    const data = await r.json();
    if (data && Array.isArray(data.records)) {
      window.COMMUNITIES = data.records;
      window.ATLAS_DATASET_INFO = {
        version: data.datasetVersion,
        source: data.datasetSource,
        uploadedAt: data.datasetUploadedAt,
        count: data.count,
        fetchedAt: Date.now(),
      };
    }
  }

  // Kick off SSE shortly after initial paint.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(connectSSE, 800));
  } else {
    setTimeout(connectSSE, 800);
  }
})();
