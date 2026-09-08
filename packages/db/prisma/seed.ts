import { PrismaClient, GlobalRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const HQ_ADMIN_EMAIL = "hqadmin@g50.golf";
const HQ_ADMIN_PASSWORD = "changeme123";

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: HQ_ADMIN_EMAIL } });
  if (existing) {
    console.log(`HQ admin already exists: ${HQ_ADMIN_EMAIL}`);
    return;
  }

  const passwordHash = await bcrypt.hash(HQ_ADMIN_PASSWORD, 12);

  await prisma.user.create({
    data: {
      email: HQ_ADMIN_EMAIL,
      passwordHash,
      firstName: "G50",
      lastName: "HQ Admin",
      globalRole: GlobalRole.HQ_ADMIN,
    },
  });

  console.log(`Created HQ admin: ${HQ_ADMIN_EMAIL} / ${HQ_ADMIN_PASSWORD}`);
  console.log("Change this password before any real deployment.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
