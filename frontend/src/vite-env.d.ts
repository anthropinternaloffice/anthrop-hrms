/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase Project URL. Project Settings → API. */
  readonly VITE_SUPABASE_URL: string
  /** Supabase anon/public key. Never the service_role key (rule 6). */
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Where this deployment lives, no trailing slash. Password reset links here. */
  readonly VITE_SITE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
