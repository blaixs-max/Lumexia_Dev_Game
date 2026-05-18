// ============================================================================
// DEV MODE STUB - Token fiyat sorgu API'leri (DexScreener + Jupiter) deaktif.
// ----------------------------------------------------------------------------
// Orijinal dosya her 30 saniyede bir DexScreener ve Jupiter API'lerine fetch
// gonderirdi. HUD/Game gelistirme icin sabit fiyat dondurulur, hicbir external
// HTTP istegi gonderilmez.
// ============================================================================

import { DEV_MODE, MOCK_TOKEN_PRICE } from '../devMode';

const log = (...args) => DEV_MODE && console.log('[DEV jupiterPrice stub]', ...args);

export async function getTokenPrice() {
  log('getTokenPrice ->', MOCK_TOKEN_PRICE);
  return MOCK_TOKEN_PRICE;
}

export async function calculateTokenAmount(usdAmount) {
  return {
    tokenAmount: usdAmount / MOCK_TOKEN_PRICE,
    price: MOCK_TOKEN_PRICE,
  };
}

export function formatPrice(price) {
  if (price === null || price === undefined) return '-';
  return `$${Number(price).toFixed(4)}`;
}

export async function getTokenPriceWithRetry() {
  return MOCK_TOKEN_PRICE;
}

export function clearPriceCache() {
  log('clearPriceCache no-op');
}

export default {
  getTokenPrice,
  calculateTokenAmount,
  formatPrice,
  getTokenPriceWithRetry,
  clearPriceCache,
};
