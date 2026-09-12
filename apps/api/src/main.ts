import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { UPLOADS_DIR } from './uploads/uploads.controller.js';

async function bootstrap() {
  // rawBody: true keeps the exact request bytes available on req.rawBody
  // (alongside the normal parsed body) so the Stripe webhook route can verify
  // its signature — everything else is unaffected.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.use(cookieParser());
  // Static file serving, not a Nest-routed controller — bypasses the global
  // JwtAuthGuard entirely, which is what we want: uploaded images are public
  // to view, only the upload endpoint itself requires staff auth.
  app.useStaticAssets(UPLOADS_DIR, { prefix: '/uploads' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3333);
}
await bootstrap();
