import { Global, Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as firebaseAdmin from 'firebase-admin';
import { FIREBASE_APP, FIREBASE_MESSAGING } from './push.constants';
import { PushService } from './push.service';

// Global push module following REVERSE_ENGINEERING_DOC Pattern 10:
// - forRootAsync: async factory reads FIREBASE_CREDENTIALS_PATH from ConfigService
// - Firebase Admin SDK init guarded by apps.length === 0 (AGENTS.md Rule 7)
// - FIREBASE_MESSAGING token provides the Messaging instance for DI
//
// Usage: PushModule.forRootAsync() in main.module.ts imports.

@Global()
@Module({})
export class PushModule {
  static forRootAsync(): DynamicModule {
    return {
      module: PushModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: FIREBASE_APP,
          inject: [ConfigService],
          useFactory: (config: ConfigService): firebaseAdmin.app.App => {
            // AGENTS.md Rule 7: guard init to prevent crash on HMR/tests
            if (firebaseAdmin.apps.length === 0) {
              const credPath = config.get<string>('FIREBASE_CREDENTIALS_PATH');
              if (!credPath) {
                throw new Error('FIREBASE_CREDENTIALS_PATH not configured');
              }
              firebaseAdmin.initializeApp({
                credential: firebaseAdmin.credential.cert(credPath),
              });
            }
            return firebaseAdmin.app();
          },
        },
        {
          provide: FIREBASE_MESSAGING,
          inject: [FIREBASE_APP],
          useFactory: (): firebaseAdmin.messaging.Messaging => {
            return firebaseAdmin.messaging();
          },
        },
        PushService,
      ],
      exports: [PushService, FIREBASE_MESSAGING],
    };
  }
}
