const apiBackendOrigin = window.WORKOUT_BACKEND_ORIGIN || 'http://localhost:3000';

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

async function apiRequest(path, options = {}) {
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

function createApiRef(path = '') {
  const normalizedPath = path.replace(/^\/+|\/+$/g, '');
  const pathSegments = normalizedPath.split('/').filter(Boolean);

  return {
    key: pathSegments[pathSegments.length - 1] || null,
    child(childPath) {
      return createApiRef(`${normalizedPath}/${childPath}`);
    },

    once(eventName, callback) {
      const promise = apiRequest(queryPath(normalizedPath)).then((result) => new ApiSnapshot(result?.value));
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
      const promise = apiRequest('/api/data', {
        method: 'PUT',
        body: JSON.stringify({ path: normalizedPath, value })
      });
      if (callback) promise.then(() => callback(null)).catch(callback);
      return promise;
    },

    update(updates, callback) {
      const promise = apiRequest('/api/data', {
        method: 'PATCH',
        body: JSON.stringify({ path: normalizedPath, updates })
      });
      if (callback) promise.then(() => callback(null)).catch(callback);
      return promise;
    },

    remove(callback) {
      const promise = apiRequest(queryPath(normalizedPath), { method: 'DELETE' });
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
