-- AlterTable
ALTER TABLE "users" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "homePhone" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "referredBy" TEXT,
ADD COLUMN     "workPhone" TEXT;
