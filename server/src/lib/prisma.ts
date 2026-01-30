import { PrismaClient } from "../../generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL || "";
const isSqlite = databaseUrl.startsWith("file:");

async function createPrismaClient(): Promise<PrismaClient> {
  if (isSqlite) {
    // SQLite: use better-sqlite3 adapter
    const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
    const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
    return new PrismaClient({ adapter });
  } else {
    // PostgreSQL: use pg adapter
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const pg = await import("pg");

    const pool = new pg.default.Pool({
      connectionString: databaseUrl,
    });

    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  }
}

export const prisma = await createPrismaClient();
