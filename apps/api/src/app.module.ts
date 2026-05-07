import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MnemosModule } from './mnemos/mnemos.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { MemoryModule } from './memory/memory.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    MnemosModule,
    MarketplaceModule,
    MemoryModule,
    HealthModule,
  ],
})
export class AppModule {}
