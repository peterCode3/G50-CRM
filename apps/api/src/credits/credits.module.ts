import { Module } from '@nestjs/common';
import { CreditsService } from './credits.service.js';
import { CreditPackagesController } from './credit-packages.controller.js';
import { MyCreditBalancesController } from './my-credit-balances.controller.js';

@Module({
  controllers: [CreditPackagesController, MyCreditBalancesController],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}
