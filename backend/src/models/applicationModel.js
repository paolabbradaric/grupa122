
const pool = require('../config/db');

async function getCastingForApplication(castingId) {
  const result = await pool.query(
    
    `SELECT id, title, status, application_deadline,
            max_applications
    FROM casting_calls
    WHERE id = $1`,

    [castingId]
  );

  return result.rows[0] || null;
}


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
    new Date(casting.application_deadline) < new Date()
  ) {
    return {
      allowed: false,
      message: 'Rok za prijavu je istekao.'
    };
  }

  return {
    allowed: true,
    message: 'Prijava je dopuštena.'
  };
}


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


async function getApplicationCount(castingId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM applications
     WHERE casting_call_id = $1`,
    [castingId]
  );

  return result.rows[0].total;
}


async function hasAvailableApplicationSlots(casting) {
  const applicationCount = await getApplicationCount(casting.id);

  return applicationCount < casting.max_applications;
}


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



async function getCandidateProfileByUserId(userId) {
  const result = await pool.query(
    `SELECT id
     FROM candidate_profiles
     WHERE user_id = $1`,
    [userId]
  );

  return result.rows[0] || null;
}


async function insertApplication(candidateId, castingId, coverLetter, videoUrl) {
  const result = await pool.query(
    `INSERT INTO applications
       (candidate_id, casting_call_id, cover_letter, video_url, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, candidate_id, casting_call_id, status, submitted_at`,
    [candidateId, castingId, coverLetter || null, videoUrl || null, 'SUBMITTED']
  );

  return result.rows[0];
}


async function createApplicationTransaction(candidateId, castingId, coverLetter, videoUrl) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Zaključavamo oglas dok obrađujemo prijavu.
    const castingResult = await client.query(
      `SELECT id, status, application_deadline, max_applications
       FROM casting_calls
       WHERE id = $1
       FOR UPDATE`,
      [castingId]
    );

    const casting = castingResult.rows[0] || null;
    const check = canApplyToCasting(casting);

    if (!check.allowed) {
      await client.query('ROLLBACK');
      return check;
    }

    const duplicateResult = await client.query(
      `SELECT id FROM applications
       WHERE candidate_id = $1 AND casting_call_id = $2`,
      [candidateId, castingId]
    );

    if (duplicateResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return {
        allowed: false,
        message: 'Već ste prijavljeni na ovaj casting.'
      };
    }

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM applications
       WHERE casting_call_id = $1`,
      [castingId]
    );

    if (countResult.rows[0].total >= casting.max_applications) {
      await client.query('ROLLBACK');
      return {
        allowed: false,
        message: 'Dosegnut je maksimalan broj prijava.'
      };
    }

    const result = await client.query(
      `INSERT INTO applications
         (candidate_id, casting_call_id, cover_letter, video_url, status)
       VALUES ($1, $2, $3, $4, 'SUBMITTED')
       RETURNING id, candidate_id, casting_call_id, status, submitted_at`,
      [candidateId, castingId, coverLetter || null, videoUrl || null]
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
    console.error('Greška pri poništavanju transakcije:', rollbackError);
  }

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
  insertApplication,
  createApplicationTransaction
};


