import { Body, Controller, Headers, Post } from '@nestjs/common';
import { WalletService } from './wallet.service';

@Controller('wallet/casso')
export class CassoWebhookController {
  constructor(private readonly walletService: WalletService) {}

  @Post('webhook')
  handleWebhook(
    @Headers('secure-token') secureToken: string | undefined,
    @Body() payload: unknown,
  ) {
    return this.walletService.handleCassoWebhook(secureToken, payload);
  }
}
