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

  loadMemory(tokenId: bigint) {
    return this.mnemos.getClient().loadMemory(tokenId);
  }
}
