// =====================================================
// 🔔 닥터 도슨 - Service Worker
// PWA 푸시 알림 및 백그라운드 동작 지원
// =====================================================

// 캐시 버전 업데이트 (강제 갱신 - 리다이렉트 문제 해결)
const CACHE_NAME = 'dr-docent-v3'
const urlsToCache = [
  '/',
  '/dashboard',
  '/chat',
  '/profile',
  '/calendar'
]

// ========================
// 🔧 URL 정규화 헬퍼
// ========================
function normalizeUrl(url) {
  try {
    // URL 객체 생성 (자동으로 현재 origin 사용)
    const urlObj = new URL(url, self.location.origin)
    
    // 마지막 슬래시 제거 (루트 경로 제외)
    if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
      urlObj.pathname = urlObj.pathname.slice(0, -1)
    }
    
    return urlObj.toString()
  } catch (e) {
    console.warn('⚠️ [SW] URL 정규화 실패:', url, e)
    // 실패 시 원본 반환
    return url
  }
}

// ========================
// 🔧 절대 URL 생성 헬퍼
// ========================
function getAbsoluteUrl(path) {
  // 경로가 이미 절대 URL이면 그대로 반환
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return normalizeUrl(path)
  }
  
  // 상대 경로를 절대 URL로 변환
  const baseUrl = self.location.origin.replace(/\/$/, '') // 마지막 슬래시 제거
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  
  return `${baseUrl}${normalizedPath}`
}

// ========================
// 📦 설치 이벤트
// ========================
self.addEventListener('install', (event) => {
  console.log('🔧 [Service Worker] 설치 중... (v3 - 리다이렉트 문제 해결)')
  
  // 즉시 활성화하여 이전 버전 교체
  self.skipWaiting()
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 [Service Worker] 캐시 저장 중')
        // 리다이렉트를 허용하여 캐시 저장 (실패해도 계속 진행)
        return Promise.allSettled(
          urlsToCache.map(url => {
            return fetch(url, { redirect: 'follow' })
              .then(response => {
                // 리다이렉트된 응답은 캐시하지 않음
                if (response.redirected) {
                  console.log(`ℹ️ [SW] 리다이렉트된 URL은 캐시하지 않음: ${url}`)
                  return null
                }
                if (response.ok && response.status === 200) {
                  return cache.put(url, response)
                }
                return null
              })
              .catch(err => {
                console.warn(`⚠️ [SW] 캐시 저장 실패: ${url}`, err)
                return null // 실패해도 계속 진행
              })
          })
        )
      })
      .then(() => {
        console.log('✅ [Service Worker] 설치 완료 (v3)')
      })
      .catch(err => {
        console.error('❌ [Service Worker] 설치 실패:', err)
        // 설치 실패해도 활성화는 진행
      })
  )
})

// ========================
// 🔄 활성화 이벤트
// ========================
self.addEventListener('activate', (event) => {
  console.log('🚀 [Service Worker] 활성화 중... (v3 - 리다이렉트 문제 해결)')
  
  event.waitUntil(
    Promise.all([
      // 모든 이전 캐시 삭제
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log(`🗑️ [SW] 이전 캐시 삭제: ${name}`)
              return caches.delete(name)
            })
        )
      }),
      // 즉시 클라이언트 제어
      self.clients.claim()
    ]).then(() => {
      console.log('✅ [Service Worker] 활성화 완료 (v3)')
      // 모든 클라이언트에 새 버전 알림
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_UPDATED', version: 'v3' })
        })
      })
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
  // ⚠️ 네비게이션 요청은 Service Worker가 완전히 건너뛰고 브라우저가 직접 처리
  // 이렇게 하면 리다이렉트 문제를 완전히 피할 수 있습니다
  if (event.request.mode === 'navigate') {
    return // 브라우저가 직접 처리하도록 함 (리다이렉트 문제 해결)
  }
  
  // API 요청도 건너뛰기
  try {
    const url = new URL(event.request.url)
    if (url.pathname.startsWith('/api/')) {
      return
    }
  } catch (e) {
    return // 잘못된 URL은 건너뛰기
  }
  
  // 나머지 요청(이미지, CSS, JS 등 정적 리소스)만 처리
  // 하지만 리다이렉트 문제를 피하기 위해 최소한으로만 처리
  event.respondWith(
    fetch(event.request, {
      redirect: 'follow',
      credentials: 'same-origin'
    }).catch(() => {
      // 네트워크 실패 시 캐시 확인
      return caches.match(event.request).then(cached => {
        return cached || new Response('', { status: 408 })
      })
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
