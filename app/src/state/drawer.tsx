import { createContext, useContext } from 'react'
import type { DrawerRequest } from '../components/BookingDrawer'

/** Opens the booking drawer from any screen: `open({ id: null })` for a new booking. */
export const DrawerCtx = createContext<(r: DrawerRequest) => void>(() => {})
export const useOpenBooking = () => useContext(DrawerCtx)
