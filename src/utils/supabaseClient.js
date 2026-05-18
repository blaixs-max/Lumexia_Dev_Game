// ============================================================================
// DEV MODE STUB - Supabase entegrasyonu deaktif.
// ----------------------------------------------------------------------------
// Orijinal dosya: getOrCreateUser, getUserCredits, useCredit (Edge Function)
// uzerinden Supabase'e yazip okuyordu. HUD/Game gelistirme icin tum cagrilar
// no-op'a cevrildi. Network istegi gonderilmez, hicbir tablo okunmaz/yazilmaz.
// Prod davranisi icin: src/devMode.js kommentindeki talimatlara bak.
// ============================================================================

import { DEV_MODE, MOCK_WALLET_ADDRESS, MOCK_CREDITS } from '../devMode';

// Supabase client'i kullanan tek diger yer GameOverUI -> functions.invoke('submit-score').
// Ona da no-op donen sahte bir nesne saglariz ki import patlamasin.
export const supabase = {
  from: () => ({
    select: () => ({
      eq: () => ({ single: async () => ({ data: null, error: null }) }),
      single: async () => ({ data: null, error: null }),
    }),
    insert: () => ({
      select: () => ({ single: async () => ({ data: null, error: null }) }),
    }),
    update: () => ({
      eq: () => ({ select: async () => ({ data: null, error: null }) }),
    }),
  }),
  functions: {
    invoke: async (name, opts) => {
      if (DEV_MODE) {
        console.log(`[DEV] supabase.functions.invoke('${name}') no-op:`, opts?.body);
      }
      return { data: { ok: true, dev: true }, error: null };
    },
  },
};

export const getOrCreateUser = async (walletAddress) => {
  if (DEV_MODE) console.log('[DEV] getOrCreateUser no-op for', walletAddress);
  return {
    wallet_address: walletAddress || MOCK_WALLET_ADDRESS,
    credits: MOCK_CREDITS,
    total_games_played: 0,
    total_spent: 0,
  };
};

export const getUserCredits = async (walletAddress) => {
  if (DEV_MODE) console.log('[DEV] getUserCredits no-op for', walletAddress);
  return MOCK_CREDITS;
};

export const useCredit = async (walletAddress, amount = 1) => {
  if (DEV_MODE) console.log(`[DEV] useCredit no-op (${amount} credit not deducted)`);
  return {
    credits: MOCK_CREDITS,
    total_games_played: 0,
  };
};
