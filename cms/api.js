/* Lightweight API client for the CMS. Stores token in localStorage. */
(function () {
  const TOKEN_KEY = 'atlas-cms-token';

  // When the CMS is served from the same backend, '' is the right base.
  // To override (eg. dev server on a different port), set window.ATLAS_API_BASE before this loads.
  const BASE = window.ATLAS_API_BASE || '';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }
  function setToken(t) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }

  async function request(method, path, body, opts = {}) {
    const headers = { 'Accept': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    let payload = undefined;
    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(BASE + path, {
      method, headers, body: payload, credentials: 'include',
      ...opts,
    });
    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      data = await res.json().catch(() => null);
    } else {
      data = await res.text().catch(() => '');
    }
    if (!res.ok) {
      const msg = (data && data.detail) || data || res.statusText;
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return data;
  }

  async function login(username, password) {
    const form = new FormData();
    form.append('username', username);
    form.append('password', password);
    const data = await request('POST', '/api/auth/login', form);
    if (data && data.access_token) setToken(data.access_token);
    return data;
  }

  async function logout() {
    try { await request('POST', '/api/auth/logout'); } catch (e) {}
    setToken('');
  }

  async function me() {
    return request('GET', '/api/auth/me');
  }

  const API = {
    base: BASE,
    getToken, setToken,
    login, logout, me,
    request,
    health: () => request('GET', '/api/health'),
    users: {
      list: () => request('GET', '/api/users'),
      create: (u) => request('POST', '/api/users', u),
      remove: (un) => request('DELETE', `/api/users/${encodeURIComponent(un)}`),
      password: (un, password) => request('POST', `/api/users/${encodeURIComponent(un)}/password`, { password }),
    },
    communities: {
      list: () => request('GET', '/api/communities'),
      upload: (file) => {
        const fd = new FormData();
        fd.append('file', file);
        return request('POST', '/api/communities/upload', fd);
      },
      edits: () => request('GET', '/api/communities/edits'),
      versions: () => request('GET', '/api/communities/versions'),
      activate: (v) => request('POST', `/api/communities/versions/${v}/activate`),
      edit: (id, payload) => request('POST', `/api/communities/${encodeURIComponent(id)}/edit`, payload),
      remove: (id) => request('DELETE', `/api/communities/${encodeURIComponent(id)}`),
    },
    analytics: {
      full: () => request('GET', '/api/analytics/full'),
      overview: () => request('GET', '/api/analytics/overview'),
      pillars: () => request('GET', '/api/analytics/pillars'),
      gaps: () => request('GET', '/api/analytics/gaps'),
      population: () => request('GET', '/api/analytics/population'),
      keywords: () => request('GET', '/api/analytics/keywords'),
      clusters: (k = 5) => request('GET', `/api/analytics/clusters?k=${k}`),
      coverage: () => request('GET', '/api/analytics/coverage'),
      quality: () => request('GET', '/api/analytics/quality'),
    },
    audit: (limit = 100) => request('GET', `/api/audit?limit=${limit}`),
    settings: {
      get: () => request('GET', '/api/settings'),
      update: (values) => request('PUT', '/api/settings', { values }),
      reset: () => request('POST', '/api/settings/reset'),
    },
    pages: {
      list: () => request('GET', '/api/pages'),
      get: (slug) => request('GET', `/api/pages/${encodeURIComponent(slug)}`),
      upsert: (slug, payload) => request('PUT', `/api/pages/${encodeURIComponent(slug)}`, payload),
      remove: (slug) => request('DELETE', `/api/pages/${encodeURIComponent(slug)}`),
    },
    nav: {
      list: (slot) => request('GET', '/api/nav' + (slot ? '?slot=' + encodeURIComponent(slot) : '')),
      upsert: (item) => request('PUT', '/api/nav', item),
      remove: (id) => request('DELETE', `/api/nav/${id}`),
    },
    layouts: {
      all: () => request('GET', '/api/layouts'),
      get: (name) => request('GET', `/api/layouts/${encodeURIComponent(name)}`),
      save: (name, blocks) => request('PUT', `/api/layouts/${encodeURIComponent(name)}`, { blocks }),
      reset: (name) => request('POST', `/api/layouts/${encodeURIComponent(name)}/reset`),
    },
    auth: {
      requestReset: (username) => request('POST', '/api/auth/request-reset', { username }),
      reset: (token, password) => request('POST', '/api/auth/reset', { token, password }),
      setEmail: (username, email) => request('POST', `/api/users/${encodeURIComponent(username)}/email`, { email }),
    },
  };

  window.API = API;
})();
