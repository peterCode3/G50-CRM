import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateServiceTemplateDto } from './dto/create-service-template.dto.js';
import type { UpdateServiceTemplateDto } from './dto/update-service-template.dto.js';

@Injectable()
export class ServiceTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateServiceTemplateDto) {
    return this.prisma.client.serviceTemplate.create({ data: dto });
  }

  findAll() {
    return this.prisma.client.serviceTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.client.serviceTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException('Service template not found');
    }
    return template;
  }

  async update(id: string, dto: UpdateServiceTemplateDto) {
    await this.findOne(id);
    return this.prisma.client.serviceTemplate.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    const activationCount = await this.prisma.client.service.count({ where: { templateId: id } });
    if (activationCount > 0) {
      throw new ConflictException(
        `This template has been activated at ${activationCount} location${activationCount === 1 ? "" : "s"} — deactivate it instead of deleting.`,
      );
    }
    await this.prisma.client.serviceTemplate.delete({ where: { id } });
    return { success: true };
  }
}
