import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { GlobalRole, type User } from '@g50golf/db';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { AuthenticatedUser } from './types.js';

const PROFILE_COMPLETE_FIELDS = [
  'phone',
  'dateOfBirth',
  'address',
  'city',
  'postalCode',
  'homeLocationId',
] as const satisfies readonly (keyof User)[];

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthenticatedUser> {
    const existing = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.client.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        globalRole: GlobalRole.CUSTOMER,
      },
    });

    return this.toAuthenticatedUser(user, []);
  }

  async login(dto: LoginDto): Promise<AuthenticatedUser> {
    const user = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
      include: { locations: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.toAuthenticatedUser(user, user.locations);
  }

  async getAuthenticatedUser(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: { locations: true },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return this.toAuthenticatedUser(user, user.locations);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<AuthenticatedUser> {
    const user = await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
      include: { locations: true },
    });
    return this.toAuthenticatedUser(user, user.locations);
  }

  signToken(userId: string): string {
    return this.jwt.sign({ sub: userId });
  }

  private toAuthenticatedUser(
    user: User,
    locations: { locationId: string; role: string }[],
  ): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      globalRole: user.globalRole,
      locations: locations.map((l) => ({
        locationId: l.locationId,
        role: l.role as AuthenticatedUser['locations'][number]['role'],
      })),
      phone: user.phone,
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString() : null,
      address: user.address,
      city: user.city,
      postalCode: user.postalCode,
      homeLocationId: user.homeLocationId,
      gender: user.gender,
      referredBy: user.referredBy,
      homePhone: user.homePhone,
      workPhone: user.workPhone,
      profileComplete: PROFILE_COMPLETE_FIELDS.every((field) => user[field] != null),
    };
  }
}
