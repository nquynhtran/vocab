import { z } from 'zod'
import type { SupabaseClient } from './supabaseClient.ts'
import { runRequest } from './supabaseRequest.ts'
import { parseRow } from './supabaseRows.ts'

/**
 * `app_config.min_client_version` (a SQL migration) makes tabs and phones running older code
 * reload instead of writing rows in a shape they no longer understand (#34). Order (#68): push
 * the new nullable columns, deploy this client, and only once it is live raise the minimum, so a
 * failed deploy never locks out the app still online.
 * 2: progress.last_promoted_day (decision #50).
 * 3: files.notes, terms.pronunciation (decision #67).
 */
export const CLIENT_VERSION = 3

const AppConfigSchema = z.object({ minClientVersion: z.int().min(1) })

/** Whether the cloud requires a newer client than this one. */
export async function isClientOutdated(
  client: SupabaseClient,
  onSessionExpired?: () => void,
): Promise<boolean> {
  const row = await runRequest(client.from('app_config').select('min_client_version').single(), {
    onSessionExpired,
  })
  const { minClientVersion } = parseRow(AppConfigSchema, row, 'app_config')
  return minClientVersion > CLIENT_VERSION
}
