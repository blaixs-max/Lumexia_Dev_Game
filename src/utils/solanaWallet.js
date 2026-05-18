// ============================================================================
// DEV MODE STUB - Solana wallet entegrasyonu deaktif.
// ----------------------------------------------------------------------------
// Orijinal dosya: Helius RPC ile bakiye sorgu, SPL token transferi, transaction
// izleme islemleri yapardi. HUD/Game gelistirme icin tum fonksiyonlar mock'a
// cevrildi. Hicbir RPC istegi gonderilmez, hicbir transaction olusturulmaz.
// API yuzeyi orijinal ile ayni tutuldu - cagiranlar (RealLauncherUI) calismaya
// devam eder.
// ============================================================================

import { DEV_MODE, MOCK_TOKEN_BALANCE, MOCK_SOL_BALANCE } from '../devMode';

const log = (...args) => DEV_MODE && console.log('[DEV solanaWallet stub]', ...args);

const fakeConnection = {
  getBalance: async () => MOCK_SOL_BALANCE * 1_000_000_000,
  getParsedTokenAccountsByOwner: async () => ({ value: [] }),
  getSignatureStatuses: async () => ({ value: [{ confirmationStatus: 'confirmed', err: null }] }),
};

export function getConnection() {
  return fakeConnection;
}

export function switchRpcEndpoint() {
  log('switchRpcEndpoint no-op');
  return fakeConnection;
}

export async function getSolBalance() {
  log('getSolBalance ->', MOCK_SOL_BALANCE);
  return MOCK_SOL_BALANCE;
}

export async function getTokenBalance() {
  log('getTokenBalance ->', MOCK_TOKEN_BALANCE);
  return MOCK_TOKEN_BALANCE;
}

export async function checkPaymentBalance(publicKey, usdAmount) {
  const requiredTokens = usdAmount / 0.10;
  log('checkPaymentBalance no-op', { usdAmount, requiredTokens });
  return {
    hasEnoughTokens: true,
    hasEnoughSol: true,
    hasEnough: true,
    tokenBalance: MOCK_TOKEN_BALANCE,
    solBalance: MOCK_SOL_BALANCE,
    requiredTokens,
    minSolRequired: 0.001,
  };
}

export async function transferToken(wallet, usdAmount) {
  log('transferToken no-op (NO TX SENT)', { usdAmount });
  return {
    signature: `dev-mock-sig-${Date.now()}`,
    tokenAmount: usdAmount / 0.10,
    price: 0.10,
  };
}

export async function getTransactionDetails(signature) {
  log('getTransactionDetails no-op', signature);
  return { status: 'success', signature };
}

export async function watchTransaction(signature, onConfirmed) {
  log('watchTransaction no-op (auto-confirm)', signature);
  if (typeof onConfirmed === 'function') {
    setTimeout(() => onConfirmed(signature), 0);
  }
  return signature;
}

export function formatAddress(address) {
  if (!address) return '';
  const s = String(address);
  return s.length > 8 ? `${s.slice(0, 4)}...${s.slice(-4)}` : s;
}

export function isValidSolanaAddress() {
  return true;
}

export function getExplorerUrl(signature) {
  return `https://solscan.io/tx/${signature}`;
}

export function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    window.navigator?.userAgent || ''
  );
}

export function openWalletApp() {
  log('openWalletApp no-op');
}

export default {
  getConnection,
  switchRpcEndpoint,
  getSolBalance,
  getTokenBalance,
  checkPaymentBalance,
  transferToken,
  getTransactionDetails,
  watchTransaction,
  formatAddress,
  isValidSolanaAddress,
  getExplorerUrl,
  isMobileDevice,
  openWalletApp,
};
