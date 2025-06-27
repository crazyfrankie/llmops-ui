import { post } from '@/utils/request.ts'
import type { DebugAppResponse } from '@/models/app.ts'

export const debugApp = (app_id: string, query: string) => {
  return post<DebugAppResponse>(`/app/${app_id}`, {
    body: { query },
  })
}
