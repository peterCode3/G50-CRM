import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { GlobalRole, LocationRole } from '@g50golf/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertManagesLocation, resolveLocationScope } from '../auth/location-access.util.js';
import type { AuthenticatedUser } from '../auth/types.js';
import type { CreateStaffDto } from './dto/create-staff.dto.js';

const SALT_ROUNDS = 12;

export interface StaffAdminFilters {
  locationId?: string;
  search?: string;
}

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async createStaff(dto: CreateStaffDto) {
    let user = await this.prisma.client.user.findUnique({ where: { email: dto.email } });

    if (!user) {
      if (!dto.password || !dto.firstName || !dto.lastName) {
        throw new BadRequestException(
          'firstName, lastName and password are required to create a new staff account',
        );
      }
      const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
      user = await this.prisma.client.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          globalRole:
            dto.role === LocationRole.LOCATION_ADMIN
              ? GlobalRole.LOCATION_ADMIN
              : GlobalRole.COACH,
        },
      });
    }

    const existingLink = await this.prisma.client.userLocation.findUnique({
      where: {
        userId_locationId_role: {
          userId: user.id,
          locationId: dto.locationId,
          role: dto.role,
        },
      },
    });
    if (existingLink) {
      throw new ConflictException('This user already has that role at this location');
    }

    await this.prisma.client.userLocation.create({
      data: { userId: user.id, locationId: dto.locationId, role: dto.role },
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      locationId: dto.locationId,
      role: dto.role,
    };
  }

  async findForLocation(locationId: string) {
    const links = await this.prisma.client.userLocation.findMany({
      where: { locationId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return links.map((link) => ({
      userId: link.user.id,
      email: link.user.email,
      firstName: link.user.firstName,
      lastName: link.user.lastName,
      role: link.role,
    }));
  }

  /**
   * Network-wide (HQ) or location-scoped (Location Admin) staff directory —
   * the admin "Staff Members" page. A staff member with roles at several
   * locations appears once, with every (location, role) pair attached —
   * matches the actual data model (one account, many UserLocation rows).
   */
  async findAllForAdmin(filters: StaffAdminFilters, user: AuthenticatedUser) {
    const locationIds = resolveLocationScope(user, filters.locationId);
    if (locationIds !== null && locationIds.length === 0) {
      return [];
    }

    const search = filters.search?.trim();

    const links = await this.prisma.client.userLocation.findMany({
      where: {
        role: { in: [LocationRole.LOCATION_ADMIN, LocationRole.COACH] },
        ...(locationIds ? { locationId: { in: locationIds } } : {}),
        ...(search
          ? {
              user: {
                OR: [
                  { firstName: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true },
        },
        location: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const byUser = new Map<
      string,
      {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string | null;
        isActive: boolean;
        roles: { locationId: string; locationName: string; role: LocationRole }[];
      }
    >();
    for (const link of links) {
      const entry = byUser.get(link.user.id) ?? { ...link.user, roles: [] };
      entry.roles.push({ locationId: link.location.id, locationName: link.location.name, role: link.role });
      byUser.set(link.user.id, entry);
    }
    return [...byUser.values()];
  }

  /**
   * A single coach/location-admin's full profile — spec §5's "services/classes
   * delivered", "availability/upcoming schedule" and "assigned clients", none
   * of which the list view surfaces. HQ can view any staff member; a Location
   * Admin only one who works at a location they manage.
   */
  async findOneForAdmin(userId: string, user: AuthenticatedUser) {
    const links = await this.prisma.client.userLocation.findMany({
      where: { userId, role: { in: [LocationRole.LOCATION_ADMIN, LocationRole.COACH] } },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true },
        },
        location: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (links.length === 0) {
      throw new NotFoundException('Staff member not found');
    }

    const locationIds = links.map((l) => l.locationId);
    if (user.globalRole !== GlobalRole.HQ_ADMIN) {
      const managesAny = user.locations.some(
        (l) => l.role === LocationRole.LOCATION_ADMIN && locationIds.includes(l.locationId),
      );
      if (!managesAny) {
        throw new ForbiddenException('You do not manage a location this staff member works at');
      }
    }

    const [serviceLinks, upcomingSessions, clientBookings] = await Promise.all([
      this.prisma.client.serviceCoach.findMany({
        where: { userId },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              type: true,
              isActive: true,
              location: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.client.session.findMany({
        where: { coachId: userId, isCancelled: false, startTime: { gte: new Date() } },
        include: {
          service: { select: { name: true, type: true } },
          location: { select: { name: true } },
          _count: { select: { bookings: { where: { status: { in: ['CONFIRMED', 'PENDING'] } } } } },
        },
        orderBy: { startTime: 'asc' },
        take: 50,
      }),
      this.prisma.client.booking.findMany({
        where: {
          status: { in: ['CONFIRMED', 'PENDING', 'COMPLETED'] },
          session: { coachId: userId },
        },
        distinct: ['userId'],
        select: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const { user: profile } = links[0];
    return {
      ...profile,
      roles: links.map((l) => ({ locationId: l.location.id, locationName: l.location.name, role: l.role })),
      services: serviceLinks.map((sc) => ({
        id: sc.service.id,
        name: sc.service.name,
        type: sc.service.type,
        isActive: sc.service.isActive,
        locationName: sc.service.location.name,
      })),
      upcomingSessions: upcomingSessions.map(({ _count, ...s }) => ({
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        capacity: s.capacity,
        bookedCount: _count.bookings,
        serviceName: s.service.name,
        serviceType: s.service.type,
        locationName: s.location.name,
      })),
      clients: clientBookings.map((b) => b.user),
    };
  }

  /** Removes one (location, role) assignment — the account itself isn't deleted. */
  async removeRole(userId: string, locationId: string, role: LocationRole, user: AuthenticatedUser) {
    assertManagesLocation(user, locationId);
    await this.prisma.client.userLocation.deleteMany({ where: { userId, locationId, role } });
  }
}
