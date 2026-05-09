import { ExecutionContext } from '@nestjs/common';
import { WalletAuthGuard } from './wallet-auth.guard';

jest.mock('viem', () => ({
  getAddress: jest.fn((addr: string) => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) throw new Error('Invalid address');
    return addr.toLowerCase() as `0x${string}`;
  }),
  recoverMessageAddress: jest.fn(),
}));

import { getAddress, recoverMessageAddress } from 'viem';

const VALID_ADDRESS = '0x0000000000000000000000000000000000000001';
const VALID_SIG = '0xdeadbeef' as `0x${string}`;

function buildContext(headers: Record<string, string | undefined>, tokenId = '42'): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
        params: { tokenId },
        walletAddress: undefined as `0x${string}` | undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

describe('WalletAuthGuard', () => {
  let guard: WalletAuthGuard;
  const mockRecover = recoverMessageAddress as jest.Mock;
  const mockGetAddress = getAddress as jest.Mock;

  beforeEach(() => {
    guard = new WalletAuthGuard();
    jest.clearAllMocks();
    // Default getAddress: just lowercase the input (same as mock above)
    mockGetAddress.mockImplementation((addr: string) => {
      if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) throw new Error('Invalid address');
      return addr.toLowerCase() as `0x${string}`;
    });
  });

  describe('header validation', () => {
    it('returns false when x-wallet-address is missing', async () => {
      const ctx = buildContext({ 'x-wallet-signature': VALID_SIG, 'x-wallet-timestamp': String(nowSeconds()) });
      expect(await guard.canActivate(ctx)).toBe(false);
    });

    it('returns false when x-wallet-signature is missing', async () => {
      const ctx = buildContext({ 'x-wallet-address': VALID_ADDRESS, 'x-wallet-timestamp': String(nowSeconds()) });
      expect(await guard.canActivate(ctx)).toBe(false);
    });

    it('returns false when x-wallet-timestamp is missing', async () => {
      const ctx = buildContext({ 'x-wallet-address': VALID_ADDRESS, 'x-wallet-signature': VALID_SIG });
      expect(await guard.canActivate(ctx)).toBe(false);
    });
  });

  describe('tokenId validation', () => {
    it('returns false for non-integer tokenId (1e2)', async () => {
      const ctx = buildContext(
        { 'x-wallet-address': VALID_ADDRESS, 'x-wallet-signature': VALID_SIG, 'x-wallet-timestamp': String(nowSeconds()) },
        '1e2',
      );
      expect(await guard.canActivate(ctx)).toBe(false);
      expect(mockRecover).not.toHaveBeenCalled();
    });

    it('returns false for decimal tokenId (1.5)', async () => {
      const ctx = buildContext(
        { 'x-wallet-address': VALID_ADDRESS, 'x-wallet-signature': VALID_SIG, 'x-wallet-timestamp': String(nowSeconds()) },
        '1.5',
      );
      expect(await guard.canActivate(ctx)).toBe(false);
      expect(mockRecover).not.toHaveBeenCalled();
    });
  });

  describe('timestamp window', () => {
    it('returns false when timestamp is more than 120s in the past', async () => {
      const stale = String(nowSeconds() - 121);
      const ctx = buildContext({ 'x-wallet-address': VALID_ADDRESS, 'x-wallet-signature': VALID_SIG, 'x-wallet-timestamp': stale });
      expect(await guard.canActivate(ctx)).toBe(false);
    });

    it('returns false when timestamp is more than 120s in the future', async () => {
      const future = String(nowSeconds() + 121);
      const ctx = buildContext({ 'x-wallet-address': VALID_ADDRESS, 'x-wallet-signature': VALID_SIG, 'x-wallet-timestamp': future });
      expect(await guard.canActivate(ctx)).toBe(false);
    });

    it('accepts timestamp exactly at boundary (120s)', async () => {
      const boundary = String(nowSeconds() - 120);
      mockRecover.mockResolvedValue(VALID_ADDRESS.toLowerCase());
      const ctx = buildContext({ 'x-wallet-address': VALID_ADDRESS, 'x-wallet-signature': VALID_SIG, 'x-wallet-timestamp': boundary });
      expect(await guard.canActivate(ctx)).toBe(true);
    });

    it('returns false for non-numeric timestamp', async () => {
      const ctx = buildContext({ 'x-wallet-address': VALID_ADDRESS, 'x-wallet-signature': VALID_SIG, 'x-wallet-timestamp': 'abc' });
      expect(await guard.canActivate(ctx)).toBe(false);
    });
  });

  describe('address validation', () => {
    it('returns false for malformed wallet address', async () => {
      mockGetAddress.mockImplementation(() => { throw new Error('Invalid address'); });
      const ctx = buildContext({ 'x-wallet-address': 'not-an-address', 'x-wallet-signature': VALID_SIG, 'x-wallet-timestamp': String(nowSeconds()) });
      expect(await guard.canActivate(ctx)).toBe(false);
    });
  });

  describe('signature verification', () => {
    it('returns false when recovered address does not match', async () => {
      const differentAddr = '0x0000000000000000000000000000000000000002';
      mockRecover.mockResolvedValue(differentAddr.toLowerCase());
      const ctx = buildContext({ 'x-wallet-address': VALID_ADDRESS, 'x-wallet-signature': VALID_SIG, 'x-wallet-timestamp': String(nowSeconds()) });
      expect(await guard.canActivate(ctx)).toBe(false);
    });

    it('returns false when recoverMessageAddress throws (malformed signature)', async () => {
      mockRecover.mockRejectedValue(new Error('invalid signature'));
      const ctx = buildContext({ 'x-wallet-address': VALID_ADDRESS, 'x-wallet-signature': VALID_SIG, 'x-wallet-timestamp': String(nowSeconds()) });
      expect(await guard.canActivate(ctx)).toBe(false);
    });

    it('returns true and attaches walletAddress when signature is valid', async () => {
      mockRecover.mockResolvedValue(VALID_ADDRESS.toLowerCase());
      const req = { headers: { 'x-wallet-address': VALID_ADDRESS, 'x-wallet-signature': VALID_SIG, 'x-wallet-timestamp': String(nowSeconds()) }, params: { tokenId: '42' }, walletAddress: undefined as `0x${string}` | undefined };
      const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(req.walletAddress).toBe(VALID_ADDRESS.toLowerCase());
    });
  });
});
