import { Injectable } from '@nestjs/common';
import { MnemosService } from '../mnemos/mnemos.service';
import type { SnapshotDto } from './dto/snapshot.dto';

@Injectable()
export class MemoryService {
  constructor(private readonly mnemos: MnemosService) {}

  async snapshot(dto: SnapshotDto) {
    const result = await this.mnemos.getClient().snapshot(
      { data: dto.data, metadata: dto.metadata },
      dto.parentTokenId ? BigInt(dto.parentTokenId) : undefined,
    );
    return {
      tokenId: result.tokenId.toString(),
      contentHash: result.contentHash,
      storageUri: result.storageUri,
      txHash: result.txHash,
      timestamp: result.timestamp,
    };
  }

  async getMemoryInfo(tokenId: bigint) {
    const info = await this.mnemos.getClient().getMemoryInfo(tokenId);
    return {
      tokenId: info.tokenId.toString(),
      contentHash: info.contentHash,
      storageUri: info.storageUri,
      creator: info.creator,
      parent: info.parent.toString(),
      timestamp: info.timestamp.toString(),
    };
  }

  async loadMemory(tokenId: bigint) {
    return this.mnemos.getClient().loadMemory(tokenId);
  }
}
