// 天行者 Service Worker：讓 App 可安裝、離線也能玩
// 策略：
//   - 程式本體（HTML/JS/CSS）→ 網路優先：有網路一定拿最新版，斷線才用快取
//   - 經文與題庫（data/*）→ 快取優先＋背景更新：畫面秒開，內容有更新下次進來就是新的
// 改版時把 VERSION 加一，舊快取會自動清掉
const VERSION = 'bibleduo-v3'; // v3：狀態列改淺色（theme-color 跟場景走）
const CORE = [
  '.',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/questions.js',
  'js/cloud.js',
  'data/index.json',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // 只接手同網域的 GET；Firebase 等外部請求原樣放行
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  if (url.pathname.includes('/data/')) {
    // 經文/題庫：先給快取（秒開），同時背景抓新版更新快取
    e.respondWith(
      caches.match(e.request).then((hit) => {
        const refresh = fetch(e.request)
          .then((res) => {
            if (res.ok) caches.open(VERSION).then((c) => c.put(e.request, res.clone()));
            return res;
          })
          .catch(() => hit);
        return hit || refresh;
      })
    );
  } else {
    // 程式本體：先走網路拿最新版，斷線才退回快取
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) caches.open(VERSION).then((c) => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() =>
          caches.match(e.request).then((hit) => hit || caches.match('index.html'))
        )
    );
  }
});
