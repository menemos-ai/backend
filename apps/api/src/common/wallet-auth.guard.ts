import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { getAddress, recoverMessageAddress } from 'viem';

/**
 * Verifies an EIP-191 wallet signature before allowing access to a memory token.
 *
 * The caller must supply three HTTP headers:
 *   x-wallet-address    — the EIP-55 checksummed caller address
 *   x-wallet-signature  — `personal_sign` of the challenge message (see below)
 *   x-wallet-timestamp  — Unix timestamp in seconds (must be within 5 minutes of now)
 *
 * Challenge message format (the string that was signed):
 *   `mnemos:access:<tokenId>:<checksummedAddress>:<timestamp>`
 *
 * On success: attaches `request.walletAddress` (the verified address) for downstream use.
 * On failure: returns false, which NestJS translates to 403 Forbidden.
 */
@Injectable()
export class WalletAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      params: Record<string, string>;
      walletAddress?: `0x${string}`;
    }>();

    const rawAddress = req.headers['x-wallet-address'];
    const signature = req.headers['x-wallet-signature'];
    const timestamp = req.headers['x-wallet-timestamp'];
    const tokenId = req.params['tokenId'];

    if (
      typeof rawAddress !== 'string' ||
      typeof signature !== 'string' ||
      typeof timestamp !== 'string' ||
      !tokenId
    ) {
      return false;
    }

    // 2-minute replay window. Shorter = less replay risk; signatures are not
    // stored server-side (stateless API), so any valid signature can be
    // replayed within the window. Production should add a consumed-nonce store.
    const ts = parseInt(timestamp, 10);
    if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 120) {
      return false;
    }

    let walletAddress: `0x${string}`;
    try {
      walletAddress = getAddress(rawAddress);
    } catch {
      return false;
    }

    const challenge = `mnemos:access:${tokenId}:${walletAddress}:${timestamp}`;

    let recovered: `0x${string}`;
    try {
      recovered = await recoverMessageAddress({
        message: challenge,
        signature: signature as `0x${string}`,
      });
    } catch {
      return false;
    }

    if (getAddress(recovered) !== walletAddress) {
      return false;
    }

    req.walletAddress = walletAddress;
    return true;
  }
}
