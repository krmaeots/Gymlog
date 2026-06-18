import { create } from 'zustand'

interface RestTimerState {
  /** Total duration of the current rest (seconds). */
  duration: number
  /** Seconds remaining. */
  remaining: number
  running: boolean
  /** Whether the floating timer UI is shown. */
  active: boolean
  start: (seconds: number) => void
  toggle: () => void
  addTime: (delta: number) => void
  dismiss: () => void
}

let interval: ReturnType<typeof setInterval> | undefined

function clearTick() {
  if (interval) {
    clearInterval(interval)
    interval = undefined
  }
}

/** Alert the user that rest is over: vibrate + a short beep, both best-effort. */
function notifyDone() {
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    /* unsupported */
  }
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
    osc.onended = () => ctx.close()
  } catch {
    /* audio unavailable */
  }
}

export const useRestTimer = create<RestTimerState>((set, get) => {
  // Single shared tick + (re)start, so start/toggle/addTime can't drift apart.
  const tick = () => {
    const remaining = get().remaining - 1
    if (remaining <= 0) {
      clearTick()
      set({ remaining: 0, running: false })
      notifyDone()
    } else {
      set({ remaining })
    }
  }
  const run = () => {
    clearTick()
    set({ running: true })
    interval = setInterval(tick, 1000)
  }

  return {
    duration: 0,
    remaining: 0,
    running: false,
    active: false,

    start: (seconds) => {
      set({ duration: seconds, remaining: seconds, active: true })
      run()
    },

    toggle: () => {
      const { running, remaining } = get()
      if (remaining <= 0) return
      if (running) {
        clearTick()
        set({ running: false })
      } else {
        run()
      }
    },

    addTime: (delta) => {
      const { remaining, duration, running } = get()
      const wasDone = remaining <= 0
      const next = Math.max(0, remaining + delta)
      set({ remaining: next, duration: Math.max(duration, next) })
      // Adding time onto a finished timer resumes the countdown (otherwise it
      // would sit frozen). A deliberately paused timer stays paused.
      if (next > 0 && wasDone && !running) run()
    },

    dismiss: () => {
      clearTick()
      set({ active: false, running: false, remaining: 0 })
    },
  }
})
