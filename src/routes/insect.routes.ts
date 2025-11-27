import { Router, Request, Response } from 'express';
import multer from 'multer';
import { InsectService } from '../services/insect.service';
import { optionalAuthenticate } from '../middleware/auth.middleware';
import { addInsectIdentificationJob, getJobStatus } from '../queues/insect.queue';

const router = Router();
const insectService = new InsectService();

// Configure multer for memory storage (to get buffer for Gemini)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * Identify insect from image (queued)
 * POST /api/mobile/insect/identify
 * Optional authentication - if session token provided, saves to user's history
 * Returns job ID immediately, use /status endpoint to check progress
 */
router.post(
  '/identify',
  optionalAuthenticate,
  upload.single('image'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'Image file is required',
        });
      }

      // Use authenticated user ID if available, otherwise use body userId or undefined
      const userId = req.user?.uid || req.body.userId || undefined;

      // Add job to queue
      const jobId = await addInsectIdentificationJob({
        imageBuffer: req.file.buffer,
        imageMimetype: req.file.mimetype,
        imageOriginalName: req.file.originalname,
        userId,
      });

      res.status(202).json({
        message: 'Identification job queued successfully',
        jobId: jobId,
        statusUrl: `/api/mobile/insect/status/${jobId}`,
      });
    } catch (error: any) {
      console.error('Queue error:', error);
      res.status(500).json({
        error: error.message || 'Failed to queue identification job',
      });
    }
  }
);

/**
 * Get job status
 * GET /api/mobile/insect/status/:jobId
 */
router.get('/status/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const status = await getJobStatus(jobId);

    if (!status) {
      return res.status(404).json({
        error: 'Job not found',
      });
    }

    res.status(200).json({
      message: 'Job status retrieved successfully',
      data: status,
    });
  } catch (error: any) {
    console.error('Status check error:', error);
    res.status(500).json({
      error: error.message || 'Failed to get job status',
    });
  }
});

/**
 * Get user's insect identification history
 * GET /api/mobile/insect/history
 * Requires authentication
 */
router.get(
  '/history',
  optionalAuthenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.uid;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required to view history',
        });
      }

      const result = await insectService.getUserHistory(userId);

      res.status(200).json({
        message: 'History retrieved successfully',
        data: result,
      });
    } catch (error: any) {
      console.error('History retrieval error:', error);
      res.status(500).json({
        error: error.message || 'Failed to retrieve history',
      });
    }
  }
);

export default router;

