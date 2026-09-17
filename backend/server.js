require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/apex_zenith';

app.use(cors());
app.use(express.json());

let isMongoConnected = false;

// Connect to MongoDB, falling back to local JSON storage if unavailable
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 3000
}).then(() => {
  isMongoConnected = true;
  const maskedUri = MONGODB_URI.replace(/\/\/(.*):(.*)@/, '//***:***@');
  console.log('✅ Connected to MongoDB database:', maskedUri);
}).catch(() => {
  isMongoConnected = false;
  console.warn('⚠️ MongoDB connection not active, operating with local JSON storage fallback.');
});

// GET /api/health - Server & DB status check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    database: isMongoConnected ? 'MongoDB Connected' : 'JSON Local Storage Active'
  });
});

// Serve static frontend files in production if built
const frontendBuildPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.status(200).json({
      status: 'online',
      message: 'Apex Zenith API server is running. If you are looking for the frontend interface, please visit your deployed frontend URL.',
      endpoints: {
        health: '/api/health'
      }
    });
  });
}

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
