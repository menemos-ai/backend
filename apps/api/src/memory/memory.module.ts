import { Module } from '@nestjs/common';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { MemoryRepository } from './memory.repository';
import { MEMORY_REPOSITORY } from './memory.repository.interface';

@Module({
  controllers: [MemoryController],
  providers: [
    MemoryService,
    { provide: MEMORY_REPOSITORY, useClass: MemoryRepository },
  ],
})
export class MemoryModule {}
