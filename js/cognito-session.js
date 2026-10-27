const backendOrigin = window.WORKOUT_BACKEND_ORIGIN || 'https://lean-backend.agreeableplant-a51f439e.northeurope.azurecontainerapps.io';
const authMessage = document.getElementById('authMessage');
const authLink = document.getElementById('authLink');
const demoLink = document.getElementById('demoLink');

// "Delete account" in the settings menu: only for a signed-in, non-demo user
const deleteAccountBlock = document.getElementById('deleteAccountBlock');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');

deleteAccountBtn?.addEventListener('click', async () => {
  const sure = window.confirm('Delete your account?\n\nThis permanently deletes all your workouts, exercises, Measurements and settings, and your login. It cannot be undone.');
  if (!sure) return;
  deleteAccountBtn.disabled = true;
  deleteAccountBtn.textContent = 'Deleting…';
  try {
    const response = await fetch(`${backendOrigin}/api/account/delete`, { method: 'POST', credentials: 'include' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed with ${response.status}`);
    if (window.clearAuthToken) window.clearAuthToken();
    window.alert('Your account and all your data have been deleted.');
    window.location.assign(`${backendOrigin}/logout`);
  } catch (error) {
    deleteAccountBtn.disabled = false;
    deleteAccountBtn.textContent = 'Delete account';
    if (window.showNotice) window.showNotice(error.message, 'error');
    else window.alert(error.message);
  }
});

// The user's full name for the header: from the login (Cognito), else the name entered in the
// first-login dialog (filled in once the profile loads), else the email address
let profileName = '';
function displayName(user = {}) {
  const fromLogin = (user.name || [user.given_name, user.family_name].filter(Boolean).join(' ')).trim();
  return fromLogin || profileName || user.email || user.username || 'workout user';
}
let signedInUser = null;
function showProfileName(givenName, familyName) {
  profileName = [givenName, familyName].filter(Boolean).join(' ').trim();
  if (signedInUser && authMessage && !signedInUser.demo) authMessage.textContent = `Signed in as: ${displayName(signedInUser.user)}`;
}

function renderAuthStatus(authenticated, user, demo) {
  signedInUser = authenticated ? { user, demo } : null;
  if (deleteAccountBlock) deleteAccountBlock.hidden = !authenticated || Boolean(demo);
  if (!authMessage || !authLink) return;

  if (authenticated) {
    authMessage.textContent = demo
      ? (window.LOCAL_DEMO_MODE ? 'Local demo mode (editable)' : 'Demo mode (read-only)')
      : `Signed in as: ${displayName(user)}`;
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
  if (status?.given) {
    checkOnboarding();
    return;
  }

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
      checkOnboarding();
    } catch (error) {
      accept.disabled = false;
      if (window.showNotice) window.showNotice(`Could not save your consent: ${error.message}`, 'error');
    }
  };
  overlay.hidden = false;
  box.focus();
}

// First-login details, right after consent: shown until this version of the dialog has been
// completed, except to someone who already has a first name (e.g. from Cognito) and has never
// completed one (so existing users aren't asked for what we already know)
async function checkOnboarding() {
  const overlay = document.getElementById('onboardingOverlay');
  const form = document.getElementById('onboardingForm');
  if (!overlay || !form) return;
  let profile;
  try {
    const response = await fetch(`${backendOrigin}/api/profile`, { credentials: 'include' });
    if (!response.ok) return;
    profile = await response.json();
    showProfileName(profile.givenName, profile.familyName);
  } catch (error) {
    console.error('Could not check the profile:', error);
    return;
  }
  const done = profile.onboardingVersion >= profile.currentOnboardingVersion;
  const alreadyNamed = !profile.onboardingVersion && profile.givenName;
  if (done || alreadyNamed) return;

  const givenInput = document.getElementById('onboardingGivenName');
  const familyInput = document.getElementById('onboardingFamilyName');
  const errorText = document.getElementById('onboardingError');
  const saveBtn = document.getElementById('onboardingSaveBtn');
  givenInput.value = profile.givenName || '';
  familyInput.value = profile.familyName || '';
  const showError = (message) => {
    errorText.textContent = message;
    errorText.hidden = !message;
  };

  form.onsubmit = async (event) => {
    event.preventDefault();
    if (!givenInput.value.trim()) {
      showError('Enter your first name.');
      givenInput.focus();
      return;
    }
    showError('');
    saveBtn.disabled = true;
    try {
      const response = await fetch(`${backendOrigin}/api/profile`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ givenName: givenInput.value, familyName: familyInput.value })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Request failed with ${response.status}`);
      overlay.hidden = true;
      showProfileName(result.givenName, result.familyName);
    } catch (error) {
      showError(`Could not save: ${error.message}`);
    } finally {
      saveBtn.disabled = false;
    }
  };
  overlay.hidden = false;
  givenInput.focus();
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
