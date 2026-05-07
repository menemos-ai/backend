import { IsObject, IsOptional, IsString } from 'class-validator';
import type { MemoryMetadata } from '@mnemos/sdk';

export class SnapshotDto {
  @IsObject()
  data!: unknown;

  @IsObject()
  metadata!: MemoryMetadata;

  @IsString()
  @IsOptional()
  parentTokenId?: string;
}
