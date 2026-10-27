const backendOrigin = window.WORKOUT_BACKEND_ORIGIN || 'https://lean-backend.agreeableplant-a51f439e.northeurope.azurecontainerapps.io';
const authMessage = document.getElementById('authMessage');
const authLink = document.getElementById('authLink');
const demoLink = document.getElementById('demoLink');

function renderAuthStatus(authenticated, user, demo) {
  if (!authMessage || !authLink) return;

  if (authenticated) {
    authMessage.textContent = demo
      ? (window.LOCAL_DEMO_MODE ? 'Local demo mode (editable)' : 'Demo mode (read-only)')
      : `Signed in as ${user.email || user.username || 'workout user'}`;
    authLink.textContent = 'Log out';
    authLink.href = `${backendOrigin}/logout`;
    authLink.onclick = () => window.clearAuthToken && window.clearAuthToken();
    if (demoLink) demoLink.hidden = true;
    return;
  }

  authMessage.textContent = 'Not signed in';
  authLink.textContent = 'Log in';
  authLink.href = `${backendOrigin}/login`;
  if (demoLink) demoLink.hidden = false;
}

// First sign-in (or new consent text): cover the app until the user agrees. Saves fail on the
// backend without consent, so this is the only place it needs checking.
async function checkConsent(demo) {
  const overlay = document.getElementById('consentOverlay');
  if (!overlay || demo) return;
  let status;
  try {
    status = await fetch(`${backendOrigin}/api/consent`, { credentials: 'include' }).then((response) => response.json());
  } catch (error) {
    console.error('Could not check consent:', error);
    return;
  }
  if (status?.given) return;

  const box = document.getElementById('consentBox');
  const accept = document.getElementById('consentAcceptBtn');
  const decline = document.getElementById('consentDeclineLink');
  decline.href = `${backendOrigin}/logout`;
  decline.onclick = () => window.clearAuthToken && window.clearAuthToken();
  box.onchange = () => { accept.disabled = !box.checked; };
  accept.onclick = async () => {
    accept.disabled = true;
    try {
      const response = await fetch(`${backendOrigin}/api/consent`, { method: 'POST', credentials: 'include' });
      if (!response.ok) throw new Error(`Request failed with ${response.status}`);
      overlay.hidden = true;
    } catch (error) {
      accept.disabled = false;
      if (window.showNotice) window.showNotice(`Could not save your consent: ${error.message}`, 'error');
    }
  };
  overlay.hidden = false;
  box.focus();
}

async function loadAuthStatus() {
  // Show the status from the stored token straight away, then confirm with the server.
  await window.authReady;
  const local = window.readLocalAuth && window.readLocalAuth();
  if (local) renderAuthStatus(true, local.user, local.demo);
  else renderAuthStatus(false);

  try {
    const result = await window.getAuthStatus();
    if (!result.authenticated && local && window.clearAuthToken) window.clearAuthToken();
    renderAuthStatus(result.authenticated, result.user, result.demo);
    if (result.authenticated) checkConsent(result.demo);
  } catch (error) {
    console.error('Could not load Cognito session:', error);
    if (local) return;
    if (authMessage) authMessage.textContent = 'Login service unavailable';
    if (authLink) {
      authLink.textContent = 'Open login';
      authLink.href = `${backendOrigin}/login`;
    }
  }
}

if (authLink) authLink.href = `${backendOrigin}/login`;
if (demoLink) demoLink.href = `${backendOrigin}/demo`;
loadAuthStatus();
