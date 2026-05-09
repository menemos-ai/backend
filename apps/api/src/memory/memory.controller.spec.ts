import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { MEMORY_REPOSITORY } from './memory.repository.interface';
import { WalletAuthGuard } from '../common/wallet-auth.guard';

const MOCK_WALLET = '0x0000000000000000000000000000000000000001' as const;

class PassGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{ walletAddress?: `0x${string}` }>();
    req.walletAddress = MOCK_WALLET;
    return true;
  }
}

class BlockGuard implements CanActivate {
  canActivate() {
    return false;
  }
}

function buildMockService() {
  return {
    snapshot: jest.fn(),
    getMemoryInfo: jest.fn(),
    loadMemory: jest.fn(),
  };
}

async function buildApp(
  mockService: ReturnType<typeof buildMockService>,
  guardClass: new () => CanActivate = PassGuard,
): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    controllers: [MemoryController],
    providers: [
      { provide: MemoryService, useValue: mockService },
      { provide: MEMORY_REPOSITORY, useValue: {} },
    ],
  })
    .overrideProvider(MemoryService)
    .useValue(mockService)
    .overrideGuard(WalletAuthGuard)
    .useClass(guardClass)
    .compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

describe('MemoryController', () => {
  let app: INestApplication;
  let svc: ReturnType<typeof buildMockService>;

  beforeEach(async () => {
    svc = buildMockService();
    app = await buildApp(svc);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/memory/snapshot', () => {
    it('returns snapshot result on valid body', async () => {
      const result = {
        tokenId: '1',
        contentHash: '0xhash',
        storageUri: '0g://uri',
        txHash: '0xabc',
        timestamp: 1234567890,
      };
      svc.snapshot.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .post('/api/memory/snapshot')
        .send({ data: { key: 'value' }, metadata: { category: 'trading' } });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(result);
    });

    it('passes parentTokenId when provided', async () => {
      svc.snapshot.mockResolvedValue({ tokenId: '2', txHash: '0xdef' });

      await request(app.getHttpServer())
        .post('/api/memory/snapshot')
        .send({ data: {}, metadata: { category: 'research' }, parentTokenId: '1' });

      expect(svc.snapshot).toHaveBeenCalledWith(
        expect.objectContaining({ parentTokenId: '1' }),
      );
    });
  });

  describe('GET /api/memory/:tokenId/info', () => {
    it('returns memory info', async () => {
      const info = {
        tokenId: '1',
        contentHash: '0xhash',
        storageUri: '0g://uri',
        creator: '0xdeadbeef',
        parent: '0',
        timestamp: '1000000000',
      };
      svc.getMemoryInfo.mockResolvedValue(info);

      const res = await request(app.getHttpServer()).get('/api/memory/1/info');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(info);
      expect(svc.getMemoryInfo).toHaveBeenCalledWith(1n);
    });
  });

  describe('GET /api/memory/:tokenId', () => {
    it('returns memory bundle and passes walletAddress from guard', async () => {
      const bundle = { data: { x: 1 }, metadata: { category: 'trading' } };
      svc.loadMemory.mockResolvedValue(bundle);

      const res = await request(app.getHttpServer()).get('/api/memory/3');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(bundle);
      expect(svc.loadMemory).toHaveBeenCalledWith(3n, MOCK_WALLET);
    });

    it('returns 403 when WalletAuthGuard blocks the request', async () => {
      const blockedApp = await buildApp(svc, BlockGuard);
      try {
        const res = await request(blockedApp.getHttpServer()).get('/api/memory/3');
        expect(res.status).toBe(403);
        expect(svc.loadMemory).not.toHaveBeenCalled();
      } finally {
        await blockedApp.close();
      }
    });
  });
});
