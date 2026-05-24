import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configuredSiteUrl = import.meta.env.VITE_SITE_URL;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export function getAuthRedirectUrl(suffix = "") {
  const baseUrl =
    configuredSiteUrl?.trim().replace(/\/$/, "") ||
    (typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname.replace(/\/$/, "")}` : "");

  return `${baseUrl}${suffix}`;
}

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null;
