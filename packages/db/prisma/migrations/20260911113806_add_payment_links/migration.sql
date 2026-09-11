-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "creditBalanceId" TEXT,
ADD COLUMN     "userMembershipId" TEXT;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userMembershipId_fkey" FOREIGN KEY ("userMembershipId") REFERENCES "user_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_creditBalanceId_fkey" FOREIGN KEY ("creditBalanceId") REFERENCES "credit_balances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
