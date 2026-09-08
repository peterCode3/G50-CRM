import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GlobalRole, LocationRole } from '@g50golf/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertManagesLocation } from '../auth/location-access.util.js';
import type { AuthenticatedUser } from '../auth/types.js';
import type { CreateCoachAvailabilityDto } from './dto/create-coach-availability.dto.js';

@Injectable()
export class CoachAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCoachAvailabilityDto, user: AuthenticatedUser) {
    const targetUserId = dto.userId ?? user.id;
    this.assertCanManage(user, targetUserId, dto.locationId);

    return this.prisma.client.coachAvailability.create({
      data: {
        userId: targetUserId,
        locationId: dto.locationId,
        dayOfWeek: dto.dayOfWeek,
        date: dto.date ? new Date(dto.date) : undefined,
        startTime: dto.startTime,
        endTime: dto.endTime,
        isTimeOff: dto.isTimeOff ?? false,
      },
    });
  }

  findForCoachAtLocation(userId: string, locationId: string, user: AuthenticatedUser) {
    this.assertCanManage(user, userId, locationId);
    return this.prisma.client.coachAvailability.findMany({
      where: { userId, locationId },
      orderBy: [{ dayOfWeek: 'asc' }, { date: 'asc' }],
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    const entry = await this.prisma.client.coachAvailability.findUnique({ where: { id } });
    if (!entry) {
      throw new NotFoundException('Availability entry not found');
    }
    this.assertCanManage(user, entry.userId, entry.locationId);
    return this.prisma.client.coachAvailability.delete({ where: { id } });
  }

  /** A coach may manage their own availability; HQ/Location Admin may manage any coach's. */
  private assertCanManage(user: AuthenticatedUser, targetUserId: string, locationId: string): void {
    if (user.id === targetUserId) {
      return;
    }
    if (user.globalRole === GlobalRole.HQ_ADMIN) {
      return;
    }
    const manages = user.locations.some(
      (l) => l.locationId === locationId && l.role === LocationRole.LOCATION_ADMIN,
    );
    if (!manages) {
      throw new ForbiddenException('You cannot manage this coach availability');
    }
  }
}
