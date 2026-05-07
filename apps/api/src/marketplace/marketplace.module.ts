import { Module } from '@nestjs/common';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceRepository } from './marketplace.repository';
import { MARKETPLACE_REPOSITORY } from './marketplace.repository.interface';

@Module({
  controllers: [MarketplaceController],
  providers: [
    MarketplaceService,
    { provide: MARKETPLACE_REPOSITORY, useClass: MarketplaceRepository },
  ],
})
export class MarketplaceModule {}
