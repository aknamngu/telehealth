export class CreateAiSummaryDto {
  appointmentId!: number;
  rawTranscript?: string;
  aiSummary?: string;
  suggestedMedicines?: string;
}