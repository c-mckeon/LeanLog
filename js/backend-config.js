const isLocalFrontend = ['localhost', '127.0.0.1'].includes(window.location.hostname);

window.LOCAL_DEMO_MODE = isLocalFrontend;
window.WORKOUT_BACKEND_ORIGIN = window.WORKOUT_BACKEND_ORIGIN || (
  isLocalFrontend
    ? window.location.origin
    : 'https://lean-backend.agreeableplant-a51f439e.northeurope.azurecontainerapps.io'
);

// The backend scales to zero when idle and takes a while to start. Wake it as soon as the page
// loads, so it's ready by the time the user has signed in or needs their data.
fetch(`${window.WORKOUT_BACKEND_ORIGIN}/healthz`, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});

// Cognito's hosted login page. "Log in" goes straight there rather than through the backend's
// /login, so the login page opens at once even while the backend is still waking up. Cognito then
// returns to the backend's /callback as before (the same redirect URI, so nothing changes in AWS).
// The state is "f.<random>.<nonce>": the backend checks the nonce in the ID token, and hands the
// state back with the one-time sign-in code, where it must match LOGIN_STATE_KEY (see below), so a
// sign-in this browser didn't start is refused.
const COGNITO_LOGIN = {
  domain: 'https://eu-north-1yfjhnbg9i.auth.eu-north-1.amazoncognito.com',
  clientId: '4j83477d02aci1uo2vnvrj70de',
  redirectUri: 'https://lean-backend.agreeableplant-a51f439e.northeurope.azurecontainerapps.io/callback'
};
const LOGIN_STATE_KEY = 'workoutLoginState';

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function cognitoLoginUrl() {
  const nonce = randomToken();
  const state = `f.${randomToken()}.${nonce}`;
  try {
    localStorage.setItem(LOGIN_STATE_KEY, state);
  } catch (error) {
    return null; // can't remember the state, so use the backend's /login instead
  }
  const url = new URL('/oauth2/authorize', COGNITO_LOGIN.domain);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: COGNITO_LOGIN.clientId,
    redirect_uri: COGNITO_LOGIN.redirectUri,
    scope: 'openid email',
    state,
    nonce
  }).toString();
  return url.toString();
}

// The login/demo links in index.html point at production. Other scripts fix them only once the
// whole page has loaded, so an early click locally went to production. Point them at the right
// backend at click time instead. Log in (not locally) goes straight to Cognito.
document.addEventListener('click', (event) => {
  const link = event.target.closest && event.target.closest('#authLink, #demoLink');
  if (!link) return;
  const url = new URL(link.href, window.location.href);
  if (link.id === 'authLink' && url.pathname === '/login' && !isLocalFrontend) {
    const direct = cognitoLoginUrl();
    if (direct) {
      event.preventDefault();
      window.location.assign(direct);
      return;
    }
  }
  link.href = window.WORKOUT_BACKEND_ORIGIN + url.pathname;
}, true);
// Cross-site cookies are blocked by mobile browsers, so auth uses a bearer token
// obtained by exchanging the one-time code the backend appends to the redirect URL.
(function () {
  const TOKEN_KEY = 'workoutAuthToken';
  const origin = window.WORKOUT_BACKEND_ORIGIN;
  const nativeFetch = window.fetch.bind(window);
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const code = params.get('authCode');
  const authState = params.get('authState');
  let ready = Promise.resolve();

  // A sign-in started here (straight to Cognito) comes back with its state, which must be the one
  // this browser remembered; otherwise someone else's sign-in could be slipped in. Sign-ins
  // through the backend's /login come back without one (the backend checked the state itself).
  let expectedState = null;
  try {
    expectedState = localStorage.getItem(LOGIN_STATE_KEY);
    if (code) localStorage.removeItem(LOGIN_STATE_KEY);
  } catch (error) {
    expectedState = null;
  }
  const stateOk = !authState || authState === expectedState;

  if (code) {
    params.delete('authCode');
    params.delete('authState');
    const rest = params.toString();
    history.replaceState(null, '', window.location.pathname + window.location.search + (rest ? `#${rest}` : ''));
    if (!stateOk) console.error('Sign-in refused: it was not started from this browser.');
  }

  if (code && stateOk) {
    ready = nativeFetch(`${origin}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => { if (result?.token) localStorage.setItem(TOKEN_KEY, result.token); })
      .catch((error) => console.error('Could not complete sign-in:', error));
  }

  window.authReady = ready;
  window.clearAuthToken = () => localStorage.removeItem(TOKEN_KEY);

  // Read the stored token's payload so the page knows who is signed in without
  // waiting for the backend. The server still checks the signature on every request.
  window.readLocalAuth = () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return null;
      const binary = atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
      if (!payload.userInfo?.sub || !(payload.exp > Date.now())) {
        localStorage.removeItem(TOKEN_KEY);
        return null;
      }
      return { authenticated: true, user: payload.userInfo, demo: Boolean(payload.demo), localDemo: Boolean(payload.localDemo) };
    } catch (error) {
      return null;
    }
  };

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
