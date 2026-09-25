import type { Role } from '../domain/types'

export type View = 'oggi' | 'sala' | 'prenotazioni' | 'calendario' | 'fidelity' | 'impostazioni' | 'modulo'

/** Which screens each role can open. The WordPress API enforces the same rules on every request. */
export const ACCESS: Record<Role, View[]> = {
  titolare: ['oggi', 'sala', 'prenotazioni', 'calendario', 'fidelity', 'impostazioni', 'modulo'],
  responsabile: ['oggi', 'sala', 'prenotazioni', 'calendario', 'fidelity'],
  cameriere: ['oggi', 'sala'],
}

export const can = (role: Role, view: View) => ACCESS[role].includes(view)
/** Only these roles may delete bookings or edit the floor plan. */
export const canManage = (role: Role) => role !== 'cameriere'
