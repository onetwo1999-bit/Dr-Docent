// =====================================================
// 🔔 닥터 도슨 - Service Worker
// PWA 푸시 알림 및 백그라운드 동작 지원
// =====================================================

// 캐시 버전 업데이트 (강제 갱신)
const CACHE_NAME = 'dr-docent-v2'
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
  console.log('🔧 [Service Worker] 설치 중... (v2)')
  
  // 즉시 활성화하여 이전 버전 교체
  self.skipWaiting()
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 [Service Worker] 캐시 저장 중')
        // 리다이렉트를 허용하여 캐시 저장
        return Promise.all(
          urlsToCache.map(url => {
            return fetch(url, { redirect: 'follow' })
              .then(response => {
                if (response.ok || response.type === 'opaqueredirect') {
                  return cache.put(url, response)
                }
              })
              .catch(err => {
                console.warn(`⚠️ [SW] 캐시 저장 실패: ${url}`, err)
                // 실패해도 계속 진행
              })
          })
        )
      })
      .then(() => {
        console.log('✅ [Service Worker] 설치 완료 (v2)')
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
  console.log('🚀 [Service Worker] 활성화 중... (v2)')
  
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
      console.log('✅ [Service Worker] 활성화 완료 (v2)')
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
  let requestUrl
  try {
    requestUrl = new URL(event.request.url)
  } catch (e) {
    console.warn('⚠️ [SW] 잘못된 URL:', event.request.url, e)
    return // 잘못된 URL은 건너뛰기
  }
  
  // API 요청은 완전히 건너뛰기 (캐시하지 않음)
  if (requestUrl.pathname.startsWith('/api/')) {
    return
  }
  
  // 외부 도메인 요청은 건너뛰기
  const currentOrigin = self.location.origin.replace(/\/$/, '')
  const requestOrigin = requestUrl.origin.replace(/\/$/, '')
  
  if (requestOrigin !== currentOrigin) {
    return
  }
  
  // GET 요청만 캐시 처리
  if (event.request.method !== 'GET') {
    return
  }

  // 요청 URL 정규화
  const normalizedRequestUrl = normalizeUrl(event.request.url)
  
  event.respondWith(
    caches.match(normalizedRequestUrl)
      .then((cachedResponse) => {
        // 캐시에 있으면 캐시 반환
        if (cachedResponse) {
          return cachedResponse
        }
        
        // 네트워크 요청 (리다이렉트 허용, URL 정규화)
        const fetchRequest = new Request(normalizedRequestUrl, {
          method: event.request.method,
          headers: event.request.headers,
          redirect: 'follow', // 리다이렉트 허용
          credentials: 'same-origin',
          cache: 'no-cache' // Service Worker가 캐시 관리
        })
        
        return fetch(fetchRequest)
          .then((response) => {
            // 리다이렉트 응답 처리
            if (response.type === 'opaqueredirect') {
              console.log('🔄 [SW] 리다이렉트 응답 감지:', normalizedRequestUrl)
              // 리다이렉트 응답은 캐시하지 않고 그대로 반환
              return response
            }
            
            // 성공적인 응답만 캐시
            if (response && response.status === 200 && response.type === 'basic') {
              // 응답을 복제하여 캐시에 저장 (원본은 반환)
              const responseToCache = response.clone()
              const cacheKey = new Request(normalizedRequestUrl)
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(cacheKey, responseToCache).catch(err => {
                  console.warn('⚠️ [SW] 캐시 저장 실패:', normalizedRequestUrl, err)
                })
              })
            }
            return response
          })
          .catch((error) => {
            // 리다이렉트 관련 에러는 무시하고 계속 진행
            if (error.name === 'TypeError' && error.message.includes('redirect')) {
              console.log('ℹ️ [SW] 리다이렉트 처리 중:', normalizedRequestUrl)
              // 리다이렉트 에러는 정상적인 동작일 수 있으므로 무시
              return new Response(null, { status: 307, statusText: 'Temporary Redirect' })
            }
            
            console.warn('⚠️ [SW] 네트워크 요청 실패:', normalizedRequestUrl, error)
            
            // 네비게이션 요청이면 오프라인 페이지 반환
            if (event.request.mode === 'navigate') {
              return caches.match('/').then((offlinePage) => {
                return offlinePage || new Response('오프라인입니다', {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'text/html; charset=utf-8' }
                })
              })
            }
            
            // 기타 요청은 에러 반환
            throw error
          })
      })
      .catch((error) => {
        console.error('❌ [SW] Fetch 처리 실패:', event.request.url, error)
        
        // 네비게이션 요청이면 기본 페이지 반환
        if (event.request.mode === 'navigate') {
          return caches.match('/').catch(() => {
            return new Response('오프라인입니다', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            })
          })
        }
        
        // 기타 요청은 네트워크 에러 반환
        return new Response('Network error', {
          status: 408,
          statusText: 'Request Timeout'
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
