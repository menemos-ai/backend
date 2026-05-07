import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { MARKETPLACE_REPOSITORY } from './marketplace.repository.interface';
import type { IMarketplaceRepository } from './marketplace.repository.interface';

const mockListing = {
  price: 1000n,
  rentalPricePerDay: 100n,
  isForSale: true,
  isForRent: false,
  isForFork: true,
  forkRoyaltyBps: 500,
  seller: '0xdeadbeef' as `0x${string}`,
};

function buildMockRepo(overrides: Partial<IMarketplaceRepository> = {}): IMarketplaceRepository {
  return {
    getListing: jest.fn().mockResolvedValue(mockListing),
    list: jest.fn().mockResolvedValue('0xabc'),
    buy: jest.fn().mockResolvedValue('0xabc'),
    rent: jest.fn().mockResolvedValue('0xabc'),
    fork: jest.fn().mockResolvedValue('0xabc'),
    payRoyalty: jest.fn().mockResolvedValue('0xabc'),
    ...overrides,
  };
}

function buildService(repo: IMarketplaceRepository) {
  return new MarketplaceService(repo as any);
}

describe('MarketplaceService', () => {
  describe('getListing', () => {
    it('converts bigint fields to strings', async () => {
      const service = buildService(buildMockRepo());
      const result = await service.getListing(1n);
      expect(result).toEqual({
        price: '1000',
        rentalPricePerDay: '100',
        isForSale: true,
        isForRent: false,
        isForFork: true,
        forkRoyaltyBps: 500,
        seller: '0xdeadbeef',
      });
    });

    it('calls repo.getListing with the correct tokenId', async () => {
      const repo = buildMockRepo();
      const service = buildService(repo);
      await service.getListing(42n);
      expect(repo.getListing).toHaveBeenCalledWith(42n);
    });

    it('throws NotFoundException when error message contains "not found"', async () => {
      const repo = buildMockRepo({ getListing: jest.fn().mockRejectedValue(new Error('token not found')) });
      const service = buildService(repo);
      await expect(service.getListing(1n)).rejects.toThrow(NotFoundException);
    });

    it('throws InternalServerErrorException on generic error', async () => {
      const repo = buildMockRepo({ getListing: jest.fn().mockRejectedValue(new Error('rpc timeout')) });
      const service = buildService(repo);
      await expect(service.getListing(1n)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('list', () => {
    it('converts string DTO fields to bigint before calling repo', async () => {
      const repo = buildMockRepo();
      const service = buildService(repo);
      await service.list({
        tokenId: '1',
        price: '1000',
        rentalPricePerDay: '100',
        isForSale: true,
        isForRent: false,
        isForFork: true,
        forkRoyaltyBps: 500,
      });
      expect(repo.list).toHaveBeenCalledWith(1n, {
        price: 1000n,
        rentalPricePerDay: 100n,
        isForSale: true,
        isForRent: false,
        isForFork: true,
        forkRoyaltyBps: 500,
      });
    });

    it('returns txHash object', async () => {
      const service = buildService(buildMockRepo());
      const result = await service.list({ tokenId: '1', price: '0', rentalPricePerDay: '0', isForSale: false, isForRent: false, isForFork: false, forkRoyaltyBps: 0 });
      expect(result).toEqual({ txHash: '0xabc' });
    });
  });

  describe('buy', () => {
    it('calls repo.buy and returns txHash', async () => {
      const repo = buildMockRepo();
      const service = buildService(repo);
      const result = await service.buy(5n);
      expect(repo.buy).toHaveBeenCalledWith(5n);
      expect(result).toEqual({ txHash: '0xabc' });
    });
  });

  describe('rent', () => {
    it('calls repo.rent with tokenId and durationDays', async () => {
      const repo = buildMockRepo();
      const service = buildService(repo);
      await service.rent(3n, { durationDays: 7 });
      expect(repo.rent).toHaveBeenCalledWith(3n, 7);
    });
  });

  describe('fork', () => {
    it('calls repo.fork and returns txHash', async () => {
      const repo = buildMockRepo();
      const service = buildService(repo);
      const result = await service.fork(9n);
      expect(repo.fork).toHaveBeenCalledWith(9n);
      expect(result).toEqual({ txHash: '0xabc' });
    });
  });

  describe('payRoyalty', () => {
    it('converts amount string to bigint before calling repo', async () => {
      const repo = buildMockRepo();
      const service = buildService(repo);
      await service.payRoyalty(2n, { amount: '500000000000000000' });
      expect(repo.payRoyalty).toHaveBeenCalledWith(2n, 500000000000000000n);
    });

    it('returns txHash object', async () => {
      const service = buildService(buildMockRepo());
      const result = await service.payRoyalty(2n, { amount: '1' });
      expect(result).toEqual({ txHash: '0xabc' });
    });
  });
});
