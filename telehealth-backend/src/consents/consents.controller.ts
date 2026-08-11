import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConsentsService } from './consents.service';

@UseGuards(JwtAuthGuard)
@Controller('consents')
export class ConsentsController {
  constructor(private readonly consentsService: ConsentsService) {}

  @Get('appointments/:appointmentId/me')
  getMyConsent(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() user: { sub: number },
  ) {
    return this.consentsService.getMyConsent(+appointmentId, user.sub);
  }

  @Post('appointments/:appointmentId')
  accept(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() user: { sub: number },
    @Body() body: { consentAccepted?: boolean; policyVersion?: string },
  ) {
    return this.consentsService.accept(+appointmentId, user.sub, body);
  }
}
