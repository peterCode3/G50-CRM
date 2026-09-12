import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertManagesLocation } from '../auth/location-access.util.js';
import type { AuthenticatedUser } from '../auth/types.js';
import type { ActivateTemplateDto } from './dto/activate-template.dto.js';
import type { UpdateServiceDto } from './dto/update-service.dto.js';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async activateTemplate(locationId: string, dto: ActivateTemplateDto) {
    const template = await this.prisma.client.serviceTemplate.findUnique({
      where: { id: dto.templateId },
    });
    if (!template) {
      throw new NotFoundException('Service template not found');
    }

    const location = await this.prisma.client.location.findUnique({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return this.prisma.client.service.create({
      data: {
        templateId: template.id,
        locationId,
        name: template.name,
        description: template.description,
        category: template.category,
        type: template.type,
        durationMinutes: dto.durationMinutes ?? template.defaultDurationMinutes,
        capacity: dto.capacity ?? template.defaultCapacity,
        price: dto.price ?? template.defaultPrice,
        memberPrice: dto.memberPrice ?? template.defaultMemberPrice,
        images: template.images,
      },
    });
  }

  findForLocation(locationId: string) {
    return this.prisma.client.service.findMany({
      where: { locationId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const service = await this.prisma.client.service.findUnique({ where: { id } });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }

  async update(id: string, dto: UpdateServiceDto, user: AuthenticatedUser) {
    const service = await this.findOne(id);
    assertManagesLocation(user, service.locationId);
    return this.prisma.client.service.update({ where: { id }, data: dto });
  }
}
