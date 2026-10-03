const isLocalFrontend = ['localhost', '127.0.0.1'].includes(window.location.hostname);

window.LOCAL_DEMO_MODE = isLocalFrontend;
window.WORKOUT_BACKEND_ORIGIN = window.WORKOUT_BACKEND_ORIGIN || (
  isLocalFrontend
    ? window.location.origin
    : 'https://lean-backend.agreeableplant-a51f439e.northeurope.azurecontainerapps.io'
);
// Cross-site cookies are blocked by mobile browsers, so auth uses a bearer token
// obtained by exchanging the one-time code the backend appends to the redirect URL.
(function () {
  const TOKEN_KEY = 'workoutAuthToken';
  const origin = window.WORKOUT_BACKEND_ORIGIN;
  const nativeFetch = window.fetch.bind(window);
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const code = params.get('authCode');
  let ready = Promise.resolve();

  if (code) {
    params.delete('authCode');
    const rest = params.toString();
    history.replaceState(null, '', window.location.pathname + window.location.search + (rest ? `#${rest}` : ''));
    ready = nativeFetch(`${origin}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => { if (result?.token) localStorage.setItem(TOKEN_KEY, result.token); })
      .catch((error) => console.error('Could not complete sign-in:', error));
  }

  window.clearAuthToken = () => localStorage.removeItem(TOKEN_KEY);

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.startsWith(origin)) return nativeFetch(input, init);
    await ready;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return nativeFetch(input, init);
    const headers = new Headers(init.headers || (typeof input === 'string' ? undefined : input.headers));
    headers.set('Authorization', `Bearer ${token}`);
    return nativeFetch(input, { ...init, headers });
  };
})();
