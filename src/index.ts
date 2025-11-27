import 'dotenv/config'; // Load environment variables first
import './config/firebase.config'; // Initialize Firebase
import './config/redis.config'; // Initialize Redis connection
import express from 'express';
import cors from 'cors';
import { Request, Response, NextFunction } from 'express';
import authRoutes from './routes/auth.routes';
import insectRoutes from './routes/insect.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Insect Scanner Backend API', status: 'running' });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Auth routes
app.use('/api/mobile/auth', authRoutes);

// Insect routes
app.use('/api/mobile/insect', insectRoutes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});