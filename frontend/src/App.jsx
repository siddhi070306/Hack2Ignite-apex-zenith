import React, { useState } from 'react';
import { LogOut } from 'lucide-react';
import Login from './components/Login';
import { useLanguage } from './context/LanguageContext';
import { API_BASE_URL } from './config';

function App() {
  const { t } = useLanguage();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('asha_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [registeredUsers, setRegisteredUsers] = useState(() => {
    const saved = localStorage.getItem('asha_registered_users');
    return saved ? JSON.parse(saved) : [];
  });
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const cacheUser = (userToCache) => {
    setUser(userToCache);
    localStorage.setItem('asha_user', JSON.stringify(userToCache));
    setRegisteredUsers(prev => {
      const filtered = prev.filter(u => u.phone !== userToCache.phone);
      const updated = [userToCache, ...filtered];
      localStorage.setItem('asha_registered_users', JSON.stringify(updated));
      return updated;
    });
  };

  const handleRegister = async (newUserData) => {
    setError(null);
    setLoading(true);

    const cleanPhone = newUserData.phone.trim().replace(/[\s-]/g, '');
    const cleanPass = newUserData.password.trim();
    const cleanedData = { ...newUserData, phone: cleanPhone, password: cleanPass };

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed');

      const registeredUser = { ...cleanedData, ...(data.user || {}), password: cleanPass };
      localStorage.setItem('token', data.token || ('offline-token-' + (registeredUser.id || Date.now())));
      cacheUser(registeredUser);
      showToast(data.message || 'Account registered successfully!');
    } catch (err) {
      if (err.message && (err.message.includes('different password') || err.message.includes('valid') || err.message.includes('required'))) {
        setError(err.message);
        setLoading(false);
        throw err;
      }

      // Backend unreachable — fall back to locally cached registration
      const existingLocalUser = registeredUsers.find(u => u.phone === cleanPhone);
      if (existingLocalUser) {
        if (!existingLocalUser.password || existingLocalUser.password === cleanPass) {
          localStorage.setItem('token', 'offline-token-' + (existingLocalUser.id || Date.now()));
          cacheUser({ ...existingLocalUser, password: cleanPass });
          showToast('Account already registered — logged in offline!');
          setLoading(false);
          return;
        }
        const errMsg = 'A user with this phone number is already registered with a different password.';
        setError(errMsg);
        setLoading(false);
        throw new Error(errMsg);
      }

      const newUser = { id: Date.now(), ...cleanedData };
      localStorage.setItem('token', 'offline-token-' + newUser.id);
      cacheUser(newUser);
      showToast('Account created offline — will sync once the server is reachable.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanPhone = phone.trim().replace(/[\s-]/g, '');
    const cleanPass = password.trim();

    if (!cleanPhone || !cleanPass) {
      setError('Please enter both phone number and password');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError('Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, password: cleanPass }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed. Please check your credentials.');

      localStorage.setItem('token', data.token);
      cacheUser({ ...data.user, password: cleanPass });
      showToast(`Welcome back, ${data.user.name}!`);
    } catch (err) {
      const foundUser = registeredUsers.find(u => u.phone === cleanPhone);
      if (foundUser) {
        if (foundUser.password && foundUser.password === cleanPass) {
          localStorage.setItem('token', 'offline-token-' + (foundUser.id || Date.now()));
          cacheUser(foundUser);
          showToast(`Welcome! Logged in offline as ${foundUser.name}`);
          setLoading(false);
          return;
        }
        setError('Incorrect password for this mobile number.');
        setLoading(false);
        return;
      }
      setError(err.message || 'This mobile number is not registered. Please register first.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLoginSuccess = (userData, token) => {
    localStorage.setItem('token', token);
    cacheUser(userData);
    showToast('Logged in successfully via Google!');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('asha_user');
  };

  if (!user) {
    return (
      <Login
        phone={phone}
        setPhone={setPhone}
        password={password}
        setPassword={setPassword}
        loading={loading}
        error={error}
        handleLogin={handleLogin}
        handleRegister={handleRegister}
        handleGoogleLoginSuccess={handleGoogleLoginSuccess}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center gap-4 text-[#0A2540]">
      {toast && (
        <div className="fixed top-4 right-4 bg-[#0A2540] text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
      <h1 className="text-2xl font-bold">{t('welcome')}, {user.name}</h1>
      <p className="text-slate-500 text-sm">{user.role} · {user.location}</p>
      <button
        onClick={handleLogout}
        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold transition-colors"
      >
        <LogOut className="w-4 h-4" /> Log out
      </button>
    </div>
  );
}

export default App;
