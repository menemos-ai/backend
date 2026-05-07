import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { ListDto } from './dto/list.dto';
import { RentDto } from './dto/rent.dto';
import { PayRoyaltyDto } from './dto/pay-royalty.dto';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get('listings/:tokenId')
  getListing(@Param('tokenId') tokenId: string) {
    return this.marketplace.getListing(BigInt(tokenId));
  }

  @Post('list')
  list(@Body() dto: ListDto) {
    return this.marketplace.list(dto);
  }

  @Post('buy/:tokenId')
  buy(@Param('tokenId') tokenId: string) {
    return this.marketplace.buy(BigInt(tokenId));
  }

  @Post('rent/:tokenId')
  rent(@Param('tokenId') tokenId: string, @Body() dto: RentDto) {
    return this.marketplace.rent(BigInt(tokenId), dto);
  }

  @Post('fork/:tokenId')
  fork(@Param('tokenId') tokenId: string) {
    return this.marketplace.fork(BigInt(tokenId));
  }

  @Post('royalty/:tokenId')
  payRoyalty(@Param('tokenId') tokenId: string, @Body() dto: PayRoyaltyDto) {
    return this.marketplace.payRoyalty(BigInt(tokenId), dto);
  }
}
