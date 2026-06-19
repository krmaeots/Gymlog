/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Supabase project URL (optional — absent ⇒ local-only mode). */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon public key (public-safe; security is enforced by RLS). */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
