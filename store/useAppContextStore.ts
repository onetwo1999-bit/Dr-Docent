import { create } from 'zustand'

export interface AppAction {
  type: string
  label: string
  detail?: string
  path?: string
  at: number
}

const MAX_ACTIONS = 10
const FOR_API_COUNT = 5

interface AppContextState {
  recentActions: AppAction[]
  dashboardEnteredAt: number | null
  lastHealthLogAt: number | null
  pushAction: (action: Omit<AppAction, 'at'>) => void
  setDashboardEnteredAt: (at: number | null) => void
  setLastHealthLogAt: (at: number | null) => void
  getRecentActionsForAPI: () => AppAction[]
  getHesitationHint: () => boolean
}

export const useAppContextStore = create<AppContextState>((set, get) => ({
  recentActions: [],
  dashboardEnteredAt: null,
  lastHealthLogAt: null,

  pushAction: (action) => set((state) => ({
    recentActions: [
      { ...action, at: Date.now() },
      ...state.recentActions.slice(0, MAX_ACTIONS - 1)
    ]
  })),

  setDashboardEnteredAt: (at) => set({ dashboardEnteredAt: at }),
  setLastHealthLogAt: (at) => set({ lastHealthLogAt: at }),

  getRecentActionsForAPI: () => {
    return get().recentActions.slice(0, FOR_API_COUNT)
  },

  getHesitationHint: () => {
    const { dashboardEnteredAt, lastHealthLogAt } = get()
    if (!dashboardEnteredAt) return false
    const now = Date.now()
    const twoMin = 2 * 60 * 1000
    const fiveMin = 5 * 60 * 1000
    const onDashboardLong = (now - dashboardEnteredAt) >= twoMin
    const noRecentLog = !lastHealthLogAt || (now - lastHealthLogAt) >= fiveMin
    return onDashboardLong && noRecentLog
  }
}))
