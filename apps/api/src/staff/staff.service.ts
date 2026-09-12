import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
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

  /** Removes one (location, role) assignment — the account itself isn't deleted. */
  async removeRole(userId: string, locationId: string, role: LocationRole, user: AuthenticatedUser) {
    assertManagesLocation(user, locationId);
    await this.prisma.client.userLocation.deleteMany({ where: { userId, locationId, role } });
  }
}
