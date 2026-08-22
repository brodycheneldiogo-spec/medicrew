import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors } from '../lib/theme';
import { supabase } from '../lib/supabase';

// Compatibility route for links cached by an older build. Existing accounts
// are routed from their server-side role and never re-accept on login.
export default function LegalConsent() {
  useEffect(() => {
    void (async () => {
      if (!supabase) return router.replace('/auth');
      const { data } = await supabase.rpc('my_account_access_state');
      const state = data as { role?: string; allowed?: boolean } | null;
      if (state?.role === 'admin') return router.replace('/admin');
      if (state?.allowed === false) return router.replace('/pending-review' as never);
      router.replace(state?.role === 'company' ? '/company' : '/home');
    })();
  }, []);

  return <SafeAreaView style={s.safe}><ActivityIndicator size="large" color={colors.green}/></SafeAreaView>;
}

const s = StyleSheet.create({ safe: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper } });
