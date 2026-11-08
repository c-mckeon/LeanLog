// Lets Chrome offer "Install app". It caches nothing on purpose: every request goes to the
// network as usual, so a deploy reaches installed copies straight away, as it does in the browser.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
