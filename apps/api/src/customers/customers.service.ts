import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { GlobalRole, LocationRole } from '@g50golf/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { resolveLocationScope } from '../auth/location-access.util.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { AuthenticatedUser } from '../auth/types.js';
import type { CreateCustomerDto } from './dto/create-customer.dto.js';
import type { UpdateCustomerDto } from './dto/update-customer.dto.js';

const SALT_ROUNDS = 12;

export interface CustomerAdminFilters {
  locationId?: string;
  search?: string;
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async createCustomer(dto: CreateCustomerDto) {
    const existing = await this.prisma.client.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const customer = await this.prisma.client.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        globalRole: GlobalRole.CUSTOMER,
      },
    });
    const { passwordHash: _passwordHash, ...safeCustomer } = customer;
    return safeCustomer;
  }

  /**
   * Network-wide (HQ) or location-scoped (Location Admin) customer list —
   * the admin "Customers" page. A Location Admin only sees golfers who have
   * at least one booking at a location they manage (there's no other
   * concept of "belongs to this location" for a customer account, which by
   * design can book at any location — see Phase 2/9's cross-location
   * acceptance test).
   */
  async findAllForAdmin(filters: CustomerAdminFilters, user: AuthenticatedUser) {
    const locationIds = resolveLocationScope(user, filters.locationId);
    if (locationIds !== null && locationIds.length === 0) {
      return [];
    }

    const search = filters.search?.trim();

    return this.prisma.client.user.findMany({
      where: {
        globalRole: GlobalRole.CUSTOMER,
        ...(locationIds ? { bookings: { some: { locationId: { in: locationIds } } } } : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findOneForAdmin(id: string, user: AuthenticatedUser) {
    const customer = await this.prisma.client.user.findUnique({
      where: { id },
      include: {
        bookings: {
          include: {
            location: { select: { id: true, name: true } },
            session: { include: { service: { select: { name: true, type: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        },
        memberships: { include: { plan: true }, orderBy: { createdAt: 'desc' } },
        creditBalances: { include: { package: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!customer || customer.globalRole !== GlobalRole.CUSTOMER) {
      throw new NotFoundException('Customer not found');
    }

    this.assertCanAccessCustomer(user, customer.bookings);

    // Never return the password hash, even to HQ — `include` pulls every
    // scalar column, unlike the explicit `select` the list endpoint above uses.
    const { passwordHash: _passwordHash, ...safeCustomer } = customer;
    return safeCustomer;
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto, user: AuthenticatedUser) {
    const customer = await this.prisma.client.user.findUnique({
      where: { id },
      include: { bookings: { select: { locationId: true } } },
    });
    if (!customer || customer.globalRole !== GlobalRole.CUSTOMER) {
      throw new NotFoundException('Customer not found');
    }
    this.assertCanAccessCustomer(user, customer.bookings);

    const updated = await this.prisma.client.user.update({ where: { id }, data: dto });

    if (dto.isActive != null && dto.isActive !== customer.isActive) {
      void this.notifications.accountStatusChanged(updated, dto.isActive);
    }

    const { passwordHash: _passwordHash, ...safeCustomer } = updated;
    return safeCustomer;
  }

  private assertCanAccessCustomer(
    user: AuthenticatedUser,
    bookings: { locationId: string }[],
  ): void {
    if (user.globalRole === GlobalRole.HQ_ADMIN) {
      return;
    }
    const managedLocationIds = user.locations
      .filter((l) => l.role === LocationRole.LOCATION_ADMIN)
      .map((l) => l.locationId);
    const hasAccess = bookings.some((b) => managedLocationIds.includes(b.locationId));
    if (!hasAccess) {
      throw new ForbiddenException('You do not manage a location this customer has booked at');
    }
  }
}
