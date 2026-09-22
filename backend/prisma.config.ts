import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Prisma CLI operations should prefer Supabase's direct connection.
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
});
