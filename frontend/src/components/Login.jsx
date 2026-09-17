import React, { useState, useEffect, useRef } from 'react';
import { Activity, Phone, Lock, ArrowRight, Globe, ChevronDown, MapPin, Check, User, Navigation, Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { API_BASE_URL, GOOGLE_CLIENT_ID } from '../config';
import { reverseGeocode, resolveLocationCoordinates } from '../utils/hospitals';

function LocationInputWithDropdown({
  label,
  placeholder,
  locationValue,
  setLocationValue,
  setCoords,
  onFetchGps,
  gpsLoading,
  gpsSuccess,
  gpsMsg
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  const wrapperRef = useRef(null);

  const LOCAL_PRESETS = [
    { name: 'Jabalpur', lat: 23.1681, lng: 79.9338, type: 'District' },
    { name: 'Bhopal', lat: 23.2599, lng: 77.4126, type: 'Capital' },
    { name: 'Indore', lat: 22.7196, lng: 75.8577, type: 'City' },
    { name: 'Pune', lat: 18.5204, lng: 73.8567, type: 'City' },
    { name: 'Mumbai', lat: 19.0760, lng: 72.8777, type: 'Metro' },
    { name: 'Delhi', lat: 28.6139, lng: 77.2090, type: 'Metro' },
  ];

  const handleInputChange = (e) => {
    const val = e.target.value;
    setLocationValue(val);
    setShowDropdown(true);

    if (!val.trim()) {
      setSuggestions(LOCAL_PRESETS);
      setIsSearching(false);
      return;
    }

    const filteredLocal = LOCAL_PRESETS.filter(item =>
      item.name.toLowerCase().includes(val.toLowerCase())
    );
    setSuggestions(filteredLocal);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (val.trim().length >= 2) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=5&addressdetails=1`, {
            headers: { 'Accept-Language': 'en', 'User-Agent': 'ASHA-Mitra-Triage-Companion-Agent' }
          });
          if (res.ok) {
            const data = await res.json();
            const apiResults = data.map(item => {
              const addr = item.address || {};
              const name = addr.village || addr.town || addr.suburb || addr.city_district || addr.city || item.display_name.split(',')[0];
              return {
                name: `${name} (${addr.state_district || addr.state || 'India'})`,
                displayName: item.display_name,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                type: item.type || 'Location'
              };
            });
            setSuggestions(prev => {
              const combined = [...filteredLocal];
              apiResults.forEach(apiItem => {
                if (!combined.some(c => c.name.toLowerCase() === apiItem.name.toLowerCase())) {
                  combined.push(apiItem);
                }
              });
              return combined;
            });
          }
        } catch (err) {
          console.warn('Location suggestion fetch error:', err);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    }
  };

  const handleSelectSuggestion = (item) => {
    setLocationValue(item.name);
    setCoords({ latitude: item.lat, longitude: item.lng });
    setShowDropdown(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-1">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={locationValue}
            onChange={handleInputChange}
            onFocus={() => {
              if (suggestions.length === 0) setSuggestions(LOCAL_PRESETS);
              setShowDropdown(true);
            }}
            className="w-full min-h-[48px] pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:border-[#E07A5F] focus:outline-none transition-colors placeholder:text-slate-300 font-medium text-[#0A2540]"
            placeholder={placeholder || 'Type area, village or sector...'}
          />
        </div>
        <button
          type="button"
          onClick={onFetchGps}
          disabled={gpsLoading}
          className="px-3.5 py-2 min-h-[48px] rounded-xl bg-slate-100 hover:bg-[#0A2540] text-slate-700 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-colors border border-slate-200 shrink-0 cursor-pointer disabled:opacity-50"
          title="Auto-detect current location"
        >
          {gpsLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#E07A5F]" />
          ) : gpsSuccess ? (
            <Check className="w-4 h-4 text-emerald-500" />
          ) : (
            <Navigation className="w-4 h-4 text-[#E07A5F]" />
          )}
          <span>{gpsLoading ? 'Fetching...' : 'Fetch Location'}</span>
        </button>
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden py-1 max-h-56 overflow-y-auto">
          {isSearching && (
            <div className="px-4 py-2 text-xs text-slate-400 flex items-center gap-2 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E07A5F]" />
              Searching locations...
            </div>
          )}
          {suggestions.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectSuggestion(item)}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between border-b border-slate-100 last:border-none cursor-pointer"
            >
              <div className="flex items-center gap-2.5 overflow-hidden pr-2">
                <MapPin className="w-4 h-4 text-[#E07A5F] shrink-0" />
                <div className="truncate">
                  <span className="text-xs font-bold text-[#0A2540] block truncate">{item.name}</span>
                  {item.displayName && (
                    <span className="text-[10px] text-slate-400 block truncate">{item.displayName}</span>
                  )}
                </div>
              </div>
              <span className="text-[10px] uppercase font-bold text-slate-400 px-2 py-0.5 rounded-md bg-slate-100 shrink-0">
                {item.type || 'Area'}
              </span>
            </button>
          ))}
        </div>
      )}

      {gpsMsg && (
        <p className={`mt-1.5 text-[11px] font-medium flex items-center gap-1 ${gpsSuccess ? 'text-emerald-600' : 'text-amber-600'}`}>
          {gpsSuccess && <Check className="w-3 h-3" />}
          {gpsMsg}
        </p>
      )}
    </div>
  );
}

export default function Login({
  phone,
  setPhone,
  password,
  setPassword,
  loading,
  error,
  handleLogin,
  handleRegister,
  handleGoogleLoginSuccess
}) {
  const { language, setLanguage, t } = useLanguage();

  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('ASHA Worker');
  const [regLocation, setRegLocation] = useState('');
  const [regCoords, setRegCoords] = useState(null);
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [isGoogleCompleting, setIsGoogleCompleting] = useState(false);
  const [googleData, setGoogleData] = useState(null);
  const [googleCredential, setGoogleCredential] = useState('');
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(false);
  const [gpsMsg, setGpsMsg] = useState('');

  useEffect(() => {
    handleFetchLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFetchLocation = () => {
    if (!navigator.geolocation) {
      setGpsMsg('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    setGpsMsg('');
    setGpsSuccess(false);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setRegCoords({ latitude, longitude });

        const areaName = await reverseGeocode(latitude, longitude);
        if (areaName) {
          setRegLocation(areaName);
          setGpsMsg(`Located: ${areaName} (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`);
        } else {
          setRegLocation(`Sector (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`);
          setGpsMsg(`Coords captured: ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`);
        }
        setGpsSuccess(true);
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
        setGpsMsg('Unable to retrieve GPS location automatically. Please enter manually.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleGoogleCredentialResponse = async (response) => {
    setRegError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: response.credential })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google sign-in failed.');
      if (data.isNewUser) {
        setGoogleData(data.googleData);
        setRegName(data.googleData.name || '');
        setIsGoogleCompleting(true);
        setGoogleCredential(response.credential);
      } else {
        handleGoogleLoginSuccess(data.user, data.token);
      }
    } catch (err) {
      console.error('Google Auth error:', err);
      setRegError(err.message || 'Google Auth failed.');
    }
  };

  const handleGoogleRegSubmit = async (e) => {
    e.preventDefault();
    setRegError('');
    if (!regName || !regPhone) {
      setRegError('Please fill out all required fields.');
      return;
    }

    setGoogleSubmitting(true);
    try {
      const targetLoc = regLocation.trim() || 'District Sector';
      const coords = await resolveLocationCoordinates(targetLoc, regCoords);
      const response = await fetch(`${API_BASE_URL}/api/auth/google/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: googleCredential,
          name: regName,
          phone: regPhone,
          role: regRole || 'ASHA Worker',
          location: targetLoc,
          coordinates: coords
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed.');
      handleGoogleLoginSuccess(data.user, data.token);
    } catch (err) {
      console.error('Google Reg error:', err);
      setRegError(err.message || 'Registration failed.');
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleCancelGoogleCompletion = () => {
    setIsGoogleCompleting(false);
    setGoogleData(null);
    setGoogleCredential('');
    setRegError('');
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const initGoogle = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
        });
        if (!isGoogleCompleting && !isRegistering) {
          const container = document.getElementById('google-signin-btn');
          if (container) {
            window.google.accounts.id.renderButton(container, {
              theme: 'outline', size: 'large', width: '380', text: 'continue_with', shape: 'rectangular'
            });
          }
        }
      }
    };
    initGoogle();
    const interval = setInterval(() => { if (window.google) { initGoogle(); clearInterval(interval); } }, 500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRegistering, isGoogleCompleting]);

  const handleRegSubmit = async (e) => {
    e.preventDefault();
    setRegError('');

    const cleanName = regName.trim();
    const cleanPhone = regPhone.trim().replace(/[\s-]/g, '');
    const cleanPass = regPassword.trim();
    const cleanLoc = regLocation.trim();

    if (!cleanName || !cleanPhone || !cleanPass) {
      setRegError('Please fill out all required fields (Name, Phone, Password).');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setRegError('Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
      return;
    }
    if (cleanPass.length < 6) {
      setRegError('Password must be at least 6 characters long for account security.');
      return;
    }
    if (!cleanLoc) {
      setRegError('Please enter or fetch your active location/sector.');
      return;
    }

    setRegLoading(true);
    try {
      const coords = await resolveLocationCoordinates(cleanLoc, regCoords);
      await handleRegister({
        name: cleanName,
        phone: cleanPhone,
        password: cleanPass,
        role: regRole === 'Doctor' ? 'Doctor' : 'ASHA Worker',
        location: cleanLoc,
        coordinates: coords
      });
    } catch (err) {
      setRegError(err.message || 'Registration failed.');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-sans bg-[#FDFBF7]">
      <div className="lg:w-1/2 bg-[#0A2540] text-white relative overflow-hidden p-8 lg:p-16 flex flex-col justify-between min-h-[40vh] lg:min-h-screen">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-[#E07A5F]/20 blur-3xl pointer-events-none"></div>

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#0A2540] text-white flex items-center justify-center shadow-soft relative overflow-hidden border border-white/10">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
              <Activity className="w-6 h-6 text-[#E07A5F] relative z-10" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#E07A5F] rounded-full"></span>
            </div>
            <div className="leading-tight">
              <div className="font-heading font-extrabold text-2xl text-white">{t('app_title')}</div>
              <div className="text-[10px] tracking-[0.18em] uppercase text-[#E07A5F] font-bold">{t('subtitle')}</div>
            </div>
          </div>
        </div>

        <div className="relative max-w-md my-12 lg:my-0">
          <div className="text-xs tracking-[0.25em] uppercase text-[#E07A5F] font-bold mb-4">{t('for_india_frontline')}</div>
          <h2 className="font-heading text-4xl lg:text-5xl font-extrabold leading-tight">{t('speak_triage_save')}</h2>
          <p className="mt-6 text-white/70 text-lg leading-relaxed">{t('hero_desc')}</p>
          <div className="mt-8 flex items-center gap-3 text-sm text-white/60">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            <span>{t('production_server_online')}</span>
          </div>
        </div>

        <div className="relative text-xs text-white/40 tracking-wider">{t('copyright')}</div>
      </div>

      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-[#FDFBF7]">
        <div className="w-full max-w-md bg-white/80 backdrop-blur-md p-8 rounded-3xl border border-slate-100 shadow-xl">
          <div className="flex justify-end mb-6">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="appearance-none pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-200 bg-white font-medium text-[#0A2540] focus:outline-none focus:border-[#E07A5F] cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <option value="en">English · English</option>
                <option value="hi">हिन्दी · Hindi</option>
                <option value="mr">मराठी · Marathi</option>
                <option value="bn">বাংলা · Bengali</option>
                <option value="ta">தமிழ் · Tamil</option>
                <option value="te">తెలుగు · Telugu</option>
                <option value="gu">ગુજરાતી · Gujarati</option>
                <option value="kn">ಕನ್ನಡ · Kannada</option>
                <option value="ml">മലയാളം · Malayalam</option>
                <option value="pa">ਪੰਜਾਬੀ · Punjabi</option>
                <option value="or">ଓଡ଼ିଆ · Odia</option>
                <option value="ur">اردو · Urdu</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {isGoogleCompleting ? (
            <>
              <div className="mb-6">
                <div className="text-xs tracking-[0.2em] uppercase text-[#E07A5F] font-bold mb-2">{t('google_register_title')}</div>
                <div className="flex items-center gap-3 mb-4 p-3 bg-[#0A2540] text-white rounded-2xl border border-white/10 shadow-md">
                  {googleData?.picture && (
                    <img src={googleData.picture} alt="Google User" className="w-10 h-10 rounded-full border border-white/20" referrerPolicy="no-referrer" />
                  )}
                  <div className="overflow-hidden">
                    <div className="font-bold text-sm truncate">{googleData?.name}</div>
                    <div className="text-[10px] text-white/70 truncate">{googleData?.email}</div>
                  </div>
                </div>
                <p className="text-slate-600 text-xs">{t('google_register_desc')}</p>
              </div>

              {regError && (
                <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium">{regError}</div>
              )}

              <form className="space-y-4" onSubmit={handleGoogleRegSubmit}>
                <div>
                  <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-1">{t('full_name')}</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input type="text" required value={regName} onChange={(e) => setRegName(e.target.value)}
                      className="w-full min-h-[48px] pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:border-[#E07A5F] focus:outline-none transition-colors placeholder:text-slate-300 font-medium text-[#0A2540]"
                      placeholder={t('full_name_placeholder')} />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-1">{t('phone_number')}</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input type="tel" required value={regPhone} onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full min-h-[48px] pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:border-[#E07A5F] focus:outline-none transition-colors placeholder:text-slate-300 font-medium text-[#0A2540]"
                      placeholder="e.g. 9876543210" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-1">{t('select_role')}</label>
                  <select value={regRole} onChange={(e) => setRegRole(e.target.value)}
                    className="w-full min-h-[48px] px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-[#0A2540] focus:border-[#E07A5F] focus:outline-none cursor-pointer">
                    <option value="ASHA Worker">ASHA Worker (आशा कार्यकर्ता)</option>
                    <option value="Doctor">Doctor / Medical Officer (डॉक्टर)</option>
                  </select>
                </div>

                <LocationInputWithDropdown
                  label={`${t('location')} / Sector`}
                  placeholder="Type location, sector or village..."
                  locationValue={regLocation}
                  setLocationValue={setRegLocation}
                  setCoords={setRegCoords}
                  onFetchGps={handleFetchLocation}
                  gpsLoading={gpsLoading}
                  gpsSuccess={gpsSuccess}
                  gpsMsg={gpsMsg}
                />

                <button type="submit" disabled={googleSubmitting}
                  className="w-full min-h-[50px] mt-4 rounded-2xl bg-[#E07A5F] hover:bg-[#D46A4F] text-white font-bold text-sm shadow-soft flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60">
                  {googleSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>{t('complete_registration')}<ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <div className="mt-4 text-xs text-slate-500 text-center">
                <button onClick={handleCancelGoogleCompletion} className="text-[#E07A5F] font-semibold hover:underline bg-transparent border-none cursor-pointer">
                  {t('back_to_login')}
                </button>
              </div>
            </>
          ) : !isRegistering ? (
            <>
              <div className="mb-6">
                <div className="text-xs tracking-[0.2em] uppercase text-[#E07A5F] font-bold mb-2">{t('welcome')}</div>
                <h1 className="font-heading text-3xl font-extrabold text-[#0A2540]">{t('sign_in')}</h1>
                <p className="text-slate-600 mt-2 text-sm">{t('sign_in_desc')}</p>
              </div>

              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">{error}</div>
              )}

              <form className="space-y-5" onSubmit={handleLogin}>
                <div>
                  <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-2">{t('phone_number')}</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                      className="w-full min-h-[56px] pl-12 pr-4 rounded-xl border-2 border-slate-200 bg-white text-lg focus:border-[#0A2540] focus:outline-none transition-colors placeholder:text-slate-300 font-medium text-[#0A2540]"
                      placeholder="e.g. 9876543210" disabled={loading} />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-2">{t('password')}</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full min-h-[56px] pl-12 pr-4 rounded-xl border-2 border-slate-200 bg-white text-lg focus:border-[#0A2540] focus:outline-none transition-colors placeholder:text-slate-300 font-medium text-[#0A2540]"
                      placeholder="••••••••" disabled={loading} />
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full min-h-[56px] rounded-2xl bg-[#E07A5F] hover:bg-[#D46A4F] text-white font-bold text-lg shadow-soft flex items-center justify-center gap-3 transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 active:scale-[0.98]">
                  {loading ? (
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>{t('sign_in_btn')}<ArrowRight className="w-5 h-5" /></>
                  )}
                </button>
              </form>

              {GOOGLE_CLIENT_ID ? (
                <>
                  <div className="relative flex py-4 items-center">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{t('or')}</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>
                  <div className="w-full flex justify-center min-h-[46px]">
                    <div id="google-signin-btn" className="w-full max-w-[380px] shadow-sm hover:shadow transition-shadow rounded-md overflow-hidden"></div>
                  </div>
                </>
              ) : (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-amber-700 block uppercase tracking-wider">Google Login Deactivated</span>
                  <span className="text-[10px] text-amber-600 block mt-0.5">Set VITE_GOOGLE_CLIENT_ID to enable it.</span>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-slate-100 text-sm text-slate-600 text-center">
                {t('register_link').split('?')[0]}?{' '}
                <button onClick={() => { setRegError(''); setIsRegistering(true); }} className="text-[#E07A5F] font-bold hover:underline bg-transparent border-none cursor-pointer">
                  {t('register_title')}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6">
                <div className="text-xs tracking-[0.2em] uppercase text-[#E07A5F] font-bold mb-2">{t('register_title')}</div>
                <h1 className="font-heading text-2xl font-extrabold text-[#0A2540]">ASHA / ANM Registration</h1>
                <p className="text-slate-600 mt-1 text-sm">{t('register_desc')}</p>
              </div>

              {regError && (
                <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium">{regError}</div>
              )}

              <form className="space-y-4" onSubmit={handleRegSubmit}>
                <div>
                  <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-1">{t('full_name')}</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input type="text" required value={regName} onChange={(e) => setRegName(e.target.value)}
                      className="w-full min-h-[48px] pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:border-[#E07A5F] focus:outline-none transition-colors placeholder:text-slate-300 font-medium text-[#0A2540]"
                      placeholder={t('full_name_placeholder')} />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-1">{t('phone_number')}</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input type="tel" required value={regPhone} onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full min-h-[48px] pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:border-[#E07A5F] focus:outline-none transition-colors placeholder:text-slate-300 font-medium text-[#0A2540]"
                      placeholder="e.g. 9876543210" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-1">{t('password')}</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input type="password" required value={regPassword} onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full min-h-[48px] pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:border-[#E07A5F] focus:outline-none transition-colors placeholder:text-slate-300 font-medium text-[#0A2540]"
                      placeholder="••••••••" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-1">{t('select_role')}</label>
                  <select value={regRole} onChange={(e) => setRegRole(e.target.value)}
                    className="w-full min-h-[48px] px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-[#0A2540] focus:border-[#E07A5F] focus:outline-none cursor-pointer">
                    <option value="ASHA Worker">ASHA Worker (आशा कार्यकर्ता)</option>
                    <option value="Doctor">Doctor / Medical Officer (डॉक्टर)</option>
                  </select>
                </div>

                <LocationInputWithDropdown
                  label={`${t('location')} / Sector`}
                  placeholder="Type location, sector or village..."
                  locationValue={regLocation}
                  setLocationValue={setRegLocation}
                  setCoords={setRegCoords}
                  onFetchGps={handleFetchLocation}
                  gpsLoading={gpsLoading}
                  gpsSuccess={gpsSuccess}
                  gpsMsg={gpsMsg}
                />

                <button type="submit" disabled={regLoading}
                  className="w-full min-h-[50px] mt-4 rounded-2xl bg-[#E07A5F] hover:bg-[#D46A4F] text-white font-bold text-sm shadow-soft flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60">
                  {regLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>{t('register_btn')}<ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <div className="mt-4 text-xs text-slate-500 text-center">
                Already registered?{' '}
                <button onClick={() => { setRegError(''); setIsRegistering(false); }} className="text-[#E07A5F] font-semibold hover:underline bg-transparent border-none cursor-pointer">
                  {t('back_to_login')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
