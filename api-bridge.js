/* API bridge — when the dashboard is served by the FastAPI backend, this
 * fetches the live dataset from /api/communities and replaces
 * window.COMMUNITIES BEFORE React mounts. Failing silently is fine: the
 * dashboard falls back to the baked-in communities-data.js.
 */
(function () {
  // Only attempt when the page is served over http(s) — file:// loads
  // can't reach the API and would just slow things down.
  const proto = location.protocol;
  if (proto !== 'http:' && proto !== 'https:') return;

  // If a JS-side flag wants us to skip (e.g. you opened the standalone), bail.
  if (window.ATLAS_NO_BACKEND) return;

  const url = (window.ATLAS_API_BASE || '') + '/api/communities';

  // Use a synchronous wait via a promise we resolve before React mounts.
  // The page already loads scripts in order, so we attach to window so the
  // existing buildAll() picks up the new dataset on first render.
  const stamp = Date.now();
  window.__ATLAS_API_READY = fetch(url, {
    credentials: 'include',
    headers: { 'Accept': 'application/json' },
  })
    .then((r) => r.ok ? r.json() : null)
    .then((data) => {
      if (data && Array.isArray(data.records) && data.records.length) {
        window.COMMUNITIES = data.records;
        window.ATLAS_DATASET_INFO = {
          version: data.datasetVersion,
          source: data.datasetSource,
          uploadedAt: data.datasetUploadedAt,
          count: data.count,
          fetchedAt: stamp,
        };
        console.info(`[atlas] Loaded ${data.count} records from backend `
          + `(dataset v${data.datasetVersion}, source ${data.datasetSource || '—'})`);
      }
    })
    .catch((err) => {
      console.warn('[atlas] Backend unavailable — using bundled dataset.', err);
    });
})();
