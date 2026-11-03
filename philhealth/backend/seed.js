import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './db.js';

if(process.env.DB_DRIVER==='postgres')throw new Error('SQLite demo seeding cannot run against PostgreSQL. Use the explicit seed:postgres-demo command.');
process.env.SEED_DEMO = '1';
const here = fileURLToPath(new URL('.', import.meta.url));
const db = await createDatabase(join(here, 'data', 'calamity.db'));
await db.close();
