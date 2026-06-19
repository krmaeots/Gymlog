import type { GymState } from '../domain/types'
import { setPersistSink } from '../store/useGymStore'
import { saveCachedState } from './storage'
import { cloud } from './supabase'

/**
 * Cloud sync for the logged-in profile.
 *
 * Installs itself as the GymStore's persist sink: every state change is cached
 * locally immediately (instant + offline-safe) and pushed to Supabase after a
 * short debounce. Failed pushes stay pending and retry on the next change or
 * when connectivity returns. Conflict policy is last-write-wins per profile.
 */
export type SyncStatus = 'idle' | 'saving' | 'offline' | 'error'
type Creds = { id: string; pin: string }

const DEBOUNCE_MS = 1500

let timer: ReturnType<typeof setTimeout> | undefined
let pending: GymState | null = null
let getCreds: () => Creds | null = () => null
let onStatus: (s: SyncStatus) => void = () => {}

async function flush(): Promise<void> {
  const creds = getCreds()
  if (!creds || !pending) return
  const state = pending
  pending = null
  onStatus('saving')
  try {
    await cloud.push(creds.id, creds.pin, state)
    if (!pending) onStatus('idle')
  } catch {
    pending = pending ?? state // keep newest pending; retry later
    onStatus(navigator.onLine ? 'error' : 'offline')
  }
}

function schedule(state: GymState) {
  const creds = getCreds()
  if (!creds) return
  saveCachedState(creds.id, state) // cache immediately for offline + instant load
  pending = state
  if (timer) clearTimeout(timer)
  timer = setTimeout(flush, DEBOUNCE_MS)
}

/** Begin syncing the active profile. `creds` is read lazily on each push. */
export function startCloudSync(creds: () => Creds | null, status: (s: SyncStatus) => void) {
  getCreds = creds
  onStatus = status
  setPersistSink(schedule)
  window.addEventListener('online', flush)
}

/** Stop syncing (on logout) and drop any pending work. */
export function stopCloudSync() {
  if (timer) clearTimeout(timer)
  timer = undefined
  pending = null
  getCreds = () => null
  onStatus = () => {}
  setPersistSink(() => {})
  window.removeEventListener('online', flush)
}

/** Force an immediate push of any pending state (e.g. before logout). */
export function flushNow(): Promise<void> {
  if (timer) clearTimeout(timer)
  timer = undefined
  return flush()
}
