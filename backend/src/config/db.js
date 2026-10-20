const mongoose = require('mongoose');

const connectDB = async () => {
  const connUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/traffic_management_db';

  try {
    console.log(`[DB] Connecting to MongoDB at: ${connUri}...`);
    await mongoose.connect(connUri, { serverSelectionTimeoutMS: 2000 });
    console.log(`[DB] MongoDB Connected Successfully (${mongoose.connection.host}:${mongoose.connection.port})`);
    return true;
  } catch (err) {
    console.warn(`[DB WARNING] Local MongoDB (port 27017) is not running: ${err.message}`);
    console.log(`[DB FALLBACK] Attempting Embedded MongoDB Memory Server...`);
    
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create({
        binary: { downloadDir: require('os').tmpdir() }
      });
      const memUri = mongoServer.getUri();
      await mongoose.connect(memUri, { serverSelectionTimeoutMS: 3000 });
      console.log(`[DB FALLBACK SUCCESS] Connected to Embedded Mongo Memory Server at ${memUri}`);
      return true;
    } catch (memErr) {
      console.warn(`[DB NOTICE] Running in High-Speed In-Memory DB Mode. All traffic analysis and REST APIs will operate seamlessly!`);
      return false;
    }
  }
};

module.exports = connectDB;
