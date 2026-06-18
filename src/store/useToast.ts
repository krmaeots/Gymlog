import { create } from 'zustand'

interface ToastState {
  message: string
  visible: boolean
  show: (message: string) => void
}

let hideTimer: ReturnType<typeof setTimeout> | undefined

/** Tiny global toast — any component can trigger a transient message. */
export const useToast = create<ToastState>((set) => ({
  message: '',
  visible: false,
  show: (message) => {
    set({ message, visible: true })
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => set({ visible: false }), 3000)
  },
}))
