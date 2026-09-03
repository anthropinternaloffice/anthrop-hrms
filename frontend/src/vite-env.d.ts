/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase Project URL. Project Settings → API. */
  readonly VITE_SUPABASE_URL: string
  /** Supabase anon/public key. Never the service_role key (rule 6). */
  readonly VITE_SUPABASE_ANON_KEY: string
  /**
   * Optional override for the site address. Normally unset: the address
   * is read from window.location.origin so it can never go stale. Only
   * needed when serving from behind a proxy on a different public
   * address than the browser sees.
   */
  readonly VITE_SITE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
