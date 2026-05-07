import { Global, Module } from '@nestjs/common';
import { MnemosService } from './mnemos.service';

@Global()
@Module({
  providers: [MnemosService],
  exports: [MnemosService],
})
export class MnemosModule {}
