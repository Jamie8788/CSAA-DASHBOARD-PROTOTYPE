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

  window.__ATLAS_API_READY = Promise.all([datasetP, settingsP, pagesP, coverageP]).then(
    ([dataset, settings, pages, coverage]) => {
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
    }
  );

  function applySettingsToDocument(s) {
    if (!s) return;
    if (s['site.title']) document.title = s['site.title'];
    if (s['site.accent']) {
      document.documentElement.style.setProperty('--accent-override', s['site.accent']);
    }
    if (s['site.theme']) {
      document.documentElement.dataset.theme = s['site.theme'];
    }
    // Dispatch a custom event so React components can re-read.
    window.dispatchEvent(new CustomEvent('atlas:settings', { detail: s }));
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
