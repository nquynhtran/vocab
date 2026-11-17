import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { runRequest } from './supabaseRequest.ts'
import { parseRow } from './supabaseRows.ts'

/**
 * `app_config.min_client_version` (a SQL migration) makes tabs and phones running older code
 * reload instead of writing rows in a shape they no longer understand (#34). Order (#68): push
 * the new nullable columns, deploy this client, and only once it is live raise the minimum, so a
 * failed deploy never locks out the app still online.
 * 2: progress.last_promoted_day (decision #50).
 * 3: files.notes, terms.pronunciation (decision #67).
 * 4: terms.kind and terms.parts_of_speech (#90). Sent as the X-Client-Version header on every
 *    request, which the write gate of migration B checks (docs/cloud-sync.md).
 */
export const CLIENT_VERSION = 4

/** Header the server's write gate reads. A build older than this sends nothing or a smaller number. */
export const CLIENT_VERSION_HEADER = 'x-client-version'

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
