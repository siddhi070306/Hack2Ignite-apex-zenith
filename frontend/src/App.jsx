import React, { useState, useEffect } from 'react';
import { LogOut, Activity, MapPin } from 'lucide-react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Patients from './components/Patients';
import AddPatient from './components/AddPatient';
import VoiceTriageModal from './components/VoiceTriageModal';
import HospitalsMap from './components/HospitalsMap';
import DoctorDashboard from './components/DoctorDashboard';
import History from './components/History';
import { registerDynamicVillage } from './utils/hospitals';
import { formatDateTime } from './utils/dateUtils';
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
  const [currentView, setCurrentView] = useState('dashboard');
  const [patients, setPatients] = useState(() => {
    const saved = localStorage.getItem('asha_patients');
    return saved ? JSON.parse(saved) : [];
  });
  const [triageHistory, setTriageHistory] = useState(() => {
    const saved = localStorage.getItem('asha_triage_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [isTriageModalOpen, setIsTriageModalOpen] = useState(false);
  const [triagePatient, setTriagePatient] = useState(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

  const [isLocationManual, setIsLocationManual] = useState(() => localStorage.getItem('asha_location_manual') === 'true');
  const [userCoords, setUserCoordsState] = useState(() => {
    const saved = localStorage.getItem('asha_user_coords');
    return saved ? JSON.parse(saved) : (user?.coordinates || null);
  });
  const [userLocationName, setUserLocationNameState] = useState(() => localStorage.getItem('asha_user_location') || user?.location || '');

  const updateLocation = (coords, name, manual = false) => {
    setUserCoordsState(coords);
    setUserLocationNameState(name);
    setIsLocationManual(manual);
    localStorage.setItem('asha_user_coords', JSON.stringify(coords));
    localStorage.setItem('asha_user_location', name);
    localStorage.setItem('asha_location_manual', String(manual));
    if (name && coords) registerDynamicVillage(name, coords.latitude, coords.longitude);
  };

  const resetToAutoGps = () => {
    setIsLocationManual(false);
    localStorage.setItem('asha_location_manual', 'false');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => updateLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }, userLocationName, false),
        () => {}
      );
    }
  };

  useEffect(() => {
    if (!user || userCoords) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => updateLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }, userLocationName || user.location, false),
        () => {}
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetch(`${API_BASE_URL}/api/patients`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPatients(data);
          localStorage.setItem('asha_patients', JSON.stringify(data));
        }
      })
      .catch(() => {
        // Backend unreachable — keep whatever is cached locally
      });

    fetch(`${API_BASE_URL}/api/triage`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTriageHistory(data);
          localStorage.setItem('asha_triage_history', JSON.stringify(data));
        }
      })
      .catch(() => {
        // Backend unreachable — keep whatever is cached locally
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleAddPatient = async (newPatientData, andStartTriage) => {
    const payload = { ...newPatientData, createdBy: user?.id };
    let savedPatient;
    try {
      const response = await fetch(`${API_BASE_URL}/api/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to add patient');
      savedPatient = data;
    } catch (err) {
      // Offline fallback — keep the record locally until the server is reachable again
      savedPatient = { id: 'local-' + Date.now(), ...payload };
    }

    setPatients(prev => {
      const updated = [savedPatient, ...prev];
      localStorage.setItem('asha_patients', JSON.stringify(updated));
      return updated;
    });

    showToast(`${savedPatient.name} added successfully!`);
    setCurrentView(andStartTriage ? 'patients' : 'dashboard');
    if (andStartTriage) handleStartTriage(savedPatient);
  };

  const handleStartTriage = (patientOrNull) => {
    setTriagePatient(patientOrNull);
    setIsTriageModalOpen(true);
  };

  const handleSaveTriage = async (triageData) => {
    let savedRecord;
    try {
      const response = await fetch(`${API_BASE_URL}/api/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(triageData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save triage record');
      savedRecord = data;
    } catch (err) {
      savedRecord = { id: 'local-' + Date.now(), createdAt: new Date().toISOString(), ...triageData };
    }

    setTriageHistory(prev => {
      const updated = [savedRecord, ...prev];
      localStorage.setItem('asha_triage_history', JSON.stringify(updated));
      return updated;
    });
    showToast('Triage record saved!');
  };

  const handleVerifyTriage = async (triageId, verificationPayload) => {
    let updatedRecord;
    try {
      const response = await fetch(`${API_BASE_URL}/api/triage/${triageId}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verificationPayload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to verify triage record');
      updatedRecord = data;
    } catch (err) {
      updatedRecord = null;
    }

    setTriageHistory(prev => {
      const updated = prev.map(item => {
        if (item.id !== triageId) return item;
        return updatedRecord || { ...item, doctorVerificationStatus: 'verified', verifiedAt: new Date().toISOString(), ...verificationPayload };
      });
      localStorage.setItem('asha_triage_history', JSON.stringify(updated));
      return updated;
    });
    showToast('Triage verification saved!');
  };

  const handleMarkFollowUpDone = async (triageId) => {
    try {
      await fetch(`${API_BASE_URL}/api/triage/${triageId}/followup`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpDone: true }),
      });
    } catch (err) {
      // Offline — still reflect it locally below; will simply not have synced server-side
    }

    setTriageHistory(prev => {
      const updated = prev.map(item => item.id === triageId ? { ...item, followUpDone: true } : item);
      localStorage.setItem('asha_triage_history', JSON.stringify(updated));
      return updated;
    });
    showToast('Follow-up marked as done!');
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const cacheUser = (userToCache) => {
    setUser(userToCache);
    setCurrentView('dashboard');
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
    setCurrentView('dashboard');
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
    <div className="min-h-screen bg-[#FDFBF7] text-[#0A2540]">
      {toast && (
        <div className="fixed top-4 right-4 bg-[#0A2540] text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}

      <header className="bg-white border-b border-slate-200/80 px-6 py-4 flex items-center justify-between">
        <button onClick={() => setCurrentView('dashboard')} className="flex items-center gap-2 font-heading font-extrabold text-lg">
          <Activity className="w-5 h-5 text-[#E07A5F]" />
          {t('app_title')}
        </button>
        <div className="flex items-center gap-3">
          {user.role !== 'Doctor' && (
            <button
              onClick={() => setCurrentView('history')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold transition-colors"
            >
              <span className="hidden sm:inline">{t('triage_history')}</span>
            </button>
          )}
          <button
            onClick={() => setCurrentView('hospitals')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold transition-colors"
          >
            <MapPin className="w-4 h-4" /> <span className="hidden sm:inline">{t('hospitals')}</span>
          </button>
          <span className="text-sm text-slate-500 hidden sm:inline">{user.name} · {user.role}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {currentView === 'dashboard' && (
          user.role === 'Doctor' ? (
            <DoctorDashboard user={user} patients={patients} triageHistory={triageHistory} onVerifyTriage={handleVerifyTriage} setSelectedHistoryItem={setSelectedHistoryItem} />
          ) : (
            <Dashboard user={user} patientsCount={patients.length} triageHistory={triageHistory} setCurrentView={setCurrentView} onStartTriage={handleStartTriage} setSelectedHistoryItem={setSelectedHistoryItem} onMarkFollowUpDone={handleMarkFollowUpDone} />
          )
        )}
        {currentView === 'patients' && (
          <Patients patients={patients} setCurrentView={setCurrentView} onStartTriage={handleStartTriage} />
        )}
        {currentView === 'add-patient' && (
          <AddPatient handleAddPatient={handleAddPatient} />
        )}
        {currentView === 'history' && (
          <History triageHistory={triageHistory} setSelectedHistoryItem={setSelectedHistoryItem} />
        )}
        {currentView === 'hospitals' && (
          <HospitalsMap
            userCoords={userCoords}
            userLocationName={userLocationName}
            setUserCoords={updateLocation}
            isLocationManual={isLocationManual}
            resetToAutoGps={resetToAutoGps}
            onBack={() => setCurrentView('dashboard')}
          />
        )}
      </main>

      {selectedHistoryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A2540]/60 backdrop-blur-sm" onClick={() => setSelectedHistoryItem(null)}>
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-[#0A2540] text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-heading font-extrabold text-lg">{selectedHistoryItem.patientName}</h3>
                <p className="text-xs text-white/70">{selectedHistoryItem.village} · {selectedHistoryItem.language}</p>
              </div>
              <button onClick={() => setSelectedHistoryItem(null)} className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white">
                <LogOut className="w-4 h-4 rotate-180" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-sm">
              <div className={`p-3 rounded-xl text-xs font-black uppercase tracking-wider inline-block ${(selectedHistoryItem.doctorUrgency || selectedHistoryItem.urgency) === 'Red' ? 'bg-red-100 text-red-800' : (selectedHistoryItem.doctorUrgency || selectedHistoryItem.urgency) === 'Yellow' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                {selectedHistoryItem.doctorUrgency || selectedHistoryItem.urgency} Urgency
              </div>
              {(() => {
                const priorVisits = triageHistory
                  .filter(t => t.id !== selectedHistoryItem.id && t.patientName?.toLowerCase() === selectedHistoryItem.patientName?.toLowerCase())
                  .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
                if (priorVisits.length === 0) return null;
                return (
                  <div className="bg-sky-50 border border-sky-200 p-3 rounded-xl space-y-1.5">
                    <span className="text-xs font-bold text-sky-800 uppercase block">Patient History ({priorVisits.length} prior visit{priorVisits.length !== 1 ? 's' : ''})</span>
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {priorVisits.map(v => (
                        <div key={v.id} className="flex items-center justify-between gap-2 text-xs bg-white/70 rounded-lg px-2 py-1">
                          <span className={`font-black uppercase text-[9px] px-1.5 py-0.5 rounded shrink-0 ${v.urgency === 'Red' ? 'bg-red-600 text-white' : v.urgency === 'Yellow' ? 'bg-amber-500 text-white' : 'bg-green-600 text-white'}`}>{v.urgency}</span>
                          <span className="text-slate-600 truncate flex-grow">{(v.symptoms || []).join(', ') || 'No symptoms recorded'}</span>
                          <span className="text-slate-400 shrink-0">{formatDateTime(v.createdAt || v.date)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Transcript</span>
                <p className="italic text-slate-800">"{selectedHistoryItem.transcript}"</p>
              </div>
              {selectedHistoryItem.translation && (
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase block mb-1">English Translation</span>
                  <p className="text-slate-700">"{selectedHistoryItem.translation}"</p>
                </div>
              )}
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Advice</span>
                <p className="text-slate-700">{selectedHistoryItem.advice}</p>
              </div>
              {selectedHistoryItem.doctorMessage && (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                  <span className="text-xs font-bold text-emerald-800 uppercase block mb-1">Doctor's Message</span>
                  <p className="text-emerald-900 font-semibold">"{selectedHistoryItem.doctorMessage}"</p>
                </div>
              )}
              {selectedHistoryItem.txHash && (
                <div className="text-xs text-slate-400 font-mono break-all border-t border-slate-100 pt-3">
                  Digital Safety ID: {selectedHistoryItem.dataHash?.substring(0, 24)}...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <VoiceTriageModal
        isOpen={isTriageModalOpen}
        onClose={() => setIsTriageModalOpen(false)}
        patient={triagePatient}
        onSaveTriage={handleSaveTriage}
        user={user}
        userCoords={userCoords}
        handleAddPatient={handleAddPatient}
      />
    </div>
  );
}

export default App;
