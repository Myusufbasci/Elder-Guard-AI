import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

// The valid metric set is enforced at the API boundary (no DB enum, see
// AGENTS.md Rule on schema flexibility). New metrics added here without a
// migration. Mirrors INTEGRATION.md → "Telemetry Ingest Payload".
export const ALLOWED_METRICS = [
  'heart_rate',
  'resting_heart_rate',
  'steps',
  'sleep_duration',
  'location_lat',
  'location_lng',
] as const;

export type AllowedMetric = (typeof ALLOWED_METRICS)[number];

export class TelemetrySampleDto {
  @IsISO8601({ strict: true })
  time!: string;

  @IsIn(ALLOWED_METRICS)
  metric!: AllowedMetric;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  value!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  quality?: number;
}
