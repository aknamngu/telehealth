import { PartialType } from '@nestjs/mapped-types';
import { CreateAiSummaryDto } from './create-ai-summary.dto';

export class UpdateAiSummaryDto extends PartialType(CreateAiSummaryDto) {}