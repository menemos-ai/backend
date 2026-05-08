import { IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { MemoryMetadata } from '@mnemos-sdk/sdk';

export class SnapshotDto {
  @ApiProperty({
    description: 'Arbitrary serialisable data payload representing the agent\'s current memory state',
    example: { trades: [{ pair: 'ETH/USDC', amount: 1.5, side: 'buy' }] },
  })
  @IsObject()
  data!: unknown;

  @ApiProperty({
    description: 'Structured metadata describing the memory bundle',
    example: { category: 'trading', agentId: 'defi-yield-v1', version: '1.0.0' },
  })
  @IsObject()
  metadata!: MemoryMetadata;

  @ApiPropertyOptional({
    description: 'Token ID of the parent memory this snapshot forks from (decimal string). Omit for root snapshots.',
    example: '1',
  })
  @IsString()
  @IsOptional()
  parentTokenId?: string;
}
