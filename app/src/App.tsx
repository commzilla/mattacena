import { useCallback, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BookingDrawer, type DrawerRequest } from './components/BookingDrawer'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Oggi } from './pages/Oggi'
import { Prenotazioni } from './pages/Prenotazioni'
import { Soon } from './pages/Soon'
import { AuthProvider, useAuth } from './state/auth'
import { DataProvider, useData } from './state/data'
import { DrawerCtx } from './state/drawer'
import { ACCESS, type View } from './state/permissions'
import { ToastProvider } from './state/toast'

function Screens() {
  const { user } = useAuth()
  const { boot } = useData()
  const [drawer, setDrawer] = useState<DrawerRequest | null>(null)
  const open = useCallback((r: DrawerRequest) => setDrawer(r), [])
  const close = useCallback(() => setDrawer(null), [])
  if (!user) return null
  const allowed = ACCESS[user.role]
  const page = (v: View) => {
    if (!allowed.includes(v)) return <Navigate to="/oggi" replace />
    if (v === 'oggi') return <Oggi />
    if (v === 'prenotazioni') return <Prenotazioni />
    return <Soon view={v} />
  }

  return (
    <DrawerCtx.Provider value={open}>
      <Layout onNewBooking={() => open({ id: null })}>
        <Routes>
          {(['oggi', 'sala', 'prenotazioni', 'calendario', 'fidelity', 'impostazioni', 'modulo'] as View[]).map((v) => (
            <Route key={v} path={'/' + v} element={page(v)} />
          ))}
          <Route path="*" element={<Navigate to="/oggi" replace />} />
        </Routes>
      </Layout>
      {/* Keyed so a different booking always starts from fresh form state. */}
      {drawer && boot && <BookingDrawer key={(drawer.id || 'new') + (drawer.table || '')} req={drawer} onClose={close} />}
    </DrawerCtx.Provider>
  )
}

function Gate() {
  const { user, ready } = useAuth()
  if (!ready) return <div className="loading">Caricamento…</div>
  if (!user) return <Login />
  return (
    <DataProvider>
      <Screens />
    </DataProvider>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
