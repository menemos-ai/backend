import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { MemoryService } from './memory.service';
import { SnapshotDto } from './dto/snapshot.dto';
import { WalletAuthGuard } from '../common/wallet-auth.guard';
import { ParseBigIntPipe } from '../common/parse-bigint.pipe';

@ApiTags('Memory')
@Controller('memory')
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Post('snapshot')
  @ApiOperation({
    summary: 'Snapshot agent memory to 0G Storage and mint a provenance token',
    description:
      'Encrypts the memory bundle with a key derived from the server wallet, uploads it to 0G Storage, ' +
      'and calls `MemoryRegistry.mintRoot` to record provenance on-chain. ' +
      'Returns the minted `tokenId` together with the content hash and storage URI.',
  })
  @ApiBody({ type: SnapshotDto })
  @ApiResponse({
    status: 201,
    description: 'Memory snapshotted and token minted',
    schema: {
      example: {
        tokenId: '42',
        contentHash: '0xabc123...def',
        storageUri: '0g://stub/abc123',
        txHash: '0xdeadbeef...',
        timestamp: 1746614400000,
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Storage upload or chain transaction failed' })
  snapshot(@Body() dto: SnapshotDto) {
    return this.memory.snapshot(dto);
  }

  @Get(':tokenId/info')
  @ApiOperation({
    summary: 'Get on-chain provenance info for a memory token',
    description:
      'Reads `MemoryRegistry.getMemoryInfo` and returns the content hash, storage URI, ' +
      'creator address, parent token ID, and mint timestamp.',
  })
  @ApiParam({ name: 'tokenId', description: 'Memory token ID', example: '1' })
  @ApiResponse({
    status: 200,
    description: 'On-chain memory info',
    schema: {
      example: {
        tokenId: '1',
        contentHash: '0xabc123...def',
        storageUri: '0g://stub/abc123',
        creator: '0xdeadbeef00000000000000000000000000000001',
        parent: '0',
        timestamp: '1234567890',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Token not found on chain' })
  @ApiResponse({ status: 500, description: 'RPC or chain error' })
  getMemoryInfo(@Param('tokenId', ParseBigIntPipe) tokenId: bigint) {
    return this.memory.getMemoryInfo(tokenId);
  }

  @Get(':tokenId')
  @UseGuards(WalletAuthGuard)
  @ApiOperation({
    summary: 'Download and decrypt a memory bundle',
    description:
      'Fetches the encrypted bundle from 0G Storage using the URI stored on-chain, ' +
      'decrypts it using the v2 content-hash key scheme, and returns the original `MemoryBundle` JSON. ' +
      'Requires wallet signature headers to verify the caller has access (owner or active renter).',
  })
  @ApiParam({ name: 'tokenId', description: 'Memory token ID', example: '1' })
  @ApiHeader({ name: 'x-wallet-address', description: 'EIP-55 checksummed caller address', required: true })
  @ApiHeader({ name: 'x-wallet-signature', description: 'EIP-191 personal_sign of challenge message', required: true })
  @ApiHeader({ name: 'x-wallet-timestamp', description: 'Unix timestamp in seconds (5-minute window)', required: true })
  @ApiResponse({
    status: 200,
    description: 'Decrypted memory bundle',
    schema: {
      example: {
        data: { trades: [{ pair: 'ETH/USDC', amount: 1.5, side: 'buy' }] },
        metadata: { category: 'trading', agentId: 'defi-yield-v1', version: '1.0.0' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Missing or invalid wallet signature, or caller lacks access' })
  @ApiResponse({ status: 404, description: 'Token not found on chain' })
  @ApiResponse({ status: 500, description: 'Decryption failed or storage unavailable' })
  loadMemory(
    @Param('tokenId', ParseBigIntPipe) tokenId: bigint,
    @Req() req: { walletAddress?: `0x${string}` },
  ) {
    return this.memory.loadMemory(tokenId, req.walletAddress);
  }
}
