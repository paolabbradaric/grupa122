const pool = require("../src/config/db");
const { createStorage } = require("../src/profiles/storage");
const { createMediaService } = require("../src/profiles/media");
createMediaService(pool, createStorage())
  .cleanup()
  .then((result) => {
    console.log(result);
    if (result.pending) process.exitCode = 1;
  })
  .catch((e) => {
    console.error(e.code || "CLEANUP_FAILED");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
