import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { runRequest } from './supabaseRequest.ts'
import { parseRow } from './supabaseRows.ts'

/**
 * Raised together with `app_config.min_client_version` (a SQL migration): tabs and phones still
 * running older code reload instead of writing rows in a shape they no longer understand (#34).
 * When this client needs the migration's columns, push the migration first and deploy right
 * after; meanwhile old clients show a Reload button (reload.ts stops the reload loop).
 * 2: progress.last_promoted_day (decision #50).
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
