import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { CassoWebhookController } from './casso-webhook.controller';

@Module({
  imports: [ConfigModule],
  providers: [WalletService],
  controllers: [WalletController, CassoWebhookController],
})
export class WalletModule {}
