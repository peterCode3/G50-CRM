import { IsIn, IsOptional } from 'class-validator';

export type BookingPaymentMethod = 'FULL_PRICE' | 'MEMBERSHIP' | 'CREDIT';

export class CreateBookingDto {
  @IsOptional()
  @IsIn(['FULL_PRICE', 'MEMBERSHIP', 'CREDIT'])
  paymentMethod?: BookingPaymentMethod;
}
