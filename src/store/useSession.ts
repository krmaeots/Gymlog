import { create } from 'zustand'
import { coerceState, seedState } from '../lib/storage'
import { flushNow, startCloudSync, stopCloudSync, type SyncStatus } from '../lib/sync'
import { cloud, isCloudConfigured, type ProfileSummary } from '../lib/supabase'
import { useGymStore } from './useGymStore'

const LAST_USER_KEY = 'gymlog:lastUser'

type ProfilesStatus = 'loading' | 'ready' | 'error'

interface SessionInfo {
  id: string
  name: string
  isAdmin: boolean
}

interface SessionState {
  /** Whether cloud mode is active (env configured). */
  cloudEnabled: boolean
  profilesStatus: ProfilesStatus
  profiles: ProfileSummary[]
  /** Logged-in profile, or null when at the picker. */
  session: SessionInfo | null
  /** The active PIN — kept in memory only, never persisted. */
  pin: string | null
  error: string | null
  syncStatus: SyncStatus
  /** Last logged-in name, to pre-select in the picker. */
  lastUserName: string | null

  loadProfiles: () => Promise<void>
  login: (name: string, pin: string) => Promise<boolean>
  logout: () => Promise<void>
}

function isBadPin(e: unknown): boolean {
  const err = e as { code?: string; message?: string }
  return err?.code === '28P01' || /invalid_credentials/.test(err?.message ?? '')
}

export const useSession = create<SessionState>((set, get) => ({
  cloudEnabled: isCloudConfigured,
  profilesStatus: 'loading',
  profiles: [],
  session: null,
  pin: null,
  error: null,
  syncStatus: 'idle',
  lastUserName: (() => {
    try {
      return localStorage.getItem(LAST_USER_KEY)
    } catch {
      return null
    }
  })(),

  loadProfiles: async () => {
    if (!isCloudConfigured) {
      set({ profilesStatus: 'ready' })
      return
    }
    set({ profilesStatus: 'loading', error: null })
    try {
      const profiles = await cloud.listProfiles()
      set({ profiles, profilesStatus: 'ready' })
    } catch {
      set({ profilesStatus: 'error', error: 'Serveriga ei saa ühendust' })
    }
  },

  login: async (name, pin) => {
    set({ error: null })
    try {
      const res = await cloud.login(name, pin)
      useGymStore.getState().hydrate(coerceState(res.state))
      set({ session: { id: res.id, name: res.name, isAdmin: res.is_admin }, pin, error: null })
      try {
        localStorage.setItem(LAST_USER_KEY, res.name)
      } catch {
        /* ignore */
      }
      set({ lastUserName: res.name })
      startCloudSync(
        () => {
          const s = get()
          return s.session && s.pin ? { id: s.session.id, pin: s.pin } : null
        },
        (syncStatus) => set({ syncStatus }),
      )
      return true
    } catch (e) {
      set({ error: isBadPin(e) ? 'Vale PIN' : 'Sisselogimine ebaõnnestus — proovi uuesti' })
      return false
    }
  },

  logout: async () => {
    try {
      await flushNow()
    } catch {
      /* best-effort final push */
    }
    stopCloudSync()
    // Clear in-memory training data so nothing leaks to the next user.
    useGymStore.getState().hydrate(seedState())
    set({ session: null, pin: null, syncStatus: 'idle', error: null })
  },
}))
