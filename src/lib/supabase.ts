import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { GymState, Program, Settings } from '../domain/types'

/**
 * Thin, typed wrapper over the Supabase RPC backend (see supabase/schema.sql).
 *
 * If the env vars are absent the app runs in local-only mode and `isCloud
 * configured` is false — callers must check it before using `cloud`.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isCloudConfigured = Boolean(url && anonKey)

const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(url!, anonKey!, { auth: { persistSession: false } })
  : null

export interface ProfileSummary {
  id: string
  name: string
  is_admin: boolean
}

export interface AdminProfile extends ProfileSummary {
  updated_at: string
}

export interface LoginResult {
  id: string
  name: string
  is_admin: boolean
  state: GymState
  updated_at: string
}

/** Thrown for any backend failure; `.code` carries the Postgres error label. */
export class CloudError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.name = 'CloudError'
    this.code = code
  }
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new CloudError('Cloud not configured')
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new CloudError(error.message, error.code)
  return data as T
}

export const cloud = {
  listProfiles: () => rpc<ProfileSummary[]>('gym_list_profiles', {}),
  login: (name: string, pin: string) =>
    rpc<LoginResult>('gym_login', { p_name: name, p_pin: pin }),
  pull: (id: string, pin: string) =>
    rpc<{ state: GymState; updated_at: string }>('gym_pull', { p_id: id, p_pin: pin }),
  push: (id: string, pin: string, state: GymState) =>
    rpc<string>('gym_push', { p_id: id, p_pin: pin, p_state: state }),

  // admin
  adminList: (adminPin: string) => rpc<AdminProfile[]>('gym_admin_list', { p_admin_pin: adminPin }),
  adminCreate: (adminPin: string, name: string, pin: string, isAdmin: boolean) =>
    rpc<string>('gym_admin_create', {
      p_admin_pin: adminPin,
      p_name: name,
      p_pin: pin,
      p_is_admin: isAdmin,
    }),
  adminResetPin: (adminPin: string, targetId: string, newPin: string) =>
    rpc<null>('gym_admin_reset_pin', {
      p_admin_pin: adminPin,
      p_target_id: targetId,
      p_new_pin: newPin,
    }),
  adminDelete: (adminPin: string, targetId: string) =>
    rpc<null>('gym_admin_delete', { p_admin_pin: adminPin, p_target_id: targetId }),
  adminPull: (adminPin: string, targetId: string) =>
    rpc<{ state: GymState; updated_at: string }>('gym_admin_pull', {
      p_admin_pin: adminPin,
      p_target_id: targetId,
    }),
  adminPushProgram: (adminPin: string, targetId: string, program: Program, settings: Settings) =>
    rpc<string>('gym_admin_push_program', {
      p_admin_pin: adminPin,
      p_target_id: targetId,
      p_program: program,
      p_settings: settings,
    }),
}
