const { createClient } = require("@supabase/supabase-js");
const { AuthError } = require("../auth/errors");
const unavailable = () =>
  new AuthError(
    503,
    "STORAGE_UNAVAILABLE",
    "Pohrana slika trenutačno nije dostupna. Tekst profila možeš spremiti zasebno.",
  );
function createStorage(env = process.env) {
  let client;
  const bucket = env.PROFILE_STORAGE_BUCKET;
  async function ready() {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !bucket)
      throw unavailable();
    client ||= createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.storage.getBucket(bucket);
    if (error || !data || data.public !== false) throw unavailable();
    return client.storage.from(bucket);
  }
  async function run(action) {
    try {
      const result = await action(await ready());
      if (result.error) throw unavailable();
      return result.data;
    } catch {
      throw unavailable();
    }
  }
  return {
    put: (key, buffer, type) =>
      run((b) => b.upload(key, buffer, { contentType: type, upsert: false })),
    remove: (key) => run((b) => b.remove([key])),
    async get(key) {
      const blob = await run((b) => b.download(key));
      return Buffer.from(await blob.arrayBuffer());
    },
  };
}
module.exports = { createStorage, unavailable };
