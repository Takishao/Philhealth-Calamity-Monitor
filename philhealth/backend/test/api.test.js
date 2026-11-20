import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../server.js';

async function appForTest() { return buildApp({ database: ':memory:', serveFrontend: false }); }
async function signIn(app, username = 'cfb', password = 'demo1234') {
  const csrf = await app.inject({ method: 'GET', url: '/api/csrf' });
  const cookie = csrf.headers['set-cookie'].split(';')[0];
  const login = await app.inject({ method: 'POST', url: '/api/login', headers: { cookie, 'x-csrf-token': csrf.json().csrfToken }, payload: { username, password } });
  return { login, cookie: login.headers['set-cookie'].split(';')[0], csrf: login.json().csrfToken };
}

test('login creates a strict, secure server session and dashboard is protected', async t => {
  const app = await appForTest(); t.after(() => app.close());
  assert.equal((await app.inject('/api/dashboard')).statusCode, 401);
  const auth = await signIn(app);
  assert.equal(auth.login.statusCode, 200);
  assert.match(auth.login.headers['set-cookie'], /HttpOnly; Secure; SameSite=Strict/);
  const dashboard = await app.inject({ method: 'GET', url: '/api/dashboard', headers: { cookie: auth.cookie } });
  assert.equal(dashboard.statusCode, 200);
  assert.equal(dashboard.json().event.id, 'CE-2026-001');
});

test('the local HTTP address redirects to localhost for secure-cookie development', async t => {
  const app = await buildApp({ database: ':memory:' }); t.after(() => app.close());
  const response = await app.inject({ method: 'GET', url: '/', headers: { host: '127.0.0.1:3000' } });
  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, 'http://localhost:3000/');
});

test('ROS can only access their own region and CFB changes are audited', async t => {
  const app = await appForTest(); t.after(() => app.close());
  const ros = await signIn(app, 'ros_xi');
  const claims = await app.inject({ method: 'GET', url: '/api/claims', headers: { cookie: ros.cookie } });
  assert.ok(claims.json().every(claim => claim.region === 'XI'));
  const blocked = await app.inject({ method: 'GET', url: '/api/claims/CLM-001-VII-00012', headers: { cookie: ros.cookie } });
  assert.equal(blocked.statusCode, 404);
  const cfb = await signIn(app);
  const changed = await app.inject({ method: 'POST', url: '/api/claims/CLM-001-IVA-00009/status', headers: { cookie: cfb.cookie, 'x-csrf-token': cfb.csrf }, payload: { status: 'Approved' } });
  assert.equal(changed.statusCode, 200);
  const audit = await app.inject({ method: 'GET', url: '/api/audit', headers: { cookie: cfb.cookie } });
  assert.equal(audit.json().chainOk, true);
  assert.ok(audit.json().rows.some(row => row.action === 'UPDATE_STATUS'));
});

test('state-changing routes reject missing CSRF tokens', async t => {
  const app = await appForTest(); t.after(() => app.close());
  const auth = await signIn(app);
  const response = await app.inject({ method: 'POST', url: '/api/exceptions/1/resolve', headers: { cookie: auth.cookie } });
  assert.equal(response.statusCode, 403);
});

test('login locks a username and IP after five failed attempts in fifteen minutes', async t => {
  const app = await appForTest(); t.after(() => app.close());
  const csrf = await app.inject({ method: 'GET', url: '/api/csrf' });
  const cookie = csrf.headers['set-cookie'].split(';')[0];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failed = await app.inject({ method: 'POST', url: '/api/login', headers: { cookie, 'x-csrf-token': csrf.json().csrfToken }, payload: { username: 'cfb', password: 'wrong-password' } });
    assert.equal(failed.statusCode, 401);
  }
  const locked = await app.inject({ method: 'POST', url: '/api/login', headers: { cookie, 'x-csrf-token': csrf.json().csrfToken }, payload: { username: 'cfb', password: 'demo1234' } });
  assert.equal(locked.statusCode, 429);
});

test('event dropdown metadata stays protected and avoids financial scans',async t=>{
 const app=await appForTest();t.after(()=>app.close());
 assert.equal((await app.inject('/api/events?summary=1')).statusCode,401);
 const auth=await signIn(app);const prepare=app.db.prepare.bind(app.db);const statements=[];
 app.db.prepare=sql=>{statements.push(sql);return prepare(sql);};
 const result=await app.inject({url:'/api/events?summary=1',headers:{cookie:auth.cookie}});
 assert.equal(result.statusCode,200);assert.ok(result.json().length>0);
 assert.deepEqual(Object.keys(result.json()[0]).sort(),['id','name']);
 assert.ok(!statements.some(sql=>/FROM (claims|payments|exceptions|settings)\b/i.test(sql)));
 const full=await app.inject({url:'/api/events',headers:{cookie:auth.cookie}});
 assert.ok(full.json().every(event=>event.totals&&event.signal));
});

test('public assets load without a database transaction while API remains protected',async t=>{
 const app=await buildApp({database:':memory:'});t.after(()=>app.close());
 const begin=app.db.beginRequest.bind(app.db);let calls=0;
 app.db.beginRequest=async()=>{calls++;return begin();};
 for(const url of ['/','/styles/style.css','/js/app.js','/assets/favicon.svg']) {
  const result=await app.inject(url);assert.equal(result.statusCode,200,url);
  assert.equal(calls,0);assert.ok(result.headers['content-security-policy']);
 }
 assert.equal((await app.inject('/api/dashboard')).statusCode,401);assert.equal(calls,1);
});
