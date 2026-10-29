
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





module.exports = {
  getCastingForApplication,
  canApplyToCasting,
  hasCandidateApplied,
  getApplicationCount,
  hasAvailableApplicationSlots,
  validateApplication
};

