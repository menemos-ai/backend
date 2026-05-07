import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MnemosModule } from './mnemos/mnemos.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { MemoryModule } from './memory/memory.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MnemosModule,
    MarketplaceModule,
    MemoryModule,
  ],
})
export class AppModule {}
