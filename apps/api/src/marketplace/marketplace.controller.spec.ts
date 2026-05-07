import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { MARKETPLACE_REPOSITORY } from './marketplace.repository.interface';

function buildMockService() {
  return {
    getListing: jest.fn(),
    list: jest.fn(),
    buy: jest.fn(),
    rent: jest.fn(),
    fork: jest.fn(),
    payRoyalty: jest.fn(),
  };
}

async function buildApp(mockService: ReturnType<typeof buildMockService>): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    controllers: [MarketplaceController],
    providers: [
      { provide: MarketplaceService, useValue: mockService },
      { provide: MARKETPLACE_REPOSITORY, useValue: {} },
    ],
  })
    .overrideProvider(MarketplaceService)
    .useValue(mockService)
    .compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

describe('MarketplaceController', () => {
  let app: INestApplication;
  let svc: ReturnType<typeof buildMockService>;

  beforeEach(async () => {
    svc = buildMockService();
    app = await buildApp(svc);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/marketplace/listings/:tokenId', () => {
    it('returns listing data', async () => {
      const listing = {
        price: '1000',
        rentalPricePerDay: '100',
        isForSale: true,
        isForRent: false,
        isForFork: true,
        forkRoyaltyBps: 500,
        seller: '0xdeadbeef',
      };
      svc.getListing.mockResolvedValue(listing);

      const res = await request(app.getHttpServer()).get('/api/marketplace/listings/1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(listing);
      expect(svc.getListing).toHaveBeenCalledWith(1n);
    });
  });

  describe('POST /api/marketplace/list', () => {
    it('returns txHash on valid body', async () => {
      svc.list.mockResolvedValue({ txHash: '0xabc' });

      const res = await request(app.getHttpServer()).post('/api/marketplace/list').send({
        tokenId: '1',
        price: '1000',
        rentalPricePerDay: '100',
        isForSale: true,
        isForRent: false,
        isForFork: true,
        forkRoyaltyBps: 500,
      });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ txHash: '0xabc' });
    });
  });

  describe('POST /api/marketplace/buy/:tokenId', () => {
    it('returns txHash', async () => {
      svc.buy.mockResolvedValue({ txHash: '0xabc' });

      const res = await request(app.getHttpServer()).post('/api/marketplace/buy/5');

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ txHash: '0xabc' });
      expect(svc.buy).toHaveBeenCalledWith(5n);
    });
  });

  describe('POST /api/marketplace/rent/:tokenId', () => {
    it('returns txHash', async () => {
      svc.rent.mockResolvedValue({ txHash: '0xabc' });

      const res = await request(app.getHttpServer())
        .post('/api/marketplace/rent/3')
        .send({ durationDays: 7 });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ txHash: '0xabc' });
      expect(svc.rent).toHaveBeenCalledWith(3n, { durationDays: 7 });
    });
  });

  describe('POST /api/marketplace/fork/:tokenId', () => {
    it('returns txHash', async () => {
      svc.fork.mockResolvedValue({ txHash: '0xabc' });

      const res = await request(app.getHttpServer()).post('/api/marketplace/fork/9');

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ txHash: '0xabc' });
      expect(svc.fork).toHaveBeenCalledWith(9n);
    });
  });

  describe('POST /api/marketplace/royalty/:tokenId', () => {
    it('returns txHash', async () => {
      svc.payRoyalty.mockResolvedValue({ txHash: '0xabc' });

      const res = await request(app.getHttpServer())
        .post('/api/marketplace/royalty/2')
        .send({ amount: '500000000000000000' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ txHash: '0xabc' });
      expect(svc.payRoyalty).toHaveBeenCalledWith(2n, { amount: '500000000000000000' });
    });
  });
});
