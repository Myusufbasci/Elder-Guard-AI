import { Type } from 'class-transformer';
import { IsDate, IsString, MaxLength, MinLength } from 'class-validator';

// Caregiver creates an elder profile + pairing code in one call.
// Elders have no email — they never log in by email (paired flow only).
export class CreateElderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @Type(() => Date)
  @IsDate()
  dateOfBirth!: Date;
}
