const express = require('express');
const {
  createFileLimiters,
  configMiddleware,
  requireJwtAuth,
  uaParser,
  checkBan,
} = require('~/server/middleware');
const { sendErrorResponse } = require('~/server/utils/errorResponse');
const { createUploadErrorResponse } = require('~/server/utils/fileErrorResponse');
const { avatar: asstAvatarRouter } = require('~/server/routes/assistants/v1');
const { avatar: agentAvatarRouter } = require('~/server/routes/agents/v1');
const { createMulterInstance } = require('./multer');

const files = require('./files');
const images = require('./images');
const avatar = require('./avatar');
const speech = require('./speech');

const handleUploadError = (req, res, err) => {
  return sendErrorResponse(res, err, createUploadErrorResponse(req, err));
};

const createUploadMiddleware = (upload, fieldName) => (req, res, next) =>
  upload.single(fieldName)(req, res, (err) => {
    if (!err) {
      return next();
    }
    return handleUploadError(req, res, err);
  });

const initialize = async () => {
  const router = express.Router();
  router.use(requireJwtAuth);
  router.use(configMiddleware);
  router.use(checkBan);
  router.use(uaParser);

  const upload = await createMulterInstance();
  router.post('/speech/stt', createUploadMiddleware(upload, 'audio'));

  /* Important: speech route must be added before the upload limiters */
  router.use('/speech', speech);

  const { fileUploadIpLimiter, fileUploadUserLimiter } = createFileLimiters();

  /** Apply rate limiters to all POST routes (excluding /speech which is handled above) */
  router.use((req, res, next) => {
    if (req.method === 'POST' && !req.path.startsWith('/speech')) {
      return fileUploadIpLimiter(req, res, (err) => {
        if (err) {
          return next(err);
        }
        return fileUploadUserLimiter(req, res, next);
      });
    }
    next();
  });

  router.post('/', createUploadMiddleware(upload, 'file'));
  router.post('/images', createUploadMiddleware(upload, 'file'));
  router.post('/images/avatar', createUploadMiddleware(upload, 'file'));
  router.post('/images/agents/:agent_id/avatar', createUploadMiddleware(upload, 'file'));
  router.post('/images/assistants/:assistant_id/avatar', createUploadMiddleware(upload, 'file'));

  router.use('/', files);
  router.use('/images', images);
  router.use('/images/avatar', avatar);
  router.use('/images/agents', agentAvatarRouter);
  router.use('/images/assistants', asstAvatarRouter);
  return router;
};

module.exports = { initialize };
