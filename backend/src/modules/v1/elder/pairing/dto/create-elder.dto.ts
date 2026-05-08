import { Type } from 'class-transformer';
import { IsDate, IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

// Caregiver creates an elder profile + pairing code in one call.
export class CreateElderDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

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
