import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { TelemetrySampleDto } from './telemetry-sample.dto';

// Batch ingest contract. Max batch size is 200 to keep a single INSERT under
// Postgres' 65k-parameter ceiling (200 samples × 5 cols = 1000 params, well
// within bounds) and to bound worst-case query latency.
export const MAX_SAMPLES_PER_BATCH = 200;

export class IngestTelemetryDto {
  @IsUUID()
  deviceId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SAMPLES_PER_BATCH)
  @ValidateNested({ each: true })
  @Type(() => TelemetrySampleDto)
  samples!: TelemetrySampleDto[];
}
