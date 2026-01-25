// =====================================================
// 🔔 푸시 알림 유틸리티
// =====================================================

// VAPID 공개 키 (환경 변수에서 가져옴)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

// ========================
// 🔧 Service Worker 등록
// ========================
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('❌ Service Worker not supported')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js')
    console.log('✅ Service Worker 등록 완료:', registration.scope)
    return registration
  } catch (error) {
    console.error('❌ Service Worker 등록 실패:', error)
    return null
  }
}

// ========================
// 🔔 푸시 알림 권한 요청
// ========================
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.log('❌ Notification not supported')
    return 'denied'
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission
  }

  return Notification.permission
}

// ========================
// 📬 푸시 구독 생성
// ========================
export async function subscribeToPush(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  try {
    // 기존 구독 확인
    let subscription = await registration.pushManager.getSubscription()
    
    if (subscription) {
      console.log('📬 기존 푸시 구독 사용')
      return subscription
    }

    // VAPID 키가 없으면 구독 불가
    if (!VAPID_PUBLIC_KEY) {
      console.warn('⚠️ VAPID 공개 키가 설정되지 않았습니다.')
      return null
    }

    // 새 구독 생성
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })

    console.log('✅ 푸시 구독 생성 완료')
    return subscription
  } catch (error) {
    console.error('❌ 푸시 구독 실패:', error)
    return null
  }
}

// ========================
// 📤 서버에 구독 정보 저장
// ========================
export async function saveSubscription(subscription: PushSubscription): Promise<boolean> {
  try {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON())
    })

    return response.ok
  } catch (error) {
    console.error('❌ 구독 저장 실패:', error)
    return false
  }
}

// ========================
// 🧪 테스트 알림 발송
// ========================
export async function sendTestNotification(): Promise<boolean> {
  try {
    const response = await fetch('/api/push/test', {
      method: 'POST'
    })

    return response.ok
  } catch (error) {
    console.error('❌ 테스트 알림 실패:', error)
    return false
  }
}

// ========================
// 🔧 로컬 알림 (즉시 표시)
// ========================
export function showLocalNotification(
  title: string,
  options?: NotificationOptions
): void {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      ...options
    })
  }
}

// ========================
// 🛠️ 유틸리티 함수
// ========================
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

// ========================
// 📋 알림 메시지 템플릿 (닥터 도슨 페르소나)
// ========================
export const notificationMessages = {
  meal: {
    morning: "선생님, 좋은 아침이에요! 건강한 아침 식사로 하루를 시작해보시는 건 어떨까요? 🌅",
    lunch: "선생님, 점심 시간이에요! 균형 잡힌 식사로 오후 에너지를 충전해보세요. 🍱",
    dinner: "선생님, 저녁 시간이 됐네요! 오늘 하루 고생 많으셨어요. 따뜻한 식사 드시면서 쉬세요. 🌙"
  },
  medication: {
    morning: "선생님, 아침 복약 시간이에요. 건강한 하루를 위해 잊지 마세요! 💊",
    evening: "선생님, 저녁 복약 시간이에요. 오늘도 건강 관리 잘 하고 계시네요! 💪"
  },
  exercise: {
    reminder: "선생님, 오늘 운동은 하셨나요? 가벼운 스트레칭이라도 해보시는 건 어떨까요? 🏃"
  },
  cycle: {
    prediction: "선생님, 이번 달 소식이 곧 찾아올 것 같아요. 컨디션 관리에 신경 써주세요. 💕",
    late: "선생님, 이번 달 소식이 조금 늦어지시는 것 같아 걱정되어 연락드렸어요. 몸 상태는 어떠신가요? 혹시 컨디션에 큰 변화가 있다면 가까운 병원 검사를 한 번 받아보시는 것도 권해드리고 싶어요. 🏥"
  }
}

// ========================
// 📅 시간 기반 알림 메시지 선택
// ========================
export function getMealMessage(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 11) return notificationMessages.meal.morning
  if (hour >= 11 && hour < 15) return notificationMessages.meal.lunch
  return notificationMessages.meal.dinner
}

export function getMedicationMessage(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 14) return notificationMessages.medication.morning
  return notificationMessages.medication.evening
}
