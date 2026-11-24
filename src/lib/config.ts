// Inlined at build time. If any is empty the app runs in local DEMO mode.
// (EXPO_PUBLIC_ values ship inside the app, so they must be public: the Supabase *anon* key only, never a secret.)
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const cloudEnabled = !!(API_URL && SUPABASE_URL && SUPABASE_ANON_KEY);
