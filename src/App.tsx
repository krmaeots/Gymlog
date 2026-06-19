import { useEffect, useState, type CSSProperties } from 'react'
import { BottomNav, type View } from './components/BottomNav'
import { Header } from './components/Header'
import { RestTimer } from './components/RestTimer'
import { Toast } from './components/Toast'
import { useSession } from './store/useSession'
import { AdminView } from './views/AdminView'
import { HistoryView } from './views/HistoryView'
import { LoginView } from './views/LoginView'
import { ProgramEditor } from './views/ProgramEditor'
import { WorkoutView } from './views/WorkoutView'
import { colors } from './theme'

export default function App() {
  const cloudEnabled = useSession((s) => s.cloudEnabled)
  const session = useSession((s) => s.session)
  const [view, setView] = useState<View>('workout')

  // On login (or user switch) always land on the workout view.
  useEffect(() => {
    setView('workout')
  }, [session?.id])

  // Cloud mode: gate the whole app behind the profile picker + PIN.
  if (cloudEnabled && !session) return <LoginView />

  const isAdmin = !!session?.isAdmin

  return (
    <div style={S.app}>
      <Header />
      <main>
        {view === 'workout' && <WorkoutView />}
        {view === 'history' && <HistoryView />}
        {view === 'program' && <ProgramEditor />}
        {view === 'admin' && isAdmin && <AdminView />}
      </main>
      <RestTimer />
      <Toast />
      <BottomNav view={view} onChange={setView} showAdmin={isAdmin} />
    </div>
  )
}

const S = {
  app: { background: colors.bg, minHeight: '100vh', color: colors.text, fontSize: 14 } as CSSProperties,
}
