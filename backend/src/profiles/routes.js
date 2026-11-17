const express = require("express");
const multer = require("multer");
const { requireRole, protectMutation } = require("../auth/middleware");
const { AuthError } = require("../auth/errors");
const { createProfileModel } = require("./model");
const { createStorage } = require("./storage");
const { createMediaService } = require("./media");
function createProfileRouter({
  config,
  pool,
  storage = createStorage(),
  model = createProfileModel(pool),
  maxBytes = Number(process.env.PROFILE_IMAGE_MAX_BYTES || 5242880),
}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 20971520)
    throw new Error("PROFILE_IMAGE_MAX_BYTES mora biti između 1 i 20971520.");
  const router = express.Router(),
    service = createMediaService(pool, storage, model);
  const parser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 5, fields: 0, parts: 5 },
  });
  router.use(["/profiles", "/profile-media"], (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(
    ["/profiles", "/profile-media"],
    requireRole("candidate", "employer"),
  );
  router.get("/profiles/me", async (req, res) =>
    res.json(await model.read(req.user)),
  );
  router.patch("/profiles/me", protectMutation(config), async (req, res) =>
    res.json(await model.patch(req.user, req.body)),
  );
  for (const purpose of ["avatar", "portfolio", "logo"]) {
    const path = `/profiles/me/${purpose}`;
    const role = purpose === "logo" ? "employer" : "candidate";
    router[purpose === "portfolio" ? "post" : "put"](
      path,
      requireRole(role),
      protectMutation(config),
      parser.array(
        purpose === "portfolio" ? "files" : "file",
        purpose === "portfolio" ? 5 : 1,
      ),
      async (req, res) => {
        res.json(await service.upload(req.user, purpose, req.files));
      },
    );
    router.delete(
      path + (purpose === "portfolio" ? "/:mediaId" : ""),
      requireRole(role),
      protectMutation(config),
      async (req, res) => {
        await model.changeMedia(req.user, purpose, null, req.params.mediaId);
        res.json(await model.read(req.user));
      },
    );
  }
  router.get("/profile-media/:mediaId/content", async (req, res) => {
    const media = await model.content(req.user, req.params.mediaId);
    const buffer = await storage.get(media.storage_key);
    res
      .set({
        "Content-Type": media.mime_type,
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      })
      .send(buffer);
  });
  router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError)
      return next(
        new AuthError(
          error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
          "INVALID_UPLOAD",
          error.code === "LIMIT_FILE_SIZE"
            ? "Slika je prevelika."
            : "Neispravan broj ili naziv polja za upload.",
        ),
      );
    next(error);
  });
  return router;
}
module.exports = { createProfileRouter };
