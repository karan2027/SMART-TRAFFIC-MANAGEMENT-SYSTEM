const mongoose = require('mongoose');
const app = require('./app');
const connectDB = require('./config/db');
const Road = require('./models/Road');
const Camera = require('./models/Camera');

const PORT = process.env.PORT || 5000;

const seedInitialData = async () => {
  try {
    const roadCount = await Road.countDocuments();
    if (roadCount === 0) {
      console.log('[SEED] Seeding initial Road: ROAD001...');
      await Road.create({
        roadId: 'ROAD001',
        name: 'Grand Trunk Express Avenue (Road-001)',
        description: 'Primary 4-lane arterial road fixed-camera monitor',
        lanes: 4,
        direction: 'Two-Way'
      });
    }

    const cameraCount = await Camera.countDocuments();
    if (cameraCount === 0) {
      console.log('[SEED] Seeding initial Camera: CAM001...');
      await Camera.create({
        cameraId: 'CAM001',
        name: 'Fixed CCTV Junction Cam 01',
        roadId: 'ROAD001',
        sourceType: 'recorded_video',
        sourcePath: 'data/videos/traffic_road_01.mp4',
        fps: 30
      });
    }
  } catch (err) {
    console.error(`[SEED ERROR] Failed to seed initial data: ${err.message}`);
  }
};

const startServer = async () => {
  const isConnected = await connectDB();
  if (isConnected && mongoose.connection.readyState === 1) {
    await seedInitialData();
  } else {
    console.warn('[DB WARNING] Database disconnected. Seed skipped. Install/Start MongoDB to enable data persistence.');
  }

  app.listen(PORT, () => {
    console.log(`===========================================================`);
    console.log(`[TRAFFIC MANAGEMENT STAGE 1 BACKEND SERVER STARTED]`);
    console.log(`Server URL: http://localhost:${PORT}`);
    console.log(`API Base  : http://localhost:${PORT}/api`);
    console.log(`===========================================================`);
  });
};

startServer();
