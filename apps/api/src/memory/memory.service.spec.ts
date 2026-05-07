import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { MemoryService } from './memory.service';
import type { IMemoryRepository } from './memory.repository.interface';

const mockSnapshotResult = {
  tokenId: 1n,
  contentHash: '0xhash' as `0x${string}`,
  storageUri: '0g://uri',
  txHash: '0xabc' as `0x${string}`,
  timestamp: 1234567890,
};

const mockInfo = {
  tokenId: 1n,
  contentHash: '0xhash' as `0x${string}`,
  storageUri: '0g://uri',
  creator: '0xdeadbeef' as `0x${string}`,
  parent: 0n,
  timestamp: 1000000000n,
};

const mockBundle = {
  data: { key: 'value' },
  metadata: { category: 'trading' as const },
};

function buildMockRepo(overrides: Partial<IMemoryRepository> = {}): IMemoryRepository {
  return {
    snapshot: jest.fn().mockResolvedValue(mockSnapshotResult),
    getMemoryInfo: jest.fn().mockResolvedValue(mockInfo),
    loadMemory: jest.fn().mockResolvedValue(mockBundle),
    ...overrides,
  };
}

function buildService(repo: IMemoryRepository) {
  return new MemoryService(repo as any);
}

describe('MemoryService', () => {
  describe('snapshot', () => {
    it('converts bigint tokenId to string in result', async () => {
      const service = buildService(buildMockRepo());
      const result = await service.snapshot({ data: {}, metadata: { category: 'trading' } });
      expect(result).toMatchObject({ tokenId: '1', txHash: '0xabc' });
    });

    it('passes bundle and undefined parentTokenId when not provided', async () => {
      const repo = buildMockRepo();
      const service = buildService(repo);
      const dto = { data: { x: 1 }, metadata: { category: 'research' as const } };
      await service.snapshot(dto);
      expect(repo.snapshot).toHaveBeenCalledWith({ data: { x: 1 }, metadata: { category: 'research' } }, undefined);
    });

    it('converts parentTokenId string to bigint', async () => {
      const repo = buildMockRepo();
      const service = buildService(repo);
      await service.snapshot({ data: {}, metadata: { category: 'trading' }, parentTokenId: '42' });
      expect(repo.snapshot).toHaveBeenCalledWith(expect.any(Object), 42n);
    });

    it('throws NotFoundException on "not found" error', async () => {
      const repo = buildMockRepo({ snapshot: jest.fn().mockRejectedValue(new Error('token not found')) });
      const service = buildService(repo);
      await expect(service.snapshot({ data: {}, metadata: { category: 'trading' } })).rejects.toThrow(NotFoundException);
    });

    it('throws InternalServerErrorException on generic error', async () => {
      const repo = buildMockRepo({ snapshot: jest.fn().mockRejectedValue(new Error('rpc timeout')) });
      const service = buildService(repo);
      await expect(service.snapshot({ data: {}, metadata: { category: 'trading' } })).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getMemoryInfo', () => {
    it('converts bigint fields to strings', async () => {
      const service = buildService(buildMockRepo());
      const result = await service.getMemoryInfo(1n);
      expect(result).toEqual({
        tokenId: '1',
        contentHash: '0xhash',
        storageUri: '0g://uri',
        creator: '0xdeadbeef',
        parent: '0',
        timestamp: '1000000000',
      });
    });

    it('calls repo.getMemoryInfo with correct tokenId', async () => {
      const repo = buildMockRepo();
      const service = buildService(repo);
      await service.getMemoryInfo(99n);
      expect(repo.getMemoryInfo).toHaveBeenCalledWith(99n);
    });
  });

  describe('loadMemory', () => {
    it('returns the bundle from repo', async () => {
      const service = buildService(buildMockRepo());
      const result = await service.loadMemory(1n);
      expect(result).toEqual(mockBundle);
    });

    it('calls repo.loadMemory with correct tokenId', async () => {
      const repo = buildMockRepo();
      const service = buildService(repo);
      await service.loadMemory(7n);
      expect(repo.loadMemory).toHaveBeenCalledWith(7n);
    });
  });
});
