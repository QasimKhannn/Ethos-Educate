const express = require('express');
const {
  updateUserPluginsController,
  resendVerificationController,
  getTermsStatusController,
  acceptTermsController,
  getOnboardingTourStatusController,
  completeOnboardingTourController,
  verifyEmailController,
  deleteUserController,
  getUserController,
} = require('~/server/controllers/UserController');
const {
  verifyEmailLimiter,
  configMiddleware,
  canDeleteAccount,
  requireJwtAuth,
} = require('~/server/middleware');

const settings = require('./settings');

const router = express.Router();

router.use('/settings', settings);
router.get('/', requireJwtAuth, getUserController);
router.get('/terms', requireJwtAuth, getTermsStatusController);
router.post('/terms/accept', requireJwtAuth, acceptTermsController);
router.get('/onboarding', requireJwtAuth, getOnboardingTourStatusController);
router.post('/onboarding/complete', requireJwtAuth, completeOnboardingTourController);
router.post('/plugins', requireJwtAuth, updateUserPluginsController);
router.delete('/delete', requireJwtAuth, canDeleteAccount, configMiddleware, deleteUserController);
router.post('/verify', verifyEmailController);
router.post('/verify/resend', verifyEmailLimiter, resendVerificationController);

module.exports = router;
