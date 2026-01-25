'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2, Check } from 'lucide-react'
import {
  registerServiceWorker,
  requestNotificationPermission,
  subscribeToPush,
  saveSubscription,
  showLocalNotification
} from '../lib/pushNotification'

interface PushNotificationProviderProps {
  children: React.ReactNode
}

export default function PushNotificationProvider({ children }: PushNotificationProviderProps) {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    // 브라우저 지원 확인
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'Notification' in window) {
      setIsSupported(true)
      setPermission(Notification.permission)

      // Service Worker 자동 등록
      registerServiceWorker()
    }
  }, [])

  return <>{children}</>
}

// ========================
// 🔔 알림 설정 컴포넌트
// ========================
export function NotificationSettings() {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    checkNotificationStatus()
  }, [])

  const checkNotificationStatus = async () => {
    if (typeof window === 'undefined') return

    if ('serviceWorker' in navigator && 'Notification' in window) {
      setIsSupported(true)
      setPermission(Notification.permission)

      // 이미 구독 중인지 확인
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        setIsSubscribed(!!subscription)
      } catch (error) {
        console.error('구독 상태 확인 실패:', error)
      }
    }
  }

  const handleEnableNotifications = async () => {
    setIsLoading(true)
    setMessage(null)

    try {
      // 1. Service Worker 등록
      const registration = await registerServiceWorker()
      if (!registration) {
        setMessage('Service Worker 등록에 실패했습니다.')
        return
      }

      // 2. 권한 요청
      const newPermission = await requestNotificationPermission()
      setPermission(newPermission)

      if (newPermission !== 'granted') {
        setMessage('알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.')
        return
      }

      // 3. 푸시 구독
      const subscription = await subscribeToPush(registration)
      if (!subscription) {
        // VAPID 키가 없어도 로컬 알림은 사용 가능
        setMessage('푸시 알림 설정이 완료되었습니다. (로컬 알림 모드)')
        setIsSubscribed(true)
        
        // 테스트 알림
        showLocalNotification('닥터 도슨', {
          body: '선생님, 알림이 성공적으로 설정되었어요! 건강 관리를 도와드릴게요. 💪',
          tag: 'test-notification'
        })
        return
      }

      // 4. 서버에 구독 정보 저장
      const saved = await saveSubscription(subscription)
      if (saved) {
        setMessage('푸시 알림이 활성화되었습니다!')
        setIsSubscribed(true)
      } else {
        setMessage('알림 설정은 완료되었지만, 서버 저장에 실패했습니다.')
        setIsSubscribed(true)
      }

      // 테스트 알림
      showLocalNotification('닥터 도슨', {
        body: '선생님, 알림이 성공적으로 설정되었어요! 건강 관리를 도와드릴게요. 💪',
        tag: 'test-notification'
      })

    } catch (error) {
      console.error('알림 설정 실패:', error)
      setMessage('알림 설정 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisableNotifications = async () => {
    setIsLoading(true)

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      
      if (subscription) {
        await subscription.unsubscribe()
      }

      setIsSubscribed(false)
      setMessage('알림이 비활성화되었습니다.')
    } catch (error) {
      console.error('알림 비활성화 실패:', error)
      setMessage('알림 비활성화 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isSupported) {
    return (
      <div className="p-4 bg-gray-50 rounded-2xl text-gray-500 text-sm">
        이 브라우저에서는 푸시 알림을 지원하지 않습니다.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isSubscribed ? 'bg-[#2DD4BF]/10' : 'bg-gray-100'
          }`}>
            {isSubscribed ? (
              <Bell className="w-5 h-5 text-[#2DD4BF]" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">건강 알림</h3>
            <p className="text-xs text-gray-400">
              {isSubscribed ? '알림이 활성화되어 있습니다' : '알림을 받아보세요'}
            </p>
          </div>
        </div>

        <button
          onClick={isSubscribed ? handleDisableNotifications : handleEnableNotifications}
          disabled={isLoading}
          className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
            isSubscribed
              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              : 'bg-[#2DD4BF] text-white hover:bg-[#26b8a5]'
          } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isSubscribed ? (
            '끄기'
          ) : (
            '켜기'
          )}
        </button>
      </div>

      {/* 상태 메시지 */}
      {message && (
        <div className={`p-3 rounded-xl text-sm ${
          message.includes('실패') || message.includes('오류')
            ? 'bg-red-50 text-red-600'
            : 'bg-[#2DD4BF]/10 text-[#2DD4BF]'
        }`}>
          {message}
        </div>
      )}

      {/* 권한 거부 안내 */}
      {permission === 'denied' && (
        <div className="mt-3 p-3 bg-yellow-50 text-yellow-700 text-sm rounded-xl">
          ⚠️ 브라우저에서 알림이 차단되어 있습니다.
          <br />
          브라우저 설정 → 사이트 설정 → 알림에서 허용해주세요.
        </div>
      )}

      {/* 알림 종류 안내 */}
      {isSubscribed && (
        <div className="mt-4 space-y-2 text-sm text-gray-500">
          <p className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#2DD4BF]" />
            식사 시간 알림 (아침, 점심, 저녁)
          </p>
          <p className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#2DD4BF]" />
            복약 시간 알림
          </p>
          <p className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#2DD4BF]" />
            운동 리마인더
          </p>
          <p className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#2DD4BF]" />
            건강 주기 케어 알림
          </p>
        </div>
      )}
    </div>
  )
}
