import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

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
