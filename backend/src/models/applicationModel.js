
const pool = require('../config/db');

// Dohvaćanje casting oglasa
async function getCastingForApplication(castingId) {
  const result = await pool.query(
    `SELECT c.id, c.title, c.status, c.application_deadline,
            c.max_applications, c.positions_count,
            (SELECT COUNT(*)::int FROM applications a WHERE a.casting_call_id = c.id
              AND a.status IN ('ACCEPTED', 'SELECTED')) AS accepted_count
     FROM casting_calls c
     WHERE c.id = $1`,
    [castingId]
  );

  return result.rows[0] || null;
}

// Provjera statusa oglasa i roka prijave
function canApplyToCasting(casting) {
  if (!casting) {
    return {
      allowed: false,
      message: 'Casting oglas ne postoji.'
    };
  }

  if (casting.status !== 'published') {
    return {
      allowed: false,
      message: 'Casting oglas nije otvoren za prijave.'
    };
  }

  if (
    casting.application_deadline &&
    new Date(casting.application_deadline).getTime() <= Date.now()
  ) {
    return {
      allowed: false,
      message: 'Rok za prijavu je istekao.'
    };
  }

  if (casting.accepted_count >= casting.positions_count) {
    return { allowed: false, message: 'Sva mjesta na castingu su popunjena.' };
  }

  return {
    allowed: true,
    message: 'Prijava je dopuštena.'
  };
}

// Provjera postoji li već prijava kandidata
async function hasCandidateApplied(candidateId, castingId) {
  const result = await pool.query(
    `SELECT id
     FROM applications
     WHERE candidate_id = $1
       AND casting_call_id = $2
     LIMIT 1`,
    [candidateId, castingId]
  );

  return result.rows.length > 0;
}

// Brojanje prijava na casting
async function getApplicationCount(castingId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM applications
     WHERE casting_call_id = $1`,
    [castingId]
  );

  return result.rows[0].total;
}

// Provjera maksimalnog broja prijava
async function hasAvailableApplicationSlots(casting) {
  const applicationCount = await getApplicationCount(casting.id);

  return applicationCount < casting.max_applications;
}

// Objedinjene provjere prije prijave
async function validateApplication(candidateId, castingId) {
  const casting = await getCastingForApplication(castingId);
  const castingCheck = canApplyToCasting(casting);

  if (!castingCheck.allowed) {
    return castingCheck;
  }

  const alreadyApplied = await hasCandidateApplied(
    candidateId,
    castingId
  );

  if (alreadyApplied) {
    return {
      allowed: false,
      message: 'Već ste prijavljeni na ovaj casting.'
    };
  }

  const hasSlots = await hasAvailableApplicationSlots(casting);

  if (!hasSlots) {
    return {
      allowed: false,
      message: 'Dosegnut je maksimalan broj prijava.'
    };
  }

  return {
    allowed: true,
    message: 'Prijava je dopuštena.'
  };
}

// Dohvaćanje profila prijavljenog kandidata
async function getCandidateProfileByUserId(userId) {
  const result = await pool.query(
    `SELECT id
     FROM candidate_profiles
     WHERE user_id = $1`,
    [userId]
  );

  return result.rows[0] || null;
}

// Sigurno spremanje prijave unutar PostgreSQL transakcije
async function createApplicationTransaction(
  candidateId,
  castingId,
  coverLetter,
  videoUrl,
  databasePool = pool
) {
  const client = await databasePool.connect();

  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');

    // Zaključavamo casting kako bi se prijave obrađivale redom.
    const castingResult = await client.query(
      `SELECT id, status, application_deadline, max_applications, positions_count
       FROM casting_calls
       WHERE id = $1
       FOR UPDATE`,
      [castingId]
    );

    const casting = castingResult.rows[0] || null;
    const castingCheck = canApplyToCasting(casting);

    if (!castingCheck.allowed) {
      await client.query('ROLLBACK');
      return castingCheck;
    }

    // Provjera je li kandidat već prijavljen
    const duplicateResult = await client.query(
      `SELECT id
       FROM applications
       WHERE candidate_id = $1
         AND casting_call_id = $2`,
      [candidateId, castingId]
    );

    if (duplicateResult.rows.length > 0) {
      await client.query('ROLLBACK');

      return {
        allowed: false,
        message: 'Već ste prijavljeni na ovaj casting.'
      };
    }

    // Zaseban upit NAKON zaključavanja vidi i upravo potvrđeni konačni odabir.
    // Konačni odabir i predaja koriste isti redak oglasa za serijalizaciju.
    const countResult = await client.query(
      `SELECT COUNT(*)::int AS total,
              (COUNT(*) FILTER (WHERE status IN ('ACCEPTED', 'SELECTED')))::int AS accepted_count
       FROM applications
       WHERE casting_call_id = $1`,
      [castingId]
    );

    if (countResult.rows[0].accepted_count >= casting.positions_count) {
      await client.query('ROLLBACK');
      return { allowed: false, message: 'Sva mjesta na castingu su popunjena.' };
    }

    if (countResult.rows[0].total >= casting.max_applications) {
      await client.query('ROLLBACK');

      return {
        allowed: false,
        message: 'Dosegnut je maksimalan broj prijava.'
      };
    }

    // Spremanje nove prijave
    const result = await client.query(
      `INSERT INTO applications
         (candidate_id, casting_call_id, cover_letter, video_url, status)
       VALUES ($1, $2, $3, $4, 'SUBMITTED')
       RETURNING id, candidate_id, casting_call_id, status, submitted_at`,
      [
        candidateId,
        castingId,
        coverLetter ?? null,
        videoUrl ?? null
      ]
    );

    await client.query('COMMIT');

    return {
      allowed: true,
      application: result.rows[0]
    };

  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(
        'Greška pri poništavanju transakcije:',
        rollbackError
      );
    }

    // PostgreSQL greška za dvostruku prijavu
    if (
      error.code === '23505' &&
      error.constraint === 'application_unique'
    ) {
      return {
        allowed: false,
        message: 'Već ste prijavljeni na ovaj casting.'
      };
    }

    throw error;

  } finally {
    client.release();
  }
}

module.exports = {
  getCastingForApplication,
  canApplyToCasting,
  hasCandidateApplied,
  getApplicationCount,
  hasAvailableApplicationSlots,
  validateApplication,
  getCandidateProfileByUserId,
  createApplicationTransaction
};
