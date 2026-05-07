import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness probe', description: 'Returns 200 when the service is up.' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: { example: { status: 'ok', timestamp: 1746614400000 } },
  })
  check() {
    return { status: 'ok', timestamp: Date.now() };
  }
}
