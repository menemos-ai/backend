import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { handleChainError } from '../common/chain-error.util';
import { MEMORY_REPOSITORY, IMemoryRepository } from './memory.repository.interface';
import type { SnapshotDto } from './dto/snapshot.dto';

@Injectable()
export class MemoryService {
  constructor(
    @Inject(MEMORY_REPOSITORY) private readonly repo: IMemoryRepository,
  ) {}

  async snapshot(dto: SnapshotDto) {
    try {
      const result = await this.repo.snapshot(
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
    } catch (error) {
      handleChainError(error);
    }
  }

  async getMemoryInfo(tokenId: bigint) {
    try {
      const info = await this.repo.getMemoryInfo(tokenId);
      return {
        tokenId: info.tokenId.toString(),
        contentHash: info.contentHash,
        storageUri: info.storageUri,
        creator: info.creator,
        parent: info.parent.toString(),
        timestamp: info.timestamp.toString(),
      };
    } catch (error) {
      handleChainError(error);
    }
  }

  async loadMemory(tokenId: bigint, callerAddress?: `0x${string}`) {
    try {
      return await this.repo.loadMemory(tokenId, callerAddress);
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('access denied')) {
        throw new ForbiddenException('You do not have access to this memory token');
      }
      handleChainError(error);
    }
  }
}
