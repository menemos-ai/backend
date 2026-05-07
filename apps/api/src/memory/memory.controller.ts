import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { SnapshotDto } from './dto/snapshot.dto';

@Controller('memory')
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Post('snapshot')
  snapshot(@Body() dto: SnapshotDto) {
    return this.memory.snapshot(dto);
  }

  @Get(':tokenId/info')
  getMemoryInfo(@Param('tokenId') tokenId: string) {
    return this.memory.getMemoryInfo(BigInt(tokenId));
  }

  @Get(':tokenId')
  loadMemory(@Param('tokenId') tokenId: string) {
    return this.memory.loadMemory(BigInt(tokenId));
  }
}
