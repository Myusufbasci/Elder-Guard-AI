import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, type MeResponse } from './auth.service';
import type { AuthTokens } from './dto/auth-tokens.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterCaregiverDto } from './dto/register-caregiver.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import type { AuthenticatedUser } from './interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterCaregiverDto): Promise<AuthTokens> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthTokens> {
    return this.authService.login(dto);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  googleLogin(@Body() dto: GoogleLoginDto): Promise<AuthTokens> {
    return this.authService.googleLogin(dto);
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Req() req: Request & { user: AuthenticatedUser }): Promise<AuthTokens> {
    return this.authService.refresh(req.user.sub, req.user.jti);
  }

  // Public — the user clicks the link in their email (may be logged out).
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ verified: true }> {
    return this.authService.verifyEmail(dto.token);
  }

  @UseGuards(JwtAccessGuard)
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerification(
    @Req() req: Request & { user: AuthenticatedUser },
  ): Promise<{ sent: boolean }> {
    return this.authService.resendVerification(req.user.sub);
  }

  @UseGuards(JwtAccessGuard)
  @Get('me')
  me(@Req() req: Request & { user: AuthenticatedUser }): Promise<MeResponse> {
    return this.authService.getMe(req.user.sub);
  }
}
