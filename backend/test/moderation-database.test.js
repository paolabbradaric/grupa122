const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { once } = require('node:events');
const express = require('express');
const { Pool } = require('pg');
const { createModerationModel } = require('../src/admin/model');
const { createAdminRouter } = require('../src/admin/routes');
const { createModerationRouter } = require('../src/admin/publicRoutes');
const { cleanupModerationFiles } = require('../src/admin/cleanup');
const { createEmployerCastingModel } = require('../src/models/employerCastingModel');
const { createProfileModel } = require('../src/profiles/model');
const connectionString = process.env.MODERATION_TEST_DATABASE_URL;

test('moderation: isolated PostgreSQL, HTTP permissions, races, deletion and storage recovery', {
  skip: !connectionString ? 'Set MODERATION_TEST_DATABASE_URL to a disposable local PostgreSQL server.' : false,
}, async t => {
  const url = new URL(connectionString);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Only local disposable PostgreSQL is allowed');
  const admin = new Pool({ connectionString });
  const database = 'moderation_test_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE DATABASE ${database}`);
  url.pathname = '/' + database;
  const pool = new Pool({ connectionString: url.href });
  t.after(async () => {
    await pool.end();
    await admin.query(`DROP DATABASE ${database}`);
    await admin.end();
  });
  const schema = await readFile(path.resolve(__dirname, '../../db/schema.sql'), 'utf8');
  const migration = await readFile(path.resolve(__dirname, '../../db/migrations/moderation.sql'), 'utf8');
  const query = async (sql, values) => (await pool.query(sql, values)).rows;
  const row = async (sql, values) => (await query(sql, values))[0];
  await pool.query(schema.split('-- Verifikacija i moderacija (ista struktura')[0]);
  async function user(role, name) {
    const result = await row(`INSERT INTO users(auth_id,email,first_name,last_name,birth_date,role)
      VALUES($1,$2,'Test','User','2000-01-01',$3) RETURNING *`, [`google:${name}`, `${name}@example.test`, role]);
    result.googleAuthId = result.auth_id;
    return result;
  }
  const employer = await user('employer', 'employer');
  const otherEmployer = await user('employer', 'otheremployer');
  const candidate = await user('candidate', 'candidate');
  const otherCandidate = await user('candidate', 'othercandidate');
  const administrator = await user('admin', 'admin1');
  const administrator2 = await user('admin', 'admin2');
  const candidateProfile = await row('INSERT INTO candidate_profiles(user_id) VALUES($1) RETURNING id', [candidate.id]);
  const otherProfile = await row('INSERT INTO candidate_profiles(user_id) VALUES($1) RETURNING id', [otherCandidate.id]);
  async function org(owner, regNum) {
    return row(`INSERT INTO organisations(owner_id,company_name,reg_num,contact_email,phone,location)
      VALUES($1,'Test studio',$2,'contact@example.test','+385 1 111111','Zagreb') RETURNING *`, [owner.id, regNum]);
  }
  const organisation = await org(employer, '33392005961');
  const otherOrg = await org(otherEmployer, '00000000001');
  // An existing rejection survives migration; its historical reviewer is preserved.
  const old = await row(`INSERT INTO verification(status,org_id,reviewed_by,rejection_reason)
    VALUES('rejected',$1,$2,'Old decision') RETURNING id`, [organisation.id, administrator.id]);
  await t.test('migration rollback, upgrades existing rows, repeatability and RLS', async () => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN'); await c.query(migration); await c.query('ROLLBACK');
      assert.equal((await c.query("SELECT to_regclass('public.casting_reports') AS name")).rows[0].name, null);
      await c.query('BEGIN'); await c.query(migration); await c.query('COMMIT');
      await c.query(migration);
    } finally { c.release(); }
    assert.equal((await row('SELECT reviewed_by FROM verification WHERE id=$1', [old.id])).reviewed_by, administrator.id);
    assert.equal((await row(`SELECT count(*)::int n FROM pg_class WHERE relname IN
      ('casting_reports','verification','moderation_events','moderation_file_cleanup') AND relrowsecurity`)).n, 4);
    assert.equal((await row("SELECT has_table_privilege('public','public.casting_reports','SELECT') AS allowed")).allowed, false);
  });
  const model = createModerationModel(pool);
  const casts = createEmployerCastingModel(pool);
  let actor = null;
  const config = { allowedOrigins: new Set(['http://localhost:5173']),
    adminEmails: new Set([administrator.email, administrator2.email]) };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = actor;
    req.isAuthenticated = () => !!actor;
    req.session = { csrfToken: 'test-csrf', googleIdentity: actor && {
      verified: true, authId: actor.auth_id, email: actor.email,
    } };
    next();
  });
  app.use('/api/admin', createAdminRouter({ config, pool }));
  app.use('/api', createModerationRouter({ config, pool }));
  app.use((error, req, res, _next) => res.status(error.status || 500).json({ code: error.code, error: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(route, method = 'GET', body, secure = true) {
    const response = await fetch(base + '/api' + route, { method, headers: {
      ...(secure ? { Origin: 'http://localhost:5173', 'X-CSRF-Token': 'test-csrf' } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    }, body: body !== undefined ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json() };
  }
  await t.test('all business routes reject guests, wrong roles, forged fields and missing CSRF', async () => {
    const operations = [['/admin/verifications', 'GET'], ['/admin/reports', 'GET'], ['/admin/stats', 'GET'],
      ['/admin/verifications/1', 'PATCH'], ['/admin/reports/1', 'PATCH'], ['/admin/castings/1', 'DELETE']];
    for (const user of [null, candidate, employer]) {
      actor = user;
      for (const [route, method] of operations)
        assert.equal((await request(route, method, method === 'GET' ? undefined : {})).status, user ? 403 : 401);
    }
    actor = administrator;
    for (const [route, method] of operations.filter(([, m]) => m !== 'GET'))
      assert.equal((await request(route, method, {}, false)).status, 403);
    actor = candidate;
    assert.equal((await request('/employer/verification', 'POST', {})).status, 403);
    actor = employer;
    assert.equal((await request('/employer/verification', 'POST', {}, false)).status, 403);
    assert.equal((await request('/employer/verification', 'POST', { orgId: otherOrg.id })).status, 400);
    actor = administrator;
    assert.equal((await request('/admin/verifications?limit=-1')).status, 400);
    assert.equal((await request('/admin/verifications?status=anything')).status, 400);
    assert.equal((await request('/admin/verifications/1', 'PATCH', { status: 'approved', reviewedBy: 999 })).status, 400);
  });
  let verification;
  await t.test('concurrent submission and claim, rejection reason and resubmission preserve history', async () => {
    const submitted = await Promise.allSettled([model.submit(employer.id), model.submit(employer.id)]);
    assert.equal(submitted.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(submitted.find(r => r.status === 'rejected').reason.status, 409);
    verification = submitted.find(r => r.status === 'fulfilled').value.verification;
    assert.equal(verification.status, 'pending');
    assert.equal(verification.submittedData.reg_num, organisation.reg_num);
    actor = administrator;
    assert.equal((await request(`/admin/verifications/${verification.id}`, 'PATCH', { status: 'approved' })).status, 409);
    const claimed = await Promise.allSettled([
      model.reviewVerification(administrator.id, verification.id, 'under_review'),
      model.reviewVerification(administrator2.id, verification.id, 'under_review'),
    ]);
    assert.equal(claimed.filter(r => r.status === 'fulfilled').length, 1);
    const reviewer = claimed.find(r => r.status === 'fulfilled').value.verification.reviewedBy;
    actor = reviewer === administrator.id ? administrator : administrator2;
    const loser = reviewer === administrator.id ? administrator2 : administrator;
    await assert.rejects(model.reviewVerification(loser.id, verification.id, 'approved'), e => e.code === 'OTHER_REVIEWER');
    assert.equal((await request(`/admin/verifications/${verification.id}`, 'PATCH', { status: 'rejected', reason: ' ' })).status, 400);
    assert.equal((await request(`/admin/verifications/${verification.id}`, 'PATCH', { status: 'rejected', reason: 'Dopunite podatke.' })).status, 200);
    actor = employer;
    assert.equal((await request('/employer/verification')).data.verification.rejectionReason, 'Dopunite podatke.');
    verification = (await request('/employer/verification', 'POST', {})).data.verification;
    assert.equal(verification.status, 'pending');
    assert.equal((await row('SELECT status FROM verification WHERE id=$1', [old.id])).status, 'rejected');
    assert.equal((await row('SELECT count(*)::int n FROM verification WHERE org_id=$1', [organisation.id])).n, 3);
    actor = administrator;
    const list = await request('/admin/verifications?status=pending&limit=1');
    assert.equal(list.data.items.length, 1); assert.equal(list.data.items[0].id, verification.id);
  });
  await t.test('snapshot changes cannot be approved; one terminal decision, profile and publishing use latest status', async () => {
    await model.reviewVerification(administrator.id, verification.id, 'under_review');
    await pool.query("UPDATE organisations SET company_name='Changed studio' WHERE id=$1", [organisation.id]);
    await assert.rejects(model.reviewVerification(administrator.id, verification.id, 'approved'), e => e.code === 'ORGANISATION_CHANGED');
    await pool.query("UPDATE organisations SET company_name='Test studio' WHERE id=$1", [organisation.id]);
    const results = await Promise.allSettled([
      model.reviewVerification(administrator.id, verification.id, 'approved'),
      model.reviewVerification(administrator.id, verification.id, 'approved'),
    ]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await model.mine(employer.id)).verification.status, 'approved');
    const profile = await createProfileModel(pool).read(employer);
    assert.equal(profile.profile.verificationStatus, 'approved');
    await assert.rejects(model.submit(employer.id), e => e.status === 409);
    const draft = await casts.createDraft(employer.id, { projectTitle: 'Verified project', projectType: 'film',
      projectDescription: 'Film', roleTitle: 'Role', roleDescription: 'Description', positionsCount: 1,
      maxApplications: 1000, minAge: 18, maxAge: 40, location: 'Zagreb', applicationDeadline: '2030-01-01T00:00:00Z' });
    assert.equal((await casts.publishDraft(employer.id, draft.id)).outcome, 'published');
    const otherDraft = await casts.createDraft(otherEmployer.id, { projectTitle: 'Unverified project', projectType: 'film' });
    assert.equal((await casts.publishDraft(otherEmployer.id, otherDraft.id)).outcome, 'not_verified');
    assert.equal((await row("SELECT count(*)::int n FROM notifications WHERE user_id=$1 AND type='verification'", [employer.id])).n, 2);
  });
  async function casting(owner = employer) {
    const draft = await casts.createDraft(owner.id, { projectTitle: 'Moderation project', projectType: 'film' });
    await pool.query(`UPDATE casting_calls SET title='Reported casting',description='Description',positions_count=1,
      min_age=18,max_age=40,location='Zagreb',application_deadline='2030-01-01',status='published' WHERE id=$1`, [draft.id]);
    return draft.id;
  }
  let castingId;
  let report;
  await t.test('report validation, duplicate races, public status and permanent dismissal', async () => {
    castingId = await casting();
    actor = candidate;
    assert.equal((await request(`/castings/${castingId}/reports`, 'POST', { reason: '' })).status, 400);
    assert.equal((await request(`/castings/${castingId}/reports`, 'POST', { reason: 'x'.repeat(2001) })).status, 400);
    assert.equal((await request(`/castings/${castingId}/reports`, 'POST', { reason: 'Test', reporterId: administrator.id })).status, 400);
    actor = employer;
    assert.equal((await request(`/castings/${castingId}/reports`, 'POST', { reason: 'Own casting' })).status, 403);
    const dup = await Promise.allSettled([model.report(candidate.id, castingId, 'Inappropriate'), model.report(candidate.id, castingId, 'Duplicate')]);
    assert.equal(dup.filter(r => r.status === 'fulfilled').length, 1);
    report = dup.find(r => r.status === 'fulfilled').value.report;
    assert.equal((await row('SELECT status FROM casting_calls WHERE id=$1', [castingId])).status, 'published');
    const dismissals = await Promise.allSettled([
      model.dismissReport(administrator.id, report.id, 'No violation'),
      model.dismissReport(administrator2.id, report.id, 'No violation'),
    ]);
    assert.equal(dismissals.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await row('SELECT status FROM casting_reports WHERE id=$1', [report.id])).status, 'dismissed');
    report = (await model.report(candidate.id, castingId, 'New evidence')).report;
    const draft = await casts.createDraft(employer.id, { projectTitle: 'Hidden', projectType: 'film' });
    await assert.rejects(model.report(candidate.id, draft.id, 'Hidden'), e => e.status === 404);
    actor = administrator;
    assert.equal((await request('/admin/reports?status=open')).data.items[0].id, report.id);
  });
  let orphanKey;
  let sharedKey;
  let profileKey;
  let appId;
  let slotId;
  let bookingId;
  const stored = new Set();
  await t.test('prepare every FK, unique, shared and profile media before deletion', async () => {
    appId = (await row(`INSERT INTO applications(status,candidate_id,casting_call_id)
      VALUES('SUBMITTED',$1,$2) RETURNING id`, [candidateProfile.id, castingId])).id;
    const secondCasting = await casting();
    const secondApp = (await row(`INSERT INTO applications(status,candidate_id,casting_call_id)
      VALUES('SUBMITTED',$1,$2) RETURNING id`, [otherProfile.id, secondCasting])).id;
    slotId = (await row(`INSERT INTO audition_slots(starts_at,ends_at,location,capacity,status,casting_call_id)
      VALUES('2030-01-01 10:00Z','2030-01-01 11:00Z','Zagreb',1,'scheduled',$1) RETURNING id`, [castingId])).id;
    bookingId = (await row(`INSERT INTO audition_bookings(status,booked_at,audition_slot_id,application_id)
      VALUES('booked',now(),$1,$2) RETURNING id`, [slotId, appId])).id;
    await pool.query(`INSERT INTO notifications(type,title,message,user_id,application_id,casting_call_id,booking_id)
      VALUES('audition','Title','Message',$1,$2,$3,$4)`, [candidate.id, appId, castingId, bookingId]);
    await pool.query(`INSERT INTO application_status_history(new_status,application_id,changed_by)
      VALUES('SUBMITTED',$1,$2)`, [appId, candidate.id]);
    await pool.query(`INSERT INTO casting_call_status_history(new_status,casting_call_id,changed_by)
      VALUES('published',$1,$2)`, [castingId, employer.id]);
    const skill = await row("INSERT INTO skills(name) VALUES('acting') RETURNING id");
    await pool.query('INSERT INTO casting_call_skills(casting_call_id,skill_id) VALUES($1,$2)', [castingId, skill.id]);
    async function media(key) {
      stored.add(key);
      await pool.query('INSERT INTO profile_storage_objects(storage_key) VALUES($1)', [key]);
      const media = await row(`INSERT INTO media_files(kind,storage_key,original_name,mime_type,size_bytes,owner_user_id)
        VALUES('image',$1,'test.png','image/png',10,$2) RETURNING id`, [key, candidate.id]);
      await pool.query("INSERT INTO application_files(kind,application_id,media_file_id) VALUES('image',$1,$2)", [appId, media.id]);
      return media.id;
    }
    orphanKey = 'profiles/orphan.png'; sharedKey = 'profiles/shared.png'; profileKey = 'profiles/avatar.png';
    await media(orphanKey);
    const shared = await media(sharedKey);
    const avatar = await media(profileKey);
    await pool.query("INSERT INTO application_files(kind,application_id,media_file_id) VALUES('image',$1,$2)", [secondApp, shared]);
    await pool.query("INSERT INTO profile_media(media_id,owner_user_id,candidate_id,purpose) VALUES($1,$2,$3,'avatar')",
      [avatar, candidate.id, candidateProfile.id]);
  });
  await t.test('explicit deletion confirmation and mid-transaction failure preserve all DB rows and external files', async () => {
    actor = administrator;
    assert.equal((await request(`/admin/castings/${castingId}`, 'DELETE', { reason: 'Violation', confirmation: 'yes' })).status, 400);
    const faulty = { connect: async () => {
      const c = await pool.connect();
      return { release: () => c.release(), query(sql, args) {
        if (sql === 'DELETE FROM casting_calls WHERE id=$1') throw new Error('Injected DB failure');
        return c.query(sql, args);
      } };
    } };
    await assert.rejects(createModerationModel(faulty).deleteCasting(administrator.id, castingId, 'Violation'), /Injected/);
    assert.ok(await row('SELECT id FROM casting_calls WHERE id=$1', [castingId]));
    assert.ok(await row('SELECT id FROM applications WHERE id=$1', [appId]));
    assert.ok(await row('SELECT id FROM audition_bookings WHERE id=$1', [bookingId]));
    assert.equal((await row('SELECT status FROM casting_reports WHERE id=$1', [report.id])).status, 'open');
    assert.equal((await row('SELECT count(*)::int n FROM app_private.moderation_file_cleanup')).n, 0);
    assert.equal(stored.size, 3);
  });
  await t.test('confirmed HTTP deletion removes the full graph, preserves people/shared files and notifies once', async () => {
    actor = administrator;
    const deleted = await request(`/admin/castings/${castingId}`, 'DELETE', { reason: 'Violation', confirmation: `OBRIŠI ${castingId}` });
    assert.equal(deleted.status, 200, JSON.stringify(deleted.data)); assert.equal(deleted.data.cleanupQueued, 1);
    for (const table of ['casting_calls', 'applications', 'audition_slots', 'audition_bookings']) {
      const id = { casting_calls: castingId, applications: appId, audition_slots: slotId, audition_bookings: bookingId }[table];
      assert.equal((await query(`SELECT id FROM ${table} WHERE id=$1`, [id])).length, 0);
    }
    assert.equal((await row('SELECT count(*)::int n FROM candidate_profiles')).n, 2);
    assert.equal((await row('SELECT count(*)::int n FROM users')).n, 6);
    assert.equal((await row('SELECT count(*)::int n FROM media_files')).n, 2);
    assert.equal((await row("SELECT count(*)::int n FROM notifications WHERE type='casting_removed'")).n, 2);
    assert.equal((await row('SELECT status FROM casting_reports WHERE id=$1', [report.id])).status, 'removed');
    assert.equal((await row('SELECT casting_call_id FROM casting_reports WHERE id=$1', [report.id])).casting_call_id, null);
    assert.equal((await row("SELECT count(*)::int n FROM app_private.moderation_events WHERE action='casting_deleted'")).n, 1);
    assert.equal((await request(`/admin/castings/${castingId}`, 'DELETE', { reason: 'Again', confirmation: `OBRIŠI ${castingId}` })).status, 404);
    assert.equal(stored.size, 3, 'external objects have not been deleted before commit');
    const failed = await cleanupModerationFiles(pool, { remove: async () => { throw new Error('Storage offline'); } });
    assert.equal(failed.pending, 1); assert.equal(failed.failed, 1);
    const cleaned = await cleanupModerationFiles(pool, { remove: async key => { stored.delete(key); } });
    assert.equal(cleaned.removed, 1); assert.equal(cleaned.pending, 0);
    assert.equal(stored.has(orphanKey), false);
    assert.equal(stored.has(sharedKey), true); assert.equal(stored.has(profileKey), true);
    assert.equal((await cleanupModerationFiles(pool, { remove: async () => assert.fail('No duplicate job') })).removed, 0);
  });
  await t.test('statistics count latest verifications and active users, without personal data', async () => {
    await pool.query('UPDATE users SET deleted_at=now() WHERE id=$1', [otherEmployer.id]);
    actor = administrator;
    const response = await request('/admin/stats');
    assert.equal(response.status, 200);
    assert.equal(response.data.activeUsers, 5); assert.equal(response.data.disabledUsers, 1);
    assert.deepEqual(response.data.verifications, { approved: 1 });
    assert.equal(response.data.reports.removed, 1); assert.equal(response.data.reports.dismissed, 1);
    assert.equal(response.data.cleanupPending, 0);
    assert.equal(JSON.stringify(response.data).includes('@example.test'), false);
    assert.equal(JSON.stringify(response.data).includes('google:'), false);
  });
  await t.test('report endpoint limits repeated requests without trusting browser identity', async () => {
    actor = otherCandidate;
    let last;
    for (let index = 0; index < 21; index++)
      last = await request('/castings/0/reports', 'POST', { reason: 'Invalid casting' });
    assert.equal(last.status, 429);
  });

  await t.test('saving an employer profile while approving verification avoids a deadlock and checks the saved snapshot', async () => {
    await pool.query('UPDATE users SET deleted_at=NULL WHERE id=$1', [otherEmployer.id]);
    const pending = (await model.submit(otherEmployer.id)).verification;
    await model.reviewVerification(administrator.id, pending.id, 'under_review');
    let signalLocked;
    const profileLocked = new Promise(resolve => { signalLocked = resolve; });
    let continueProfile;
    const profileMayContinue = new Promise(resolve => { continueProfile = resolve; });
    const profilePool = { query: (...args) => pool.query(...args), connect: async () => {
      const c = await pool.connect();
      return { release: () => c.release(), query: async (sql, args) => {
        const result = await c.query(sql, args);
        if (sql.startsWith('SELECT id FROM users') && sql.includes('FOR UPDATE')) {
          signalLocked();
          await profileMayContinue;
        }
        return result;
      } };
    } };
    const profileWork = createProfileModel(profilePool).patch(otherEmployer, { phone: '+385 1 222222' });
    // Catch immediately so neither branch can produce an unhandled rejection.
    const profileResult = profileWork.then(value => ({ value }), error => ({ error }));
    await profileLocked;
    const applicationName = 'verification_race_' + randomUUID();
    const reviewingPool = new Pool({ connectionString: url.href, application_name: applicationName, statement_timeout: 5000 });
    const reviewResult = createModerationModel(reviewingPool)
      .reviewVerification(administrator.id, pending.id, 'approved')
      .then(value => ({ value }), error => ({ error }));
    try {
      let waiting = false;
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        waiting = (await row(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity
          WHERE application_name=$1 AND wait_event_type='Lock') AS waiting`, [applicationName])).waiting;
        if (waiting) break;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.ok(waiting, 'verification must overlap the profile transaction');
      continueProfile();
      const [profile, review] = await Promise.all([profileResult, reviewResult]);
      assert.equal(profile.error, undefined, profile.error?.message);
      assert.equal(review.error?.code, 'ORGANISATION_CHANGED', review.error?.message);
      assert.equal((await row('SELECT status FROM verification WHERE id=$1', [pending.id])).status, 'under_review');
      assert.equal((await row('SELECT phone FROM organisations WHERE id=$1', [otherOrg.id])).phone, '+385 1 222222');
    } finally {
      continueProfile();
      await Promise.all([profileResult, reviewResult]);
      await reviewingPool.end();
    }
  });

});
