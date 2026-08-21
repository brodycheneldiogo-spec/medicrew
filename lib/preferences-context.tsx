import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { Currency, Language, deviceLanguage, formatMoney, t, TranslationKey } from './i18n';

type FxRates = Record<string, number>;
type PreferencesContextValue = {
  language: Language;
  currency: Currency;
  ready: boolean;
  setLanguage: (language: Language) => void;
  setCurrency: (currency: Currency) => void;
  save: (language: Language, currency: Currency) => Promise<void>;
  tr: (key: TranslationKey) => string;
  money: (cents: number, originalCurrency?: string) => { original: string; display?: string };
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(deviceLanguage());
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [rates, setRates] = useState<FxRates>({ EUR: 1 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const c = supabase;
      if (!c) { if (alive) setReady(true); return; }
      const { data: { user } } = await c.auth.getUser();
      if (user) {
        const { data } = await c.from('profiles').select('preferred_language,preferred_currency').eq('id', user.id).maybeSingle();
        if (alive && (data?.preferred_language === 'en' || data?.preferred_language === 'fr' || data?.preferred_language === 'es')) setLanguage(data.preferred_language);
        if (alive && ['EUR','USD','GBP','CHF'].includes(data?.preferred_currency)) setCurrency(data.preferred_currency as Currency);
      }
      if (alive) setReady(true);
    };
    void load();
    const sub = supabase?.auth.onAuthStateChange(() => { void load(); });
    return () => { alive = false; sub?.data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let alive = true;
    const loadRates = async () => {
      try {
        const r = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,CHF');
        if (!r.ok) return;
        const json = await r.json() as { rates?: FxRates };
        if (alive && json.rates) setRates({ EUR: 1, ...json.rates });
      } catch { /* Conversion stays unavailable; contractual amount is still shown. */ }
    };
    void loadRates();
    return () => { alive = false; };
  }, []);

  async function save(nextLanguage: Language, nextCurrency: Currency) {
    setLanguage(nextLanguage); setCurrency(nextCurrency);
    const c = supabase; if (!c) return;
    const { data: { user } } = await c.auth.getUser();
    if (!user) throw new Error('Sign in required');
    const { error } = await c.from('profiles').update({ preferred_language: nextLanguage, preferred_currency: nextCurrency }).eq('id', user.id);
    if (error) throw error;
  }

  const value = useMemo<PreferencesContextValue>(() => ({
    language, currency, ready, setLanguage, setCurrency, save,
    tr: (key) => t(language, key),
    money: (cents, originalCurrency = 'EUR') => {
      const original = formatMoney(cents, originalCurrency, language);
      if (currency === originalCurrency) return { original };
      const originalRate = rates[originalCurrency]; const targetRate = rates[currency];
      if (!originalRate || !targetRate) return { original };
      const eurAmount = (cents / 100) / originalRate;
      const convertedCents = Math.round(eurAmount * targetRate * 100);
      return { original, display: `≈ ${formatMoney(convertedCents, currency, language)}` };
    }
  }), [language, currency, ready, rates]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider');
  return value;
}
