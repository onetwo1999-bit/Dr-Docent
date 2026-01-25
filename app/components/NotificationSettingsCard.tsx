'use client'

import { useState, useEffect } from 'react'
import { 
  Bell, 
  BellOff, 
  Loader2, 
  Check,
  Utensils,
  Dumbbell,
  Pill,
  Heart,
  ChevronRight,
  Settings
} from 'lucide-react'
import {
  registerServiceWorker,
  requestNotificationPermission,
  subscribeToPush,
  saveSubscription,
  showLocalNotification
} from '../lib/pushNotification'
import ScheduleSettingsModal from './ScheduleSettingsModal'

type CategoryType = 'meal' | 'exercise' | 'medication' | 'cycle'

const categoryConfig: Record<CategoryType, { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
  meal: { icon: <Utensils className="w-4 h-4" />, color: 'text-orange-500', bgColor: 'bg-orange-100', label: '식사' },
  exercise: { icon: <Dumbbell className="w-4 h-4" />, color: 'text-blue-500', bgColor: 'bg-blue-100', label: '운동' },
  medication: { icon: <Pill className="w-4 h-4" />, color: 'text-purple-500', bgColor: 'bg-purple-100', label: '복약' },
  cycle: { icon: <Heart className="w-4 h-4" />, color: 'text-pink-500', bgColor: 'bg-pink-100', label: '그날' },
}

export default function NotificationSettingsCard() {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | null>(null)

  useEffect(() => {
    checkNotificationStatus()
  }, [])

  const checkNotificationStatus = async () => {
    if (typeof window === 'undefined') return

    if ('serviceWorker' in navigator && 'Notification' in window) {
      setIsSupported(true)
      setPermission(Notification.permission)

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
      const registration = await registerServiceWorker()
      if (!registration) {
        setMessage('Service Worker 등록에 실패했습니다.')
        return
      }

      const newPermission = await requestNotificationPermission()
      setPermission(newPermission)

      if (newPermission !== 'granted') {
        setMessage('알림 권한이 거부되었습니다.')
        return
      }

      const subscription = await subscribeToPush(registration)
      if (!subscription) {
        setMessage('푸시 알림 설정이 완료되었습니다.')
        setIsSubscribed(true)
        showLocalNotification('닥터 도슨', {
          body: '선생님, 알림이 성공적으로 설정되었어요! 💪',
          tag: 'test-notification'
        })
        return
      }

      const saved = await saveSubscription(subscription)
      if (saved) {
        setMessage('푸시 알림이 활성화되었습니다!')
        setIsSubscribed(true)
      }

      showLocalNotification('닥터 도슨', {
        body: '선생님, 알림이 성공적으로 설정되었어요! 💪',
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
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <p className="text-gray-400 text-sm text-center">
          이 브라우저에서는 푸시 알림을 지원하지 않습니다.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        {/* 헤더 */}
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
          <div className={`mb-4 p-3 rounded-xl text-sm ${
            message.includes('실패') || message.includes('오류')
              ? 'bg-red-50 text-red-600'
              : 'bg-[#2DD4BF]/10 text-[#2DD4BF]'
          }`}>
            {message}
          </div>
        )}

        {/* 권한 거부 안내 */}
        {permission === 'denied' && (
          <div className="mb-4 p-3 bg-yellow-50 text-yellow-700 text-sm rounded-xl">
            ⚠️ 브라우저에서 알림이 차단되어 있습니다.
          </div>
        )}

        {/* 카테고리별 설정 버튼 */}
        {isSubscribed && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 mb-2">카테고리별 상세 설정</p>
            {(Object.entries(categoryConfig) as [CategoryType, typeof categoryConfig.meal][]).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-[#2DD4BF] hover:bg-[#2DD4BF]/5 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.bgColor}`}>
                    <span className={config.color}>{config.icon}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">{config.label} 알림</span>
                </div>
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-gray-300" />
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 스케줄 설정 모달 */}
      {selectedCategory && (
        <ScheduleSettingsModal
          isOpen={!!selectedCategory}
          onClose={() => setSelectedCategory(null)}
          category={selectedCategory}
        />
      )}
    </>
  )
}
