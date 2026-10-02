const isLocalFrontend = ['localhost', '127.0.0.1'].includes(window.location.hostname);

window.LOCAL_DEMO_MODE = isLocalFrontend;
window.WORKOUT_BACKEND_ORIGIN = window.WORKOUT_BACKEND_ORIGIN || (
  isLocalFrontend
    ? window.location.origin
    : 'https://lean-backend.agreeableplant-a51f439e.northeurope.azurecontainerapps.io'
);