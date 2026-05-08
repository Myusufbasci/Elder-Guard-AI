import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtPairingGuard extends AuthGuard('jwt-pairing') {}
