import { useState, type CSSProperties } from 'react'
import { BottomNav, type View } from './components/BottomNav'
import { Header } from './components/Header'
import { RestTimer } from './components/RestTimer'
import { Toast } from './components/Toast'
import { HistoryView } from './views/HistoryView'
import { ProgramEditor } from './views/ProgramEditor'
import { WorkoutView } from './views/WorkoutView'
import { colors } from './theme'

export default function App() {
  const [view, setView] = useState<View>('workout')

  return (
    <div style={S.app}>
      <Header />
      <main>
        {view === 'workout' && <WorkoutView />}
        {view === 'history' && <HistoryView />}
        {view === 'program' && <ProgramEditor />}
      </main>
      <RestTimer />
      <Toast />
      <BottomNav view={view} onChange={setView} />
    </div>
  )
}

const S = {
  app: { background: colors.bg, minHeight: '100vh', color: colors.text, fontSize: 14 } as CSSProperties,
}
