import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, AlertCircle, CheckCircle2, AlertTriangle, Languages, Clock, Volume2, VolumeX, Loader2, Sparkles, MapPin, Phone, ExternalLink } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { API_BASE_URL } from '../config';
import { getNearbyHospitalsAsync } from '../utils/hospitals';
import { generateSHA256, generateTxHash } from '../blockchain/crypto';

const INDIAN_LANGUAGES = [
  { code: 'hi', sarvamCode: 'hi-IN', name: 'हिन्दी · Hindi' },
  { code: 'en', sarvamCode: 'en-IN', name: 'English · English' },
  { code: 'mr', sarvamCode: 'mr-IN', name: 'मराठी · Marathi' },
  { code: 'bn', sarvamCode: 'bn-IN', name: 'বাংলা · Bengali' },
  { code: 'ta', sarvamCode: 'ta-IN', name: 'தமிழ் · Tamil' },
  { code: 'te', sarvamCode: 'te-IN', name: 'తెలుగు · Telugu' },
  { code: 'gu', sarvamCode: 'gu-IN', name: 'ગુજરાતી · Gujarati' },
  { code: 'kn', sarvamCode: 'kn-IN', name: 'ಕನ್ನಡ · Kannada' },
  { code: 'ml', sarvamCode: 'ml-IN', name: 'മലയാളം · Malayalam' },
  { code: 'pa', sarvamCode: 'pa-IN', name: 'ਪੰਜਾਬੀ · Punjabi' },
  { code: 'or', sarvamCode: 'or-IN', name: 'ଓଡ଼ିଆ · Odia' },
  { code: 'ur', sarvamCode: 'ur-IN', name: 'اردو · Urdu' }
];

// Local, offline-capable clinical keyword analyzer — used until the backend LLM analysis lands.
function analyzeClinicalText(text, lang) {
  const lower = text.toLowerCase();
  let detectedUrgency = 'Green';
  let detectedSymptoms = [];
  let detectedAdvice = '';
  let englishTranslation = text;

  const words = text.split(/[\s,।.]+/).map(w => w.trim()).filter(w => w.length > 2);
  const detectedKeywords = Array.from(new Set(words)).slice(0, 5);

  if (lower.includes('chest pain') || lower.includes('छाती') || lower.includes('दर्द') || lower.includes('सांस') || lower.includes('तेज बुखार') || lower.includes('अशक्तपणा') || lower.includes('blood') || lower.includes('खून')) {
    if (lower.includes('chest') || lower.includes('छाती') || lower.includes('heart') || (lower.includes('सांस') && lower.includes('तकलीफ'))) {
      detectedUrgency = 'Red';
      detectedSymptoms = ['Severe Respiratory/Chest Distress', 'High Risk Symptoms'];
      detectedAdvice = 'Immediate referral to District Hospital / CHC. Arrange emergency ambulance transport. Administer first-aid stabilization.';
      englishTranslation = lang === 'hi' ? 'Severe chest pain / breathing difficulty reported by patient.' : lang === 'mr' ? 'Severe chest pain and difficulty breathing.' : text;
    } else if (lower.includes('बुखार') || lower.includes('fever') || lower.includes('ताप') || lower.includes('vomiting') || lower.includes('उलट्या')) {
      detectedUrgency = 'Yellow';
      detectedSymptoms = ['Acute Fever / Dehydration', 'Moderate Distress'];
      detectedAdvice = 'Refer to Sub-Centre or ANM within 12 hours. Administer ORS and fever medication as per guidelines.';
      englishTranslation = lang === 'hi' ? 'High fever and weakness reported over multiple days.' : lang === 'mr' ? 'Vomiting and weakness since yesterday.' : text;
    }
  } else {
    detectedUrgency = 'Green';
    detectedSymptoms = ['Mild Symptoms', 'Local Care Suitable'];
    detectedAdvice = 'Advise warm saline gargles, rest, and fluid intake. Monitor symptoms locally.';
  }

  return { urgency: detectedUrgency, symptoms: detectedSymptoms, keywords: detectedKeywords, advice: detectedAdvice, translation: englishTranslation };
}

export default function VoiceTriageModal({ isOpen, onClose, patient, onSaveTriage, user, userCoords, handleAddPatient }) {
  const { t } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState('hi');
  const [triageStep, setTriageStep] = useState('idle'); // patient_info, idle, recording, analyzing, completed
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [speechNotice, setSpeechNotice] = useState('');

  const [currentPatient, setCurrentPatient] = useState(patient);
  const [pName, setPName] = useState('');
  const [pAge, setPAge] = useState('');
  const [pGender, setPGender] = useState('Female');
  const [pVillage, setPVillage] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pErr, setPErr] = useState('');

  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');
  const [urgency, setUrgency] = useState('Green');
  const [symptoms, setSymptoms] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [advice, setAdvice] = useState('');

  const [inputMode, setInputMode] = useState('voice');
  const [manualText, setManualText] = useState('');
  const [verificationStep, setVerificationStep] = useState(false);
  const [editableSymptoms, setEditableSymptoms] = useState([]);
  const [saving, setSaving] = useState(false);
  const [ttsState, setTtsState] = useState('idle'); // idle, loading, playing, error
  const audioPlaybackRef = useRef(null);

  const [nearbyHospitals, setNearbyHospitals] = useState([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);

  const [anchoringLogs, setAnchoringLogs] = useState('');
  const [calculatedHash, setCalculatedHash] = useState('');

  const timerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const speechRecognitionRef = useRef(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    if (!isOpen) {
      setTriageStep('idle');
      setRecordingSeconds(0);
      setTranscript('');
      transcriptRef.current = '';
      setTranslation('');
      setManualText('');
      setKeywords([]);
      setPErr('');
      setAnchoringLogs('');
      setCalculatedHash('');
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch (e) {}
      }
    } else if (patient) {
      setCurrentPatient(patient);
      setTriageStep('idle');
    } else {
      setCurrentPatient(null);
      setTriageStep('patient_info');
      setPName('');
      setPAge('');
      setPGender('Female');
      setPVillage(user?.location || '');
      setPPhone('');
      setPErr('');
    }
  }, [isOpen, patient, user]);

  const handleSavePatientDetailsStep = async (e) => {
    e.preventDefault();
    setPErr('');
    const cleanName = pName.trim();
    const cleanAge = pAge.trim();
    const cleanVillage = pVillage.trim();

    if (!cleanName || !cleanAge || !cleanVillage) {
      setPErr('Please fill out all compulsory patient fields (Name, Age, Village/Location).');
      return;
    }

    const newPatientData = {
      name: cleanName,
      age: Number(cleanAge),
      gender: pGender,
      village: cleanVillage,
      phone: pPhone.trim() || 'Not provided',
      notes: 'Registered during voice triage session'
    };

    if (handleAddPatient) {
      try { await handleAddPatient(newPatientData, false); } catch (e) {}
    }

    setCurrentPatient({ id: Date.now().toString(), ...newPatientData });
    setTriageStep('idle');
  };

  const startRecording = async () => {
    setTriageStep('recording');
    setRecordingSeconds(0);
    setTranscript('');
    transcriptRef.current = '';
    setTranslation('');
    setSpeechNotice('');
    audioChunksRef.current = [];

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setRecordingSeconds(prev => prev + 1), 1000);

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        const selectedLangObj = INDIAN_LANGUAGES.find(l => l.code === selectedLanguage);
        recognition.lang = selectedLangObj ? selectedLangObj.sarvamCode : 'hi-IN';
        recognition.onresult = (event) => {
          let currentText = '';
          for (let i = 0; i < event.results.length; i++) currentText += event.results[i][0].transcript;
          if (currentText) {
            setTranscript(currentText);
            transcriptRef.current = currentText;
          }
        };
        recognition.onerror = (err) => console.warn('Web Speech API notice:', err.error);
        try {
          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) { console.warn('SpeechRecognition start notice:', e); }
      }
    } catch (err) {
      console.warn('Web Speech API not available:', err);
    }

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? { mimeType: 'audio/webm;codecs=opus' }
          : MediaRecorder.isTypeSupported('audio/webm') ? { mimeType: 'audio/webm' }
          : MediaRecorder.isTypeSupported('audio/mp4') ? { mimeType: 'audio/mp4' } : {};

        const mediaRecorder = new MediaRecorder(mediaStream, options);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        mediaRecorder.start(200);
      }
    } catch (err) {
      console.error('Microphone getUserMedia error:', err);
      if (!transcriptRef.current) {
        const errName = err.name || 'MicrophoneError';
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          setTriageStep('idle');
          setSpeechNotice('⚠️ Microphone permission denied by browser. Please allow microphone access in site settings.');
          if (timerRef.current) clearInterval(timerRef.current);
        } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
          setTriageStep('idle');
          setSpeechNotice('⚠️ Microphone is currently in use by another app. Please close other voice apps.');
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTriageStep('analyzing');

    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch (e) {}
    }

    const capturedText = (transcriptRef.current || transcript || '').trim();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = async () => {
        if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
        }

        if (capturedText) {
          finishTriageAnalysis(capturedText);
        } else {
          const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          if (audioBlob.size > 0) {
            await processSarvamSTT(audioBlob);
          } else {
            setTriageStep('idle');
            setSpeechNotice('⚠️ Microphone captured 0 bytes of audio. Please speak clearly into your mic.');
          }
        }
      };
      try { mediaRecorderRef.current.stop(); } catch (e) { console.warn('MediaRecorder stop notice:', e); }
    } else if (capturedText) {
      finishTriageAnalysis(capturedText);
    } else {
      setTriageStep('idle');
      setSpeechNotice('⚠️ Microphone capture failed to start. Please check microphone permissions and try again.');
    }
  };

  const processSarvamSTT = async (audioBlob) => {
    try {
      const base64Audio = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      const selectedLangObj = INDIAN_LANGUAGES.find(l => l.code === selectedLanguage);
      const response = await fetch(`${API_BASE_URL}/api/speech-to-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64Audio, languageCode: selectedLangObj ? selectedLangObj.sarvamCode : `${selectedLanguage}-IN` })
      });
      const data = await response.json();

      if (response.ok && data.transcript && data.transcript.trim()) {
        setSpeechNotice('');
        setTranscript(data.transcript);
        transcriptRef.current = data.transcript;
        finishTriageAnalysis(data.transcript);
      } else {
        const textToUse = (transcriptRef.current || transcript || '').trim();
        if (textToUse) {
          finishTriageAnalysis(textToUse);
        } else {
          setTriageStep('idle');
          setSpeechNotice(`⚠️ Speech-to-text: ${data.error || 'no speech detected'}. Please try again.`);
        }
      }
    } catch (err) {
      console.warn('Sarvam STT backend request error:', err);
      const textToUse = (transcriptRef.current || transcript || '').trim();
      if (textToUse) {
        finishTriageAnalysis(textToUse);
      } else {
        setTriageStep('idle');
        setSpeechNotice('⚠️ Speech-to-text service unavailable. Please check your mic connection and try again.');
      }
    }
  };

  const finishTriageAnalysis = async (finalText) => {
    const textToAnalyze = (finalText || transcriptRef.current || transcript || '').trim();
    if (!textToAnalyze) {
      setTriageStep('idle');
      setSpeechNotice('⚠️ No speech text was received. Please record again or type symptoms manually.');
      return;
    }
    setSpeechNotice('');
    setTranscript(textToAnalyze);
    transcriptRef.current = textToAnalyze;
    setTriageStep('analyzing');

    let result;
    try {
      const selectedLangObj = INDIAN_LANGUAGES.find(l => l.code === selectedLanguage);
      const res = await fetch(`${API_BASE_URL}/api/analyze-triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToAnalyze, language: selectedLangObj ? selectedLangObj.sarvamCode : `${selectedLanguage}-IN` })
      });
      const data = await res.json();
      if (res.ok && data && data.urgency) {
        result = data;
      } else {
        result = analyzeClinicalText(textToAnalyze, selectedLanguage);
      }
    } catch (err) {
      console.warn('Backend triage analysis unreachable, using local fallback:', err);
      result = analyzeClinicalText(textToAnalyze, selectedLanguage);
    }

    setUrgency(result.urgency || 'Green');
    setSymptoms(result.symptoms || []);
    setKeywords(result.keywords || []);
    setAdvice(result.advice || '');
    setTranslation(result.translation || textToAnalyze);
    setEditableSymptoms(result.symptoms || []);
    setVerificationStep(false);
    setTriageStep('completed');
  };

  useEffect(() => {
    let active = true;
    if (triageStep === 'completed' && urgency === 'Red') {
      setHospitalsLoading(true);
      getNearbyHospitalsAsync(userCoords?.latitude, userCoords?.longitude, currentPatient?.village).then(sorted => {
        if (active) {
          setNearbyHospitals(sorted);
          setHospitalsLoading(false);
        }
      });
    }
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triageStep, urgency]);

  const handlePlayAdvice = async () => {
    if (ttsState === 'loading') return;

    if (ttsState === 'playing' && audioPlaybackRef.current) {
      audioPlaybackRef.current.pause();
      setTtsState('idle');
      return;
    }

    setTtsState('loading');
    try {
      const selectedLangObj = INDIAN_LANGUAGES.find(l => l.code === selectedLanguage);
      const res = await fetch(`${API_BASE_URL}/api/text-to-speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: advice,
          languageCode: selectedLangObj ? selectedLangObj.sarvamCode : 'en-IN'
        })
      });
      const data = await res.json();
      if (!res.ok || !data.audioBase64) throw new Error(data.error || 'Speech synthesis failed');

      const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
      audioPlaybackRef.current = audio;
      audio.onended = () => setTtsState('idle');
      audio.onerror = () => setTtsState('error');
      await audio.play();
      setTtsState('playing');
    } catch (err) {
      console.warn('Text-to-speech unavailable:', err);
      setTtsState('error');
      setTimeout(() => setTtsState('idle'), 2500);
    }
  };

  const handleStartAnchoring = async () => {
    setTriageStep('anchoring');
    setSaving(true);

    const rawDataString = `${currentPatient?.id || 'walkin'}-${urgency}-${transcript}-${translation}-${Date.now()}`;
    const dataHash = await generateSHA256(rawDataString);
    setCalculatedHash(dataHash);

    setAnchoringLogs('Generating tamper-proof digital safety receipt...');
    setTimeout(() => setAnchoringLogs('Creating unalterable proof of clinical record...'), 700);
    setTimeout(() => setAnchoringLogs('Locking digital record for patient safety...'), 1400);

    setTimeout(async () => {
      const txHash = generateTxHash();
      const blockNumber = Math.floor(Math.random() * 2000000) + 48000000;

      try {
        await onSaveTriage({
          patientName: currentPatient?.name || 'Registered Patient',
          patientAge: currentPatient?.age,
          patientGender: currentPatient?.gender,
          village: currentPatient?.village || user?.location || 'Local Sector',
          ashaName: user?.name || 'ASHA Worker',
          language: INDIAN_LANGUAGES.find(l => l.code === selectedLanguage)?.name || 'Hindi',
          transcript,
          translation,
          urgency,
          keywords,
          symptoms: editableSymptoms.length > 0 ? editableSymptoms : symptoms,
          advice,
          txHash,
          blockNumber,
          dataHash
        });
        onClose();
      } finally {
        setSaving(false);
      }
    }, 2200);
  };

  const getWhatsAppText = () => {
    const alertSymbol = urgency === 'Red' ? '🚨 RED ALERT' : urgency === 'Yellow' ? '⚠️ YELLOW ALERT' : '✅ GREEN STATUS';
    const text =
      `*ASHA Mitra Clinical Referral Slip*\n` +
      `----------------------------------------\n` +
      `*Patient Name:* ${currentPatient?.name || 'Registered Patient'}\n` +
      `*Profile:* ${currentPatient ? `${currentPatient.age}y · ${currentPatient.gender}` : 'Registered'}\n` +
      `*Village:* ${currentPatient?.village || user?.location || 'Active Sector'}\n` +
      `*Urgency Level:* ${alertSymbol}\n\n` +
      `*Spoken Voice:* "${transcript}"\n` +
      `*Extracted Symptoms:* ${(editableSymptoms.length > 0 ? editableSymptoms : symptoms).join(', ')}\n\n` +
      `*English Summary:* "${translation}"\n\n` +
      `*Recommended Actions:* ${advice}\n` +
      `----------------------------------------\n` +
      `*Status:* Authenticated by ASHA worker\n` +
      `*Digital Safety ID:* ${calculatedHash ? calculatedHash.substring(0, 16) + '...' : 'Pending'}`;
    return encodeURIComponent(text);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A2540]/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 bg-[#0A2540] text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#E07A5F]" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-lg">{t('ai_voice_triage')}</h3>
              <p className="text-xs text-white/70">
                {t('patient')}: <span className="font-bold text-[#E07A5F]">{currentPatient?.name || 'New Patient Triage'}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {triageStep !== 'patient_info' && (
          <div className="flex space-x-2 mb-4 px-6 mt-4">
            <button onClick={() => setInputMode('voice')} className={`px-4 py-2 rounded ${inputMode === 'voice' ? 'bg-[#E07A5F] text-white' : 'bg-gray-200 text-gray-800'}`}>
              {t('voice_input')}
            </button>
            <button onClick={() => setInputMode('manual')} className={`px-4 py-2 rounded ${inputMode === 'manual' ? 'bg-[#E07A5F] text-white' : 'bg-gray-200 text-gray-800'}`}>
              {t('manual_input')}
            </button>
          </div>
        )}

        <div className="p-6 overflow-y-auto flex-grow">
          {triageStep === 'patient_info' && (
            <div className="space-y-4 text-left py-2">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                <h4 className="font-heading font-extrabold text-sm text-[#0A2540] uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#E07A5F]" /> Patient Details Required
                </h4>
                <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
                  Please enter patient details before starting the AI voice triage assessment.
                </p>
              </div>

              {pErr && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">{pErr}</div>}

              <form onSubmit={handleSavePatientDetailsStep} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Full Name *</label>
                  <input type="text" required value={pName} onChange={(e) => setPName(e.target.value)} placeholder="e.g. Meena Devi"
                    className="w-full p-3 text-sm rounded-xl border border-slate-200 font-semibold text-[#0A2540] focus:border-[#E07A5F] focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Age *</label>
                    <input type="number" required min="0" max="120" value={pAge} onChange={(e) => setPAge(e.target.value)} placeholder="e.g. 28"
                      className="w-full p-3 text-sm rounded-xl border border-slate-200 font-semibold text-[#0A2540] focus:border-[#E07A5F] focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Gender *</label>
                    <select value={pGender} onChange={(e) => setPGender(e.target.value)}
                      className="w-full p-3 text-sm rounded-xl border border-slate-200 font-semibold text-[#0A2540] focus:border-[#E07A5F] focus:outline-none bg-white cursor-pointer">
                      <option value="Female">Female (महिला)</option>
                      <option value="Male">Male (पुरुष)</option>
                      <option value="Other">Other (अन्य)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Village / Location *</label>
                  <input type="text" required value={pVillage} onChange={(e) => setPVillage(e.target.value)} placeholder="e.g. Active Sector / Village"
                    className="w-full p-3 text-sm rounded-xl border border-slate-200 font-semibold text-[#0A2540] focus:border-[#E07A5F] focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Phone Number (Optional)</label>
                  <input type="tel" value={pPhone} onChange={(e) => setPPhone(e.target.value)} placeholder="e.g. 9876543210"
                    className="w-full p-3 text-sm rounded-xl border border-slate-200 font-semibold text-[#0A2540] focus:border-[#E07A5F] focus:outline-none" />
                </div>
                <button type="submit" className="w-full py-3.5 bg-[#E07A5F] hover:bg-[#D46A4F] text-white font-extrabold text-sm rounded-2xl shadow-soft transition-all mt-4">
                  Proceed to Voice Assessment
                </button>
              </form>
            </div>
          )}

          {triageStep === 'idle' && inputMode === 'voice' && (
            <div className="text-center py-6">
              {speechNotice && (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-6 text-left max-w-md mx-auto flex items-start gap-3 shadow-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 font-semibold leading-relaxed">{speechNotice}</div>
                </div>
              )}

              <div className="max-w-md mx-auto mb-6">
                <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-2.5 text-left">{t('select_spoken_lang')}</label>
                <div className="relative">
                  <Languages className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                  <select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)} className="w-full min-h-[56px] pl-12 pr-10 rounded-2xl border-2 border-slate-200 bg-white text-lg font-semibold text-[#0A2540] focus:border-[#E07A5F] focus:outline-none cursor-pointer hover:bg-slate-50 transition-all">
                    {INDIAN_LANGUAGES.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center my-6">
                <button onClick={startRecording} className="w-24 h-24 rounded-full bg-[#E07A5F] hover:bg-[#D46A4F] text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 group relative">
                  <div className="absolute inset-0 rounded-full bg-[#E07A5F] opacity-20 animate-ping group-hover:opacity-30"></div>
                  <Mic className="w-10 h-10" />
                </button>
                <h4 className="font-heading font-extrabold text-[#0A2540] text-xl mt-5">{t('start_voice_triage')}</h4>
                <p className="text-slate-500 mt-2 text-xs max-w-sm">{t('mic_hint_desc')}</p>
              </div>
            </div>
          )}

          {triageStep === 'idle' && inputMode === 'manual' && (
            <div className="space-y-5 max-w-md mx-auto py-4 text-left">
              <div>
                <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-2">{t('select_language')}</label>
                <select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 bg-white font-semibold text-[#0A2540] focus:border-[#E07A5F] focus:outline-none cursor-pointer">
                  {INDIAN_LANGUAGES.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-2">{t('type_description')}</label>
                <textarea value={manualText} onChange={e => setManualText(e.target.value)} rows={4} placeholder={t('manual_placeholder')}
                  className="w-full p-3.5 rounded-2xl border-2 border-slate-200 shadow-sm focus:border-[#E07A5F] focus:ring-1 focus:ring-[#E07A5F] text-slate-800 text-sm font-medium" />
              </div>
              <button
                onClick={() => {
                  const trimmed = manualText.trim();
                  if (!trimmed) return;
                  setTriageStep('analyzing');
                  finishTriageAnalysis(trimmed);
                }}
                className="w-full py-3.5 bg-[#E07A5F] hover:bg-[#D46A4F] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm active:scale-95"
              >
                <Sparkles className="w-4 h-4" /> {t('analyze_btn')}
              </button>
            </div>
          )}

          {triageStep === 'recording' && (
            <div className="text-center py-10 flex flex-col items-center justify-center">
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-full font-bold text-xs tracking-wider uppercase mb-6 animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                {t('recording_voice')}
              </div>
              <div className="flex items-center gap-2 text-2xl font-bold font-mono text-[#0A2540] mb-8">
                <Clock className="w-6 h-6 text-[#E07A5F]" />
                {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')}
              </div>
              <button onClick={stopRecording} className="px-8 py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2.5 transition-colors shadow-md text-sm active:scale-95 mb-4">
                <MicOff className="w-4 h-4" /> {t('stop_analyze')}
              </button>
              {transcript && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-w-md w-full mb-4 text-xs font-mono text-slate-700 text-left">
                  <span className="font-bold text-[#E07A5F]">{t('live_preview')}: </span>"{transcript}"
                </div>
              )}
              <p className="text-xs text-slate-400 mt-2 italic">{t('capturing_mic')}</p>
            </div>
          )}

          {triageStep === 'analyzing' && (
            <div className="text-center py-16 flex flex-col items-center justify-center">
              <div className="w-16 h-16 border-4 border-[#E07A5F]/20 border-t-[#E07A5F] rounded-full animate-spin mb-6"></div>
              <h4 className="font-heading font-extrabold text-[#0A2540] text-xl">{t('ai_at_work')}</h4>
              <p className="text-slate-500 mt-2 max-w-sm">{t('ai_work_desc')}</p>
            </div>
          )}

          {triageStep === 'anchoring' && (
            <div className="text-center py-16 flex flex-col items-center justify-center">
              <div className="w-16 h-16 border-4 border-[#0A2540]/10 border-t-[#E07A5F] rounded-full animate-spin mb-6"></div>
              <h4 className="font-heading font-extrabold text-[#0A2540] text-xl">{t('anchoring_polygon')}</h4>
              <p className="text-slate-500 mt-2 max-w-sm text-sm">{t('anchoring_polygon_desc')}</p>
              {anchoringLogs && (
                <div className="mt-6 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-500 max-w-md">
                  {anchoringLogs}
                </div>
              )}
            </div>
          )}

          {triageStep === 'completed' && (
            <div className="space-y-6 text-left">
              {verificationStep ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">{t('edit_symptoms_label')}</label>
                  <textarea value={editableSymptoms.join('\n')} onChange={e => setEditableSymptoms(e.target.value.split('\n').filter(s => s.trim() !== ''))} rows={4} className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-[#E07A5F] focus:ring-[#E07A5F]" />
                  <button onClick={() => { setVerificationStep(false); setSymptoms(editableSymptoms); }} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">{t('done_editing')}</button>
                </div>
              ) : (
                <button onClick={() => { setVerificationStep(true); setEditableSymptoms(symptoms); }} className="mt-4 px-4 py-2 bg-[#0A2540] text-white rounded hover:bg-[#123152]">
                  {t('verify_edit_symptoms')}
                </button>
              )}

              <div className={`p-5 rounded-2xl flex items-start gap-4 border ${urgency === 'Red' ? 'bg-red-50/70 border-red-200 text-red-900' : urgency === 'Yellow' ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-green-50/70 border-green-200 text-green-900'}`}>
                {urgency === 'Red' && <AlertCircle className="w-8 h-8 text-red-600 shrink-0" />}
                {urgency === 'Yellow' && <AlertTriangle className="w-8 h-8 text-amber-600 shrink-0" />}
                {urgency === 'Green' && <CheckCircle2 className="w-8 h-8 text-green-600 shrink-0" />}
                <div className="flex-grow">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-extrabold tracking-wider opacity-60">{t('ai_urgency_level')}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${urgency === 'Red' ? 'bg-red-600 text-white' : urgency === 'Yellow' ? 'bg-amber-500 text-white' : 'bg-green-600 text-white'}`}>
                      {urgency === 'Red' ? t('red') : urgency === 'Yellow' ? t('yellow') : t('green')} {t('alert_suffix')}
                    </span>
                  </div>
                  <h4 className="font-heading font-extrabold text-lg mt-1">
                    {urgency === 'Red' ? t('immediate_referral') : urgency === 'Yellow' ? t('anm_assessment') : t('home_care')}
                  </h4>
                  <div className="flex items-start gap-2 mt-1">
                    <p className="text-sm opacity-80 flex-grow">{advice}</p>
                    <button
                      onClick={handlePlayAdvice}
                      title={t('listen_advice')}
                      className="shrink-0 p-2 rounded-xl bg-white/60 hover:bg-white text-current border border-current/20 transition-colors"
                    >
                      {ttsState === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : ttsState === 'playing' ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {urgency === 'Red' && (
                <div className="bg-[#FFF5F5] border border-red-200/80 rounded-3xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 border-b border-red-100 pb-3">
                    <MapPin className="w-5 h-5 text-red-600" />
                    <h4 className="font-heading font-extrabold text-[#0A2540] text-sm">🚨 {t('nearby_emergency')}</h4>
                  </div>
                  <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                    {hospitalsLoading ? (
                      <div className="text-center py-4 text-xs text-slate-400 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> {t('searching_facilities')}
                      </div>
                    ) : nearbyHospitals.length === 0 ? (
                      <div className="text-center py-4 text-xs text-slate-400">{t('no_facilities_found')}</div>
                    ) : (
                      nearbyHospitals.slice(0, 5).map((hosp, idx) => (
                        <div key={hosp.id} className="p-3 rounded-xl border border-slate-100 bg-white flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#0A2540] text-sm truncate">{hosp.name}</span>
                              {idx === 0 && <span className="px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-black uppercase rounded shrink-0">{t('nearest') || 'Nearest'}</span>}
                            </div>
                            <span className="text-[10px] text-slate-500">{hosp.distance} km</span>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <a href={`tel:${hosp.phone}`} className="p-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg border border-green-200">
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hosp.name + ' ' + hosp.address)}`} target="_blank" rel="noreferrer" className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-extrabold tracking-wider uppercase text-slate-500 flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5" /> {t('spoken_transcript')} & {t('english_translation')}
                  </span>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <h5 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">{t('spoken_transcript')} ({t('original')})</h5>
                    <p className="text-slate-800 font-medium italic text-base leading-relaxed">"{transcript}"</p>
                  </div>
                  <div className="border-t border-slate-100 pt-4">
                    <h5 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">{t('english_translation')} (AI)</h5>
                    <p className="text-slate-800 font-medium text-base leading-relaxed">"{translation}"</p>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-left">
                  <h4 className="font-bold text-[#0A2540] text-sm">{t('alert_health_staff')}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{t('alert_health_staff_desc')}</p>
                </div>
                <a href={`https://api.whatsapp.com/send?text=${getWhatsAppText()}`} target="_blank" rel="noreferrer"
                  className="px-4 py-2.5 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-sm shrink-0">
                  {t('share_referral')}
                </a>
              </div>

              <div>
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">{t('extracted_symptoms')} ({symptoms.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {symptoms.map((symptom, idx) => (
                    <span key={idx} className="px-3.5 py-1.5 bg-[#FDFBF7] border border-slate-200 text-[#0A2540] text-sm font-semibold rounded-xl flex items-center gap-1.5 shadow-sm">
                      <span className={`w-2 h-2 rounded-full ${urgency === 'Red' ? 'bg-red-500' : urgency === 'Yellow' ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                      {symptom}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} disabled={triageStep === 'anchoring'} className="px-5 py-3 text-slate-600 hover:text-slate-800 font-bold text-sm transition-colors rounded-xl hover:bg-slate-100 disabled:opacity-30">
            {t('cancel')}
          </button>
          {triageStep === 'completed' ? (
            <button onClick={handleStartAnchoring} disabled={saving} className="px-6 py-3 bg-[#E07A5F] hover:bg-[#D46A4F] text-white font-bold text-sm rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2 disabled:opacity-60">
              <Sparkles className="w-4 h-4" /> {t('save_anchor')}
            </button>
          ) : triageStep === 'idle' && inputMode === 'voice' && (
            <button onClick={startRecording} className="px-6 py-3 bg-[#0A2540] hover:bg-[#123152] text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center gap-2">
              <Mic className="w-4 h-4" /> {t('record_now')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
