import { create } from 'zustand'
import { coerceState, loadCachedState, seedState } from '../lib/storage'
import { flushNow, startCloudSync, stopCloudSync, type SyncStatus } from '../lib/sync'
import { cloud, isCloudConfigured, type ProfileSummary } from '../lib/supabase'
import { useGymStore } from './useGymStore'

const LAST_USER_KEY = 'gymlog:lastUser'
const SESSION_KEY = 'gymlog:session'

type ProfilesStatus = 'loading' | 'ready' | 'error'

interface SessionInfo {
  id: string
  name: string
  isAdmin: boolean
}

interface PersistedSession extends SessionInfo {
  pin: string
}

// On an installed PWA we keep the login between launches. The PIN is stored
// locally (this is the user's own device) so the app can re-authenticate to
// Supabase on start without a fresh login. "Logi välja" clears it.
function loadPersistedSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as PersistedSession
    return s && typeof s.id === 'string' && typeof s.pin === 'string' ? s : null
  } catch {
    return null
  }
}
function persistSession(s: PersistedSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}
function clearPersistedSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

interface SessionState {
  /** Whether cloud mode is active (env configured). */
  cloudEnabled: boolean
  profilesStatus: ProfilesStatus
  profiles: ProfileSummary[]
  /** Logged-in profile, or null when at the picker. */
  session: SessionInfo | null
  /** The active PIN (also persisted locally so login survives app restarts). */
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

/** Point the sync layer at the currently logged-in profile's credentials. */
function attachSync() {
  startCloudSync(
    () => {
      const s = useSession.getState()
      return s.session && s.pin ? { id: s.session.id, pin: s.pin } : null
    },
    (syncStatus) => useSession.setState({ syncStatus }),
  )
}

const restored = isCloudConfigured ? loadPersistedSession() : null

export const useSession = create<SessionState>((set) => ({
  cloudEnabled: isCloudConfigured,
  profilesStatus: restored ? 'ready' : 'loading',
  profiles: [],
  session: restored ? { id: restored.id, name: restored.name, isAdmin: restored.isAdmin } : null,
  pin: restored?.pin ?? null,
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
      persistSession({ id: res.id, name: res.name, isAdmin: res.is_admin, pin })
      attachSync()
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
    clearPersistedSession()
    // Clear in-memory training data so nothing leaks to the next user.
    useGymStore.getState().hydrate(seedState())
    set({ session: null, pin: null, syncStatus: 'idle', error: null })
  },
}))

// Restore a saved login on launch: hydrate instantly from the local cache, wire
// up sync, then refresh from the cloud in the background. If the PIN no longer
// works (e.g. an admin reset it), drop back to the login screen.
if (restored) {
  const cached = loadCachedState(restored.id)
  if (cached) useGymStore.getState().hydrate(cached)
  attachSync()
  cloud
    .pull(restored.id, restored.pin)
    .then((r) => useGymStore.getState().hydrate(coerceState(r.state)))
    .catch((e) => {
      if (isBadPin(e)) void useSession.getState().logout()
    })
}
