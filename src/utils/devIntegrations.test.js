import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEV_MODE, MOCK_SOL_BALANCE, MOCK_TOKEN_BALANCE, MOCK_TOKEN_PRICE } from '../devMode';
import { calculateTokenAmount, clearPriceCache, getTokenPrice, getTokenPriceWithRetry } from './jupiterPrice';
import { checkPaymentBalance, getConnection, getSolBalance, getTokenBalance, getTransactionDetails, transferToken, watchTransaction } from './solanaWallet';

// These tests exercise the actual shipped adapters, not mocks of them. The
// only mocked boundaries are network/wallet capabilities that must stay idle.
describe.skipIf(!DEV_MODE)('offline development integration isolation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network access in offline practice'); }));
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('resolves prices without fetching, including cache reset and retry entry points', async () => {
    clearPriceCache();
    expect(await getTokenPrice()).toBe(MOCK_TOKEN_PRICE);
    expect(await getTokenPriceWithRetry(3)).toBe(MOCK_TOKEN_PRICE);
    const quote = await calculateTokenAmount(2);
    expect(quote.price).toBe(MOCK_TOKEN_PRICE);
    expect(quote.tokenAmount * quote.price).toBeCloseTo(2);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns development balances without accessing a supplied RPC connection', async () => {
    const rpc = {
      getAccountInfo: vi.fn(() => { throw new Error('Unexpected account RPC'); }),
      getBalance: vi.fn(() => { throw new Error('Unexpected balance RPC'); }),
    };
    expect(await getTokenBalance(null, rpc)).toBe(MOCK_TOKEN_BALANCE);
    expect(await getSolBalance(null, rpc)).toBe(MOCK_SOL_BALANCE);
    expect(await getConnection().getBalance()).toBe(MOCK_SOL_BALANCE * 1_000_000_000);
    await checkPaymentBalance(null, 2);
    expect(rpc.getAccountInfo).not.toHaveBeenCalled();
    expect(rpc.getBalance).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('never signs or sends a transaction through the legacy development payment entry point', async () => {
    const wallet = {
      signTransaction: vi.fn(() => { throw new Error('Unexpected wallet signature'); }),
      sendTransaction: vi.fn(() => { throw new Error('Unexpected wallet transfer'); }),
      signAndSendTransaction: vi.fn(() => { throw new Error('Unexpected wallet transfer'); }),
    };
    const result = await transferToken(wallet, 2);
    expect(result.signature).toMatch(/^dev-mock-sig-/);
    expect(wallet.signTransaction).not.toHaveBeenCalled();
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
    expect(wallet.signAndSendTransaction).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('settles development confirmation callbacks locally without starting a poller', async () => {
    vi.useFakeTimers();
    const confirmed = vi.fn();
    const signature = 'dev-mock-sig-test';
    await watchTransaction(signature, confirmed);
    expect(confirmed).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(confirmed).toHaveBeenCalledExactlyOnceWith(signature);
    expect(await getTransactionDetails(signature)).toMatchObject({ signature });
    expect(vi.getTimerCount()).toBe(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
