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

async function loadAuthStatus() {
  try {
    const result = await window.getAuthStatus();
    renderAuthStatus(result.authenticated, result.user, result.demo);
  } catch (error) {
    console.error('Could not load Cognito session:', error);
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
