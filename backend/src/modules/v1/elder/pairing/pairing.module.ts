import { Module } from '@nestjs/common';
import { AuthModule } from '../../common/auth/auth.module';
import { CaregiverPairingController } from './caregiver-pairing.controller';
import { ElderPairingController } from './elder-pairing.controller';
import { PairingService } from './pairing.service';

@Module({
  imports: [AuthModule], // for JwtService + AuthService.issueTokens + JwtPairingGuard
  controllers: [CaregiverPairingController, ElderPairingController],
  providers: [PairingService],
  exports: [PairingService],
})
export class PairingModule {}
