const apiBackendOrigin = window.WORKOUT_BACKEND_ORIGIN || 'https://lean-backend.agreeableplant-a51f439e.northeurope.azurecontainerapps.io';

class ApiSnapshot {
  constructor(value, key = null) {
    this._value = value;
    this.key = key;
  }

  val() {
    return this._value;
  }

  exists() {
    return this._value !== null && this._value !== undefined;
  }

  forEach(callback) {
    if (!this._value || typeof this._value !== 'object') return;
    Object.entries(this._value).forEach(([key, value]) => callback(new ApiSnapshot(value, key)));
  }
}

let authStatusPromise = null;

// Single shared /api/me call so data requests can be skipped when signed out.
function getAuthStatus() {
  if (!authStatusPromise) {
    authStatusPromise = fetch(`${apiBackendOrigin}/api/me`, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error(`Auth status request failed with ${response.status}`);
        return response.json();
      });
  }
  return authStatusPromise;
}
window.getAuthStatus = getAuthStatus;

async function apiRequest(path, options = {}) {
  await window.authReady;
  // A valid stored token means signed in; only ask the server when there isn't one.
  if (!(window.readLocalAuth && window.readLocalAuth())) {
    let status = null;
    try {
      status = await getAuthStatus();
    } catch (error) {
      // Auth service unreachable: fall through and let the request report its own error.
    }
    if (status && !status.authenticated) {
      throw new Error('Authentication required.');
    }
  }

  const response = await fetch(`${apiBackendOrigin}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const result = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(result?.error || `Request failed with ${response.status}.`);
  }
  return result;
}

function queryPath(path) {
  return `/api/data?path=${encodeURIComponent(path)}`;
}

// ---- Demo-mode settings, kept in this browser ----
// The public demo is read-only on the server, so its visitors couldn't change any settings (and the
// page reads its layout from them). In the demo, writes to settings go to localStorage instead, and
// reads of those paths are overlaid with them. Workouts, Measurements and other data stay read-only.
const DEMO_OVERLAY_KEY = 'demoSettingsOverlay';
const DEMO_OVERLAY_PATHS = [
  /^settings(\/|$)/,
  /^bio\/metrics\/[^/]+\/(pointColor|lineColor|bandColor|showPoints|showLine|showSpread)$/
];

function isReadOnlyDemo() {
  const local = window.readLocalAuth && window.readLocalAuth();
  return Boolean(local && local.demo && !local.localDemo);
}

const isOverlayPath = (path) => DEMO_OVERLAY_PATHS.some((pattern) => pattern.test(path));
const joinPath = (base, key) => [base, key].map((part) => String(part).replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/');

function readOverlay() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_OVERLAY_KEY) || '{}') || {};
  } catch (error) {
    return {};
  }
}

// Saves { absolutePath: value } (null removes); a path replaces anything saved below it
function writeOverlay(entries) {
  const overlay = readOverlay();
  Object.entries(entries).forEach(([path, value]) => {
    Object.keys(overlay).forEach((saved) => { if (saved.startsWith(`${path}/`)) delete overlay[saved]; });
    overlay[path] = value === undefined ? null : JSON.parse(JSON.stringify(value));
  });
  try {
    localStorage.setItem(DEMO_OVERLAY_KEY, JSON.stringify(overlay));
  } catch (error) {
    console.error('Could not keep the demo setting:', error);
  }
}

// The server's value at `path` with this browser's demo settings laid over it
function applyOverlay(path, value) {
  const overlay = readOverlay();
  const paths = Object.keys(overlay).sort((a, b) => a.length - b.length); // parents first
  let result = value === undefined ? null : value;
  const clone = (item) => (item && typeof item === 'object' ? JSON.parse(JSON.stringify(item)) : item);
  result = clone(result);
  paths.forEach((saved) => {
    if (saved === path) {
      result = clone(overlay[saved]);
    } else if (path && path.startsWith(`${saved}/`)) {
      // A saved parent: read our part out of it
      const parts = path.slice(saved.length + 1).split('/');
      result = clone(parts.reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), overlay[saved]) ?? null);
    } else if (!path || saved.startsWith(`${path}/`)) {
      // A saved child: write it into our value
      const parts = (path ? saved.slice(path.length + 1) : saved).split('/');
      if (!result || typeof result !== 'object') result = {};
      let node = result;
      parts.slice(0, -1).forEach((part) => {
        if (!node[part] || typeof node[part] !== 'object') node[part] = {};
        node = node[part];
      });
      const last = parts[parts.length - 1];
      if (overlay[saved] === null) delete node[last];
      else node[last] = clone(overlay[saved]);
    }
  });
  return result;
}

// In the demo, takes the settings out of a write and keeps them here. Returns the rest (for the
// server), or null when nothing is left to send.
function keepDemoSettings(entries) {
  if (!isReadOnlyDemo()) return entries;
  const local = {};
  const rest = {};
  Object.entries(entries).forEach(([path, value]) => {
    if (isOverlayPath(path)) local[path] = value;
    else rest[path] = value;
  });
  if (Object.keys(local).length) writeOverlay(local);
  return Object.keys(rest).length ? rest : null;
}

function createApiRef(path = '') {
  const normalizedPath = path.replace(/^\/+|\/+$/g, '');
  const pathSegments = normalizedPath.split('/').filter(Boolean);

  return {
    key: pathSegments[pathSegments.length - 1] || null,
    child(childPath) {
      return createApiRef(`${normalizedPath}/${childPath}`);
    },

    once(eventName, callback) {
      const promise = apiRequest(queryPath(normalizedPath))
        .then((result) => new ApiSnapshot(isReadOnlyDemo() ? applyOverlay(normalizedPath, result?.value) : result?.value));
      if (callback) promise.then(callback);
      return promise;
    },

    on(eventName, callback) {
      return this.once(eventName, callback);
    },

    off() {
      return this;
    },

    set(value, callback) {
      const promise = keepDemoSettings({ [normalizedPath]: value })
        ? apiRequest('/api/data', {
          method: 'PUT',
          body: JSON.stringify({ path: normalizedPath, value })
        })
        : Promise.resolve(null);
      if (callback) promise.then(() => callback(null)).catch(callback);
      return promise;
    },

    update(updates, callback) {
      // In the demo, settings among the updates are kept in this browser; the rest go to the server
      const absolute = Object.fromEntries(Object.entries(updates || {}).map(([key, value]) => [joinPath(normalizedPath, key), value]));
      const rest = keepDemoSettings(absolute);
      const restUpdates = rest
        ? Object.fromEntries(Object.entries(updates || {}).filter(([key]) => joinPath(normalizedPath, key) in rest))
        : null;
      const promise = restUpdates
        ? apiRequest('/api/data', {
          method: 'PATCH',
          body: JSON.stringify({ path: normalizedPath, updates: restUpdates })
        })
        : Promise.resolve(null);
      if (callback) promise.then(() => callback(null)).catch(callback);
      return promise;
    },

    remove(callback) {
      const promise = keepDemoSettings({ [normalizedPath]: null })
        ? apiRequest(queryPath(normalizedPath), { method: 'DELETE' })
        : Promise.resolve(null);
      if (callback) promise.then(() => callback(null)).catch(callback);
      return promise;
    },

    push(value, callback) {
      if (typeof value === 'function') {
        callback = value;
        value = undefined;
      }

      if (value === undefined) {
        const key = crypto.randomUUID();
        return createApiRef(`${normalizedPath}/${key}`);
      }

      const promise = apiRequest('/api/data/push', {
        method: 'POST',
        body: JSON.stringify({ path: normalizedPath, value })
      });
      if (callback) promise.then(() => callback(null)).catch(callback);
      return promise;
    },

    orderByChild() {
      return this;
    },

    limitToLast() {
      return this;
    }
  };
}

window.database = {
  ref(path = '') {
    return createApiRef(path);
  }
};
window.rawDatabase = window.database;
window.publicDatabase = window.database;
window.getUserDatabaseRef = (path = '') => window.database.ref(path);
