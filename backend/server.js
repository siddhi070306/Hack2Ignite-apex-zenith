require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'apex-zenith-secret-key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/apex_zenith';
const USERS_FILE = path.join(__dirname, 'users.json');

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

// JSON file fallback helpers for users
function getJsonUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading json users:', err);
  }
  return [];
}

function saveJsonUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving json users:', err);
  }
}

// Google OAuth token verification helper
async function verifyGoogleToken(idToken) {
  try {
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;

    const response = await fetch(verifyUrl);
    if (!response.ok) {
      const errText = await response.text();
      console.error('Google token verification HTTP error:', response.status, errText);
      return null;
    }

    const payload = await response.json();

    if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
      console.error('Google token verification failed: invalid issuer', payload.iss);
      return null;
    }

    if (GOOGLE_CLIENT_ID && payload.aud !== GOOGLE_CLIENT_ID) {
      console.error('Google token verification failed: audience mismatch');
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.error('Google token verification failed: token expired');
      return null;
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture
    };
  } catch (err) {
    console.error('Error during Google token verification:', err);
    return null;
  }
}

// POST /api/auth/google - authenticate with an existing Google-linked account
app.post('/api/auth/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'Google ID token is required.' });
    }

    const googleUser = await verifyGoogleToken(idToken);
    if (!googleUser) {
      return res.status(401).json({ error: 'Invalid Google authentication.' });
    }

    const { googleId, email, name, picture } = googleUser;

    if (isMongoConnected) {
      let user = await User.findOne({ $or: [{ googleId }, { email }] });

      if (user) {
        if (!user.googleId) {
          user.googleId = googleId;
          await user.save();
        }

        const token = jwt.sign(
          { id: user._id, phone: user.phone, role: user.role },
          SECRET_KEY,
          { expiresIn: '30d' }
        );

        const userObj = user.toObject();
        delete userObj.password;

        return res.json({
          message: 'Google login successful',
          token,
          user: { ...userObj, id: userObj._id }
        });
      }

      return res.json({ isNewUser: true, googleData: { googleId, email, name, picture } });
    }

    const users = getJsonUsers();
    let user = users.find(u => u.googleId === googleId || (u.email && u.email.toLowerCase() === email.toLowerCase()));

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        saveJsonUsers(users);
      }

      const token = jwt.sign(
        { id: user.id, phone: user.phone, role: user.role },
        SECRET_KEY,
        { expiresIn: '30d' }
      );

      const { password: _, ...userProfile } = user;
      return res.json({ message: 'Google login successful', token, user: userProfile });
    }

    return res.json({ isNewUser: true, googleData: { googleId, email, name, picture } });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(500).json({ error: 'Server Google authentication error' });
  }
});

// POST /api/auth/google/register - complete registration after a Google sign-in
app.post('/api/auth/google/register', async (req, res) => {
  try {
    const { idToken, name, phone, role, location, coordinates } = req.body;

    if (!idToken || !name || !phone || !location) {
      return res.status(400).json({ error: 'ID token, name, phone, and location are required.' });
    }

    const googleUser = await verifyGoogleToken(idToken);
    if (!googleUser) {
      return res.status(401).json({ error: 'Invalid Google authentication token.' });
    }

    const { googleId, email } = googleUser;
    const cleanPhone = phone.trim().replace(/[\s-]/g, '');

    if (isMongoConnected) {
      const existingGoogleUser = await User.findOne({ $or: [{ googleId }, { email }] });
      if (existingGoogleUser) {
        const token = jwt.sign(
          { id: existingGoogleUser._id, phone: existingGoogleUser.phone, role: existingGoogleUser.role },
          SECRET_KEY,
          { expiresIn: '30d' }
        );
        const userObj = existingGoogleUser.toObject();
        delete userObj.password;
        return res.status(200).json({
          message: 'Google account already registered. Logged in successfully!',
          token,
          user: { ...userObj, id: userObj._id }
        });
      }

      const existingPhoneUser = await User.findOne({ phone: cleanPhone });
      if (existingPhoneUser) {
        return res.status(409).json({ error: 'A user with this phone number is already registered.' });
      }

      const geoCoord = coordinates
        ? [coordinates.longitude || 80.3500, coordinates.latitude || 23.8000]
        : [80.3500, 23.8000];

      const newUser = new User({
        name: name.trim(),
        phone: cleanPhone,
        googleId,
        email,
        role: role || 'ASHA Worker',
        location,
        coordinates,
        geoLocation: { type: 'Point', coordinates: geoCoord }
      });

      await newUser.save();

      const token = jwt.sign(
        { id: newUser._id, phone: newUser.phone, role: newUser.role },
        SECRET_KEY,
        { expiresIn: '30d' }
      );

      const userObj = newUser.toObject();
      delete userObj.password;

      return res.status(201).json({ message: 'Google user registered', token, user: { ...userObj, id: userObj._id } });
    }

    const users = getJsonUsers();
    const existingGoogle = users.find(u => u.googleId === googleId || (u.email && u.email.toLowerCase() === email.toLowerCase()));
    if (existingGoogle) {
      const token = jwt.sign(
        { id: existingGoogle.id, phone: existingGoogle.phone, role: existingGoogle.role },
        SECRET_KEY,
        { expiresIn: '30d' }
      );
      const { password: _, ...userProfile } = existingGoogle;
      return res.status(200).json({
        message: 'Google account already registered. Logged in successfully!',
        token,
        user: userProfile
      });
    }

    if (users.find(u => u.phone === cleanPhone)) {
      return res.status(409).json({ error: 'A user with this phone number is already registered.' });
    }

    const newUser = {
      id: Date.now(),
      name: name.trim(),
      phone: cleanPhone,
      googleId,
      email,
      role: role || 'ASHA Worker',
      location,
      coordinates
    };

    users.push(newUser);
    saveJsonUsers(users);

    const token = jwt.sign(
      { id: newUser.id, phone: newUser.phone, role: newUser.role },
      SECRET_KEY,
      { expiresIn: '30d' }
    );

    return res.status(201).json({ message: 'Google user registered', token, user: newUser });
  } catch (error) {
    console.error('Google Registration Error:', error);
    res.status(500).json({ error: 'Server Google registration error' });
  }
});

// POST /api/auth/register - register with phone + password
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, phone, password, role, location, coordinates } = req.body;

    if (!name || !phone || !password || !location) {
      return res.status(400).json({ error: 'Name, phone, password, and location are required.' });
    }

    const cleanPhone = phone.trim().replace(/[\s-]/g, '');
    const cleanPass = password.trim();

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Please provide a valid 10-digit Indian phone number starting with 6, 7, 8, or 9.' });
    }

    if (cleanPass.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    if (isMongoConnected) {
      const existingUser = await User.findOne({ phone: cleanPhone });
      if (existingUser) {
        if (existingUser.password === cleanPass) {
          const token = jwt.sign(
            { id: existingUser._id, phone: existingUser.phone, role: existingUser.role },
            SECRET_KEY,
            { expiresIn: '30d' }
          );
          const userObj = existingUser.toObject();
          delete userObj.password;
          return res.status(200).json({
            message: 'Account already registered. Logged in successfully!',
            token,
            user: { ...userObj, id: userObj._id }
          });
        }
        return res.status(409).json({ error: 'A user with this phone number is already registered with a different password.' });
      }

      const geoCoord = coordinates
        ? [coordinates.longitude || 80.3500, coordinates.latitude || 23.8000]
        : [80.3500, 23.8000];

      const newUser = new User({
        name: name.trim(),
        phone: cleanPhone,
        password: cleanPass,
        role: role || 'ASHA Worker',
        location,
        coordinates,
        geoLocation: { type: 'Point', coordinates: geoCoord }
      });

      await newUser.save();

      const token = jwt.sign(
        { id: newUser._id, phone: newUser.phone, role: newUser.role },
        SECRET_KEY,
        { expiresIn: '30d' }
      );

      const userObj = newUser.toObject();
      delete userObj.password;

      return res.status(201).json({ message: 'User registered', token, user: { ...userObj, id: userObj._id } });
    }

    const users = getJsonUsers();
    const existingUser = users.find(u => u.phone === cleanPhone);
    if (existingUser) {
      if (existingUser.password === cleanPass) {
        const token = jwt.sign(
          { id: existingUser.id, phone: existingUser.phone, role: existingUser.role },
          SECRET_KEY,
          { expiresIn: '30d' }
        );
        const { password: _, ...userProfile } = existingUser;
        return res.status(200).json({
          message: 'Account already registered. Logged in successfully!',
          token,
          user: userProfile
        });
      }
      return res.status(409).json({ error: 'A user with this phone number is already registered with a different password.' });
    }

    const newUser = {
      id: Date.now(),
      name: name.trim(),
      phone: cleanPhone,
      password: cleanPass,
      role: role || 'ASHA Worker',
      location,
      coordinates
    };

    users.push(newUser);
    saveJsonUsers(users);

    const token = jwt.sign(
      { id: newUser.id, phone: newUser.phone, role: newUser.role },
      SECRET_KEY,
      { expiresIn: '30d' }
    );

    const { password: _, ...userProfile } = newUser;
    return res.status(201).json({ message: 'User registered', token, user: userProfile });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Server registration error' });
  }
});

// POST /api/auth/login - login with phone + password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone number and password are required.' });
    }

    const cleanPhone = phone.trim().replace(/[\s-]/g, '');
    const cleanPass = password.trim();

    if (isMongoConnected) {
      const userByPhone = await User.findOne({ phone: cleanPhone });
      if (!userByPhone) {
        return res.status(404).json({ error: 'This mobile number is not registered. Please register first.' });
      }

      if (userByPhone.password !== cleanPass) {
        return res.status(401).json({ error: 'Incorrect password. Please try again.' });
      }

      const token = jwt.sign(
        { id: userByPhone._id, phone: userByPhone.phone, role: userByPhone.role },
        SECRET_KEY,
        { expiresIn: '30d' }
      );

      const userObj = userByPhone.toObject();
      delete userObj.password;

      return res.json({ message: 'Login successful', token, user: { ...userObj, id: userObj._id } });
    }

    const users = getJsonUsers();
    const userByPhone = users.find(u => u.phone === cleanPhone);
    if (!userByPhone) {
      return res.status(404).json({ error: 'This mobile number is not registered. Please register first.' });
    }

    if (userByPhone.password !== cleanPass) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const token = jwt.sign(
      { id: userByPhone.id, phone: userByPhone.phone, role: userByPhone.role },
      SECRET_KEY,
      { expiresIn: '30d' }
    );

    const { password: _, ...userProfile } = userByPhone;
    return res.json({ message: 'Login successful', token, user: userProfile });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Server login error' });
  }
});

// GET /api/health - server & DB status check
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
        health: '/api/health',
        auth: '/api/auth/*'
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
