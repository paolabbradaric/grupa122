// Ovaj posao pokrenuti nakon DB COMMIT-a; storage greška ne poništava brisanje oglasa.
async function cleanupModerationFiles(pool, storage, limit = 100) {
  let removed = 0;
  let failed = 0;
  for (let index = 0; index < limit; index++) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const { rows: [job] } = await c.query(`SELECT storage_key FROM app_private.moderation_file_cleanup
        ORDER BY attempts,created_at,storage_key LIMIT 1 FOR UPDATE SKIP LOCKED`);
      if (!job) { await c.query('COMMIT'); break; }
      const linked = await c.query('SELECT 1 FROM media_files WHERE storage_key=$1 LIMIT 1', [job.storage_key]);
      if (linked.rowCount) {
        // Nikada ne briši objekt koji još ima metapodatke/reference.
        await c.query('UPDATE app_private.moderation_file_cleanup SET attempts=attempts+1 WHERE storage_key=$1', [job.storage_key]);
        failed++;
      } else {
        try {
          await storage.remove(job.storage_key);
          await c.query('DELETE FROM app_private.moderation_file_cleanup WHERE storage_key=$1', [job.storage_key]);
          await c.query('DELETE FROM profile_storage_objects WHERE storage_key=$1', [job.storage_key]);
          removed++;
        } catch {
          await c.query('UPDATE app_private.moderation_file_cleanup SET attempts=attempts+1 WHERE storage_key=$1', [job.storage_key]);
          failed++;
        }
      }
      await c.query('COMMIT');
      // Ne vrti isti neuspješni posao u petlji tijekom jednog pokretanja.
      if (failed) break;
    } catch (error) {
      try { await c.query('ROLLBACK'); } catch { /* Sačuvaj izvornu grešku. */ }
      throw error;
    } finally { c.release(); }
  }
  const { rows: [counts] } = await pool.query('SELECT count(*)::int AS pending FROM app_private.moderation_file_cleanup');
  return { removed, failed, pending: counts.pending };
}
module.exports = { cleanupModerationFiles };
