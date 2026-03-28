import { Router } from 'express';
import { authLimiter, mfaLimiter } from '../../middleware/rateLimiter';
import { verifyToken } from '../../middleware/verifyToken';
import { verifyStageToken } from '../../middleware/verifyStageToken';
import { checkIsActive } from '../../middleware/checkIsActive';
import * as authController from './auth.controller';

const router = Router();

// Public routes
router.post('/login', authLimiter, authController.login);

// MFA setup routes (requires setupToken)
router.get('/mfa/setup', mfaLimiter, verifyStageToken('setup'), authController.setupMfa);
router.post('/mfa/setup/verify', mfaLimiter, verifyStageToken('setup'), authController.verifyMfaSetup);

// MFA verify route (requires mfaToken)
router.post('/mfa/verify', mfaLimiter, verifyStageToken('mfa'), authController.verifyMfa);

// Refresh token route (no verifyToken — uses refresh_token cookie)
router.post('/refresh', authController.refresh);

// Protected routes
router.get('/me', verifyToken, checkIsActive, authController.getMe);
router.post('/logout', verifyToken, authController.logout);

export default router;
