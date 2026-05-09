import { Injectable } from '@nestjs/common';
import { MnemosService } from '../mnemos/mnemos.service';
import type { MemoryBundle } from '@mnemos-sdk/sdk';
import type { IMemoryRepository } from './memory.repository.interface';

@Injectable()
export class MemoryRepository implements IMemoryRepository {
  constructor(private readonly mnemos: MnemosService) {}

  snapshot(bundle: MemoryBundle, parentTokenId?: bigint) {
    return this.mnemos.getClient().snapshot(bundle, parentTokenId);
  }

  getMemoryInfo(tokenId: bigint) {
    return this.mnemos.getClient().getMemoryInfo(tokenId);
  }

  async loadMemory(tokenId: bigint, callerAddress?: `0x${string}`) {
    const client = this.mnemos.getClient();
    if (callerAddress) {
      const allowed = await client.hasAccess(tokenId, callerAddress);
      if (!allowed) {
        throw new Error('Access denied');
      }
    }
    return client.loadMemory(tokenId);
  }
}
