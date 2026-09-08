import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __g50golfPrisma: PrismaClient | undefined;
}

export const prisma = global.__g50golfPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__g50golfPrisma = prisma;
}

export * from "@prisma/client";
