import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://fvpbmiasgrfcpkbcdaua.supabase.co";
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_9q3xhpxMGjyLwd4mqYd0vQ_12J0cK2g";

export const supabaseConfigurationError =
  !url || !anonKey
    ? "MediCrew is not connected to Supabase. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in the Vercel project, then redeploy."
    : null;

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage:
            typeof window === "undefined" ? undefined : window.localStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      })
    : null;
