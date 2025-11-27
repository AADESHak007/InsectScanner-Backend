import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
      };
    }
  }
}

/**
 * Middleware to verify session token and attach user info to request
 */
export const authenticateSession = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get session token from Authorization header or query parameter
    const sessionToken =
      req.headers.authorization?.replace('Bearer ', '') ||
      req.query.session_token as string ||
      req.body.session_token;

    if (!sessionToken) {
      return res.status(401).json({
        error: 'Session token is required',
      });
    }

    // Verify session cookie
    const decodedClaims = await admin.auth().verifySessionCookie(sessionToken, true);

    // Attach user info to request
    req.user = {
      uid: decodedClaims.uid,
      email: decodedClaims.email,
    };

    next();
  } catch (error: any) {
    console.error('Session verification error:', error);
    return res.status(401).json({
      error: 'Invalid or expired session token',
    });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get session token from Authorization header or query parameter
    const sessionToken =
      req.headers.authorization?.replace('Bearer ', '') ||
      req.query.session_token as string ||
      req.body.session_token;

    if (sessionToken) {
      // Verify session cookie
      const decodedClaims = await admin.auth().verifySessionCookie(sessionToken, true);

      // Attach user info to request
      req.user = {
        uid: decodedClaims.uid,
        email: decodedClaims.email,
      };
    }

    next();
  } catch (error: any) {
    // If verification fails, continue without user (optional auth)
    console.error('Optional session verification error:', error);
    next();
  }
};

