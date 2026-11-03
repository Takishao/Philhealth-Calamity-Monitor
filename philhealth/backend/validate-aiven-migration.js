import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {postgresClient} from './postgres.js';
const client=postgresClient();
const migration = readFileSync(join(process.cwd(), 'backend', 'postgres-migrations', '001_security_sessions.sql'), 'utf8')
  .replace(/^BEGIN;\s*/m, '').replace(/\s*COMMIT;\s*$/m, '');

await client.connect();
try {
  await client.query('BEGIN');
  await client.query(migration);
  await client.query('ROLLBACK');
  console.log('Migration syntax and permissions validated; transaction rolled back.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await client.end();
}
