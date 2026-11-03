const { Passport } = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { AuthError } = require('./errors');

function googleIdentity(profile) {
  const claims = profile._json || {};
  const subject = claims.sub || profile.id;
  const email = profile.emails?.[0]?.value;
  const verified = claims.email_verified ?? claims.verified_email;
  if (typeof subject !== 'string' || !subject || subject.length > 248 ||
      typeof email !== 'string' || !email || email.length > 255 || verified !== true) {
    throw new AuthError(401, 'INVALID_GOOGLE_IDENTITY', 'Google račun nema potvrđen e-mail ili potrebne podatke.');
  }
  return {
    authId: `google:${subject}`,
    email: email.trim().toLowerCase(),
    firstName: profile.name?.givenName || '',
    lastName: profile.name?.familyName || '',
  };
}

function createPassport(config, users) {
  const passport = new Passport();
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id, done) => {
    users.findById(id).then(user => done(null, user || false), done);
  });
  if (config.googleClientId && config.googleClientSecret) {
    passport.use(new GoogleStrategy({
      clientID: config.googleClientId,
      clientSecret: config.googleClientSecret,
      callbackURL: config.callbackUrl,
      scope: ['openid', 'email', 'profile'],
      state: true,
      pkce: true,
    }, (_accessToken, _refreshToken, profile, done) => {
      try {
        done(null, googleIdentity(profile));
      } catch (error) {
        done(error);
      }
    }));
  }
  return passport;
}

module.exports = { createPassport, googleIdentity };
