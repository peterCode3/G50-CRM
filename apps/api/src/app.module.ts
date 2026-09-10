import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { LocationsModule } from './locations/locations.module.js';
import { ServiceTemplatesModule } from './service-templates/service-templates.module.js';
import { ServicesModule } from './services/services.module.js';
import { StaffModule } from './staff/staff.module.js';
import { SchedulingModule } from './scheduling/scheduling.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { WaitlistModule } from './waitlist/waitlist.module.js';
import { MembershipsModule } from './memberships/memberships.module.js';
import { CreditsModule } from './credits/credits.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    LocationsModule,
    ServiceTemplatesModule,
    ServicesModule,
    StaffModule,
    SchedulingModule,
    BookingsModule,
    WaitlistModule,
    MembershipsModule,
    CreditsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Order matters: JwtAuthGuard runs first and populates request.user (or
    // allows @Public() routes through); RolesGuard then checks required roles.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
