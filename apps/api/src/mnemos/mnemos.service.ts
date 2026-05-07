import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MnemosClient } from '@mnemos/sdk';

@Injectable()
export class MnemosService implements OnModuleInit {
  private client!: MnemosClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.client = new MnemosClient({
      privateKey: this.config.getOrThrow<`0x${string}`>('AGENT_PRIVATE_KEY'),
      chainId: parseInt(this.config.getOrThrow('OG_CHAIN_ID'), 10),
      rpcUrl: this.config.getOrThrow('OG_RPC_URL'),
      storageNodeUrl: this.config.getOrThrow('OG_STORAGE_NODE'),
      registryAddress: this.config.getOrThrow<`0x${string}`>('REGISTRY_ADDRESS'),
      marketplaceAddress: this.config.getOrThrow<`0x${string}`>('MARKETPLACE_ADDRESS'),
    });
  }

  getClient(): MnemosClient {
    return this.client;
  }
}
