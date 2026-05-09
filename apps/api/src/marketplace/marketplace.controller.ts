import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { MarketplaceService } from './marketplace.service';
import { ListDto } from './dto/list.dto';
import { RentDto } from './dto/rent.dto';
import { PayRoyaltyDto } from './dto/pay-royalty.dto';
import { ParseBigIntPipe } from '../common/parse-bigint.pipe';

@ApiTags('Marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get('listings/:tokenId')
  @ApiOperation({ summary: 'Get listing details for a memory token' })
  @ApiParam({ name: 'tokenId', description: 'Token ID of the memory NFT', example: '1' })
  @ApiResponse({
    status: 200,
    description: 'Listing details',
    schema: {
      example: {
        price: '1000000000000000000',
        rentalPricePerDay: '100000000000000000',
        isForSale: true,
        isForRent: false,
        isForFork: true,
        forkRoyaltyBps: 500,
        seller: '0xdeadbeef00000000000000000000000000000001',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Token not found on chain' })
  @ApiResponse({ status: 500, description: 'RPC or chain error' })
  getListing(@Param('tokenId', ParseBigIntPipe) tokenId: bigint) {
    return this.marketplace.getListing(tokenId);
  }

  @Post('list')
  @ApiOperation({ summary: 'List a memory token for sale, rent, or fork' })
  @ApiBody({ type: ListDto })
  @ApiResponse({
    status: 201,
    description: 'Transaction submitted',
    schema: { example: { txHash: '0xabc123...' } },
  })
  @ApiResponse({ status: 500, description: 'Transaction reverted or RPC error' })
  list(@Body() dto: ListDto) {
    return this.marketplace.list(dto);
  }

  @Post('buy/:tokenId')
  @ApiOperation({
    summary: 'Buy a memory token',
    description:
      'Purchases the token at its listed sale price. The server wallet pays the price; ' +
      'for user-signed purchases use the frontend wagmi flow directly.',
  })
  @ApiParam({ name: 'tokenId', description: 'Token ID to purchase', example: '1' })
  @ApiResponse({
    status: 201,
    description: 'Purchase transaction submitted',
    schema: { example: { txHash: '0xabc123...' } },
  })
  @ApiResponse({ status: 404, description: 'Token not listed or not found' })
  @ApiResponse({ status: 500, description: 'Insufficient funds or RPC error' })
  buy(@Param('tokenId', ParseBigIntPipe) tokenId: bigint) {
    return this.marketplace.buy(tokenId);
  }

  @Post('rent/:tokenId')
  @ApiOperation({ summary: 'Rent a memory token for a fixed number of days' })
  @ApiParam({ name: 'tokenId', description: 'Token ID to rent', example: '1' })
  @ApiBody({ type: RentDto })
  @ApiResponse({
    status: 201,
    description: 'Rental transaction submitted',
    schema: { example: { txHash: '0xabc123...' } },
  })
  @ApiResponse({ status: 404, description: 'Token not listed for rent' })
  @ApiResponse({ status: 500, description: 'Insufficient funds or RPC error' })
  rent(@Param('tokenId', ParseBigIntPipe) tokenId: bigint, @Body() dto: RentDto) {
    return this.marketplace.rent(tokenId, dto);
  }

  @Post('fork/:tokenId')
  @ApiOperation({
    summary: 'Fork a memory token',
    description:
      'Creates a new memory token that descends from the specified parent. ' +
      'Royalties from future child-agent earnings flow back to the parent creator.',
  })
  @ApiParam({ name: 'tokenId', description: 'Token ID to fork', example: '1' })
  @ApiResponse({
    status: 201,
    description: 'Fork transaction submitted',
    schema: { example: { txHash: '0xabc123...' } },
  })
  @ApiResponse({ status: 404, description: 'Token not available for forking' })
  @ApiResponse({ status: 500, description: 'Transaction reverted or RPC error' })
  fork(@Param('tokenId', ParseBigIntPipe) tokenId: bigint) {
    return this.marketplace.fork(tokenId);
  }

  @Post('royalty/:tokenId')
  @ApiOperation({
    summary: 'Pay royalty to a parent token creator',
    description:
      'Settles earned royalties from a child agent back to the parent memory creator. ' +
      'The `amount` field is the wei value to transfer.',
  })
  @ApiParam({ name: 'tokenId', description: 'Parent token ID receiving the royalty', example: '1' })
  @ApiBody({ type: PayRoyaltyDto })
  @ApiResponse({
    status: 201,
    description: 'Royalty payment transaction submitted',
    schema: { example: { txHash: '0xabc123...' } },
  })
  @ApiResponse({ status: 404, description: 'Parent token not found' })
  @ApiResponse({ status: 500, description: 'Insufficient funds or RPC error' })
  payRoyalty(@Param('tokenId', ParseBigIntPipe) tokenId: bigint, @Body() dto: PayRoyaltyDto) {
    return this.marketplace.payRoyalty(tokenId, dto);
  }
}
