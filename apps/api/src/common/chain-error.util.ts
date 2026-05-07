import { InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';

const logger = new Logger('ChainError');

export function handleChainError(error: unknown): never {
  logger.error(error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack : undefined);

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('not found') || error.constructor.name === 'ContractFunctionRevertedError') {
      throw new NotFoundException(error.message);
    }
  }

  throw new InternalServerErrorException(
    error instanceof Error ? error.message : 'An unexpected error occurred',
  );
}
