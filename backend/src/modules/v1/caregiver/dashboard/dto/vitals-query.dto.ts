import { IsArray, IsDateString, IsIn, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

const VITALS_METRICS = [
  'heart_rate',
  'resting_heart_rate',
  'steps',
  'sleep_duration',
] as const;

export class VitalsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsArray()
  @IsIn(VITALS_METRICS, { each: true })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? [value] : value,
  )
  metrics?: string[];
}
