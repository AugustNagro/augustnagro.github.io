const store = 'passgen-store-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(store).then(cache => cache.addAll([
      "./",
      "./index.html",
      "./icon.png",
      "./10k.txt",
      "./passgen.js"
    ])));
});

self.addEventListener('activate', e => {
  console.log('activating service worker', e);
  e.waitUntil(caches.keys().then((keyList) => Promise.all(keyList.map((key) => {
    if (key !== store) {
      console.log('removing old cache', key);
      return caches.delete(key);
    }
  }))));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request)
      .then((resp) => {
        if (!resp || resp.status !== 200 || resp.type !== 'basic') {
          return caches.match(e.request).then(cacheResp => cacheResp || resp);
        }

        return caches.open(store)
            .then(cache => cache.put(e.request, resp.clone()))
            .then(() => resp);

      }).catch((err) => caches.match(e.request)))
//  e.respondWith(caches.match(e.request).then(resp => resp || fetch(e.request)));
});