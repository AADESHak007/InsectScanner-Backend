import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { validate } from '../middleware/validation.middleware';
import { registerSchema, loginSchema, socialLoginSchema } from '../schema.ts/auth.schema';

const router = Router();
const authService = new AuthService();

// Helper to get client IP
const getClientIp = (req: Request): string => {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

// Sign up route
router.post('/signup', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    const result = await authService.signUp(req.body, ip);
    
    res.status(201).json({
      message: 'User registered successfully',
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      error: error.message || 'Registration failed',
    });
  }
});

// Sign in route
router.post('/signin', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    const result = await authService.signIn(req.body, ip);
    
    res.status(200).json({
      message: 'Login successful',
      data: result,
    });
  } catch (error: any) {
    const statusCode = error.message.includes('not found') || error.message.includes('Invalid') ? 401 : 400;
    res.status(statusCode).json({
      error: error.message || 'Login failed',
    });
  }
});

// Social login route
router.post('/social/login', validate(socialLoginSchema), async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    const result = await authService.socialLogin(req.body, ip);
    
    res.status(200).json({
      message: 'Social login successful',
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      error: error.message || 'Social login failed',
    });
  }
});

export default router;