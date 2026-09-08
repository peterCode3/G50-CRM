import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { GlobalRole, LocationRole } from '@g50golf/db';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateStaffDto } from './dto/create-staff.dto.js';

const SALT_ROUNDS = 12;

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
}
