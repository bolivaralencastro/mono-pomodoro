const CACHE_NAME = 'mono-pomodoro-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/index.tsx',
  // Adicione aqui os caminhos para os componentes e serviços TS
  // NOTA: Como o AI Studio agrupa os arquivos, o cache de arquivos individuais
  // pode ser complexo. Começar com o básico é o mais seguro.
  // '/src/app.component.js', // Exemplo de como seria
  // '/src/services/timer.service.js' // Exemplo
];

self.addEventListener('install', event => {
  // Realiza a instalação, abrindo o cache e adicionando os arquivos do app shell
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se a resposta estiver no cache, retorna a partir do cache
        if (response) {
          return response;
        }
        // Se não, busca na rede
        return fetch(event.request);
      }
    )
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
