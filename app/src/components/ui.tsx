import type { Status } from '../domain/types'
import { STATUS_CLASS, STATUS_LABEL } from '../domain/types'

const PATHS = {
  oggi: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 2"/></svg>',
  sala: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="2.5" width="15" height="15" rx="1.5"/><circle cx="7" cy="7" r="1.8"/><rect x="11" y="11" width="4" height="4" rx=".6"/><circle cx="14" cy="6.5" r="1.3"/></svg>',
  prenotazioni: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 5h10M7 10h10M7 15h10"/><circle cx="3.5" cy="5" r=".9" fill="currentColor"/><circle cx="3.5" cy="10" r=".9" fill="currentColor"/><circle cx="3.5" cy="15" r=".9" fill="currentColor"/></svg>',
  calendario: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="4" width="15" height="13.5" rx="1.5"/><path d="M2.5 8.5h15M6.5 2v4M13.5 2v4" stroke-linecap="round"/></svg>',
  fidelity: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="m10 2.5 2.3 4.8 5.2.7-3.8 3.6.9 5.2L10 14.3l-4.6 2.5.9-5.2L2.5 8l5.2-.7z"/></svg>',
  impostazioni: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 5.5h8M15 5.5h2M3 14.5h2M9 14.5h8"/><circle cx="13" cy="5.5" r="2"/><circle cx="7" cy="14.5" r="2"/></svg>',
  modulo: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5.5" y="1.5" width="9" height="17" rx="2"/><path d="M9 15.5h2" stroke-linecap="round"/></svg>',
  menu: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3.5 6h13M3.5 10h13M3.5 14h13"/></svg>',
  plus: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>',
  left: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 5 8l5 5"/></svg>',
  right: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 3 5 5-5 5"/></svg>',
  close: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  note: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" style="flex:none;margin-top:2px"><path d="M3 2.5h10v8l-3 3H3z"/><path d="M10 13.5v-3h3"/></svg>',
} as const

export type IconName = keyof typeof PATHS

/** Static, trusted SVG markup only. */
export const Icon = ({ name }: { name: IconName }) => (
  <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: PATHS[name] }} />
)

export const Pill = ({ status }: { status: Status }) => <span className={'pill ' + STATUS_CLASS[status]}>{STATUS_LABEL[status]}</span>
