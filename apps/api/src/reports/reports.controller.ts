import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GlobalRole, LocationRole } from '@g50golf/db';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { ReportsService, type ReportFilters } from './reports.service.js';

function readFilters(query: Record<string, string | undefined>): ReportFilters {
  return {
    locationId: query.locationId || undefined,
    from: query.from || undefined,
    to: query.to || undefined,
    serviceId: query.serviceId || undefined,
    coachId: query.coachId || undefined,
    customerId: query.customerId || undefined,
  };
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const EXPORT_COLUMNS = [
  'bookingDate',
  'sessionStart',
  'location',
  'service',
  'serviceType',
  'coach',
  'golfer',
  'golferEmail',
  'bookingStatus',
  'attendanceStatus',
  'priceCharged',
] as const;

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Get('overview')
  getOverview(
    @Query() query: Record<string, string | undefined>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.getOverview(readFilters(query), user);
  }

  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Get('export.csv')
  async exportCsv(
    @Query() query: Record<string, string | undefined>,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const rows = await this.reportsService.getExportRows(readFilters(query), user);
    const lines = [
      EXPORT_COLUMNS.join(','),
      ...rows.map((row) => EXPORT_COLUMNS.map((col) => csvCell(String(row[col]))).join(',')),
    ];
    const csv = lines.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="g50-bookings-export.csv"`);
    res.send(csv);
  }
}
