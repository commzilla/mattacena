import type { Api } from './client'
import { createMockApi } from './mock'
import { createWpApi } from './wp'

const mode = import.meta.env.VITE_API_MODE === 'wp' ? 'wp' : 'mock'

export const api: Api =
  mode === 'wp' ? createWpApi(import.meta.env.VITE_API_BASE || 'https://mattacena.com/wp-json/mattacena/v1') : createMockApi()

export { ApiError } from './client'
