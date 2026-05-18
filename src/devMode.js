// ============================================================================
// DEV MODE - HUD/Game gelistirme icin tum dis entegrasyonlari deaktif eder.
// ----------------------------------------------------------------------------
// Bu kopya, prod GitHub repo'sundan ayrilmis lokal bir test ortamidir.
// Wallet, Supabase, Jupiter price, Edge Function cagrilari kapali.
// Prod davranisini test etmek icin DEV_MODE = false yapmak yeterli DEGIL;
// utils/supabaseClient.js, utils/solanaWallet.js, utils/jupiterPrice.js,
// main.jsx ve RealLauncherUI.jsx dosyalari da prod versiyonlarina geri
// alinmalidir (git history veya prod repo'dan).
// ============================================================================

export const DEV_MODE = true;

// Mock kullanici verisi - launcher ve HUD bunlari gosterir
export const MOCK_WALLET_ADDRESS = 'DEV_MODE_LOCAL_WALLET';
export const MOCK_CREDITS = 999;
export const MOCK_TOKEN_PRICE = 0.10;
export const MOCK_TOKEN_BALANCE = 10000;
export const MOCK_SOL_BALANCE = 10;
