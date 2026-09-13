import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@g50golf/db';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateLocationDto } from './dto/create-location.dto.js';
import type { UpdateLocationDto } from './dto/update-location.dto.js';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLocationDto) {
    const existing = await this.prisma.client.location.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`A location with slug "${dto.slug}" already exists`);
    }
    return this.prisma.client.location.create({
      data: { ...dto, openingHours: dto.openingHours as Prisma.InputJsonValue | undefined },
    });
  }

  findActive() {
    return this.prisma.client.location.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { services: { where: { isActive: true } } } } },
    });
  }

  findAll() {
    return this.prisma.client.location.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { services: { where: { isActive: true } } } } },
    });
  }

  async findOne(id: string) {
    const location = await this.prisma.client.location.findUnique({ where: { id } });
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    return location;
  }

  async update(id: string, dto: UpdateLocationDto) {
    await this.findOne(id);
    if (dto.slug) {
      const existing = await this.prisma.client.location.findUnique({ where: { slug: dto.slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`A location with slug "${dto.slug}" already exists`);
      }
    }
    return this.prisma.client.location.update({
      where: { id },
      data: { ...dto, openingHours: dto.openingHours as Prisma.InputJsonValue | undefined },
    });
  }

  async setActive(id: string, isActive: boolean) {
    await this.findOne(id);
    return this.prisma.client.location.update({ where: { id }, data: { isActive } });
  }
}
