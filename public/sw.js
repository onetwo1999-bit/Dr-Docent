// =====================================================
// 🔔 닥터 도슨 - Service Worker
// PWA 푸시 알림 및 백그라운드 동작 지원
// =====================================================

const CACHE_NAME = 'dr-docent-v1'
const urlsToCache = [
  '/',
  '/dashboard',
  '/chat',
  '/profile'
]

// ========================
// 📦 설치 이벤트
// ========================
self.addEventListener('install', (event) => {
  console.log('🔧 [Service Worker] 설치 중...')
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 [Service Worker] 캐시 저장 중')
        return cache.addAll(urlsToCache)
      })
      .then(() => {
        console.log('✅ [Service Worker] 설치 완료')
        return self.skipWaiting()
      })
  )
})

// ========================
// 🔄 활성화 이벤트
// ========================
self.addEventListener('activate', (event) => {
  console.log('🚀 [Service Worker] 활성화 중...')
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    }).then(() => {
      console.log('✅ [Service Worker] 활성화 완료')
      return self.clients.claim()
    })
  )
})

// ========================
// 🔔 푸시 알림 수신
// ========================
self.addEventListener('push', (event) => {
  console.log('📬 [Service Worker] 푸시 메시지 수신')
  
  let data = {
    title: '닥터 도슨',
    body: '선생님, 건강 관리 시간이에요!',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'dr-docent-notification',
    data: { url: '/dashboard' }
  }

  // 푸시 데이터 파싱
  if (event.data) {
    try {
      const pushData = event.data.json()
      data = { ...data, ...pushData }
    } catch (e) {
      data.body = event.data.text()
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/badge-72x72.png',
    tag: data.tag,
    vibrate: [100, 50, 100],
    requireInteraction: true,
    data: data.data || { url: '/dashboard' },
    actions: [
      { action: 'open', title: '열기' },
      { action: 'close', title: '닫기' }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// ========================
// 👆 알림 클릭 이벤트
// ========================
self.addEventListener('notificationclick', (event) => {
  console.log('👆 [Service Worker] 알림 클릭:', event.action)
  
  event.notification.close()

  if (event.action === 'close') {
    return
  }

  const urlToOpen = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // 이미 열린 창이 있으면 포커스
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen)
            return client.focus()
          }
        }
        // 없으면 새 창 열기
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      })
  )
})

// ========================
// 🌐 네트워크 요청 처리
// ========================
self.addEventListener('fetch', (event) => {
  // API 요청은 캐시하지 않음
  if (event.request.url.includes('/api/')) {
    return
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 캐시에 있으면 캐시 반환, 없으면 네트워크 요청
        return response || fetch(event.request)
      })
      .catch(() => {
        // 오프라인일 때 기본 페이지 반환
        if (event.request.mode === 'navigate') {
          return caches.match('/')
        }
      })
  )
})

// ========================
// 📡 백그라운드 동기화
// ========================
self.addEventListener('sync', (event) => {
  console.log('🔄 [Service Worker] 백그라운드 동기화:', event.tag)
  
  if (event.tag === 'health-log-sync') {
    event.waitUntil(syncHealthLogs())
  }
})

async function syncHealthLogs() {
  // 오프라인 동안 쌓인 로그를 서버에 동기화
  console.log('📤 [Service Worker] 건강 로그 동기화 중...')
}

console.log('🏥 [Service Worker] 닥터 도슨 Service Worker 로드됨')
