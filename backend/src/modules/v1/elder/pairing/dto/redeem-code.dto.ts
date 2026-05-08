import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class RedeemCodeDto {
  // 6-digit numeric — no alpha confusion for elderly users.
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  fcmToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  osVersion?: string;
}
