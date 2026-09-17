import React from 'react';
import { Mic, UserPlus, Users, ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { formatDateTime } from '../utils/dateUtils';

export default function Dashboard({ user, patientsCount, triageHistory = [], setCurrentView, onStartTriage, setSelectedHistoryItem }) {
  const { t } = useLanguage();

  const today = new Date().toDateString();
  const triagesTodayCount = triageHistory.filter(item => new Date(item.createdAt || item.date).toDateString() === today).length;
  const redAlertsCount = triageHistory.filter(item => (item.doctorUrgency || item.urgency) === 'Red').length;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-extrabold text-[#0A2540]">{t('namaste')}, {user.name.split(' ')[0]} 🙏</h1>

      <div className="bg-[#0A2540] text-white rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div>
          <h2 className="font-heading text-2xl font-extrabold mb-2">{t('ai_voice_triage')}</h2>
          <p className="text-white/70 text-sm max-w-lg">{t('mic_hint_desc')}</p>
        </div>
        <button
          onClick={() => onStartTriage(null)}
          className="px-6 py-4 rounded-2xl bg-[#E07A5F] hover:bg-[#D46A4F] text-white font-bold flex items-center justify-center gap-3 shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all text-base shrink-0"
        >
          <Mic className="w-5 h-5" /> {t('start_voice_triage')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          onClick={() => setCurrentView('add-patient')}
          className="bg-white hover:bg-slate-50 border border-slate-200/80 p-5 rounded-2xl shadow-soft cursor-pointer flex items-center gap-4 group transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#E07A5F] flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#0A2540]">{t('add_patient')}</h3>
            <p className="text-slate-500 text-xs mt-0.5">{t('register_family')}</p>
          </div>
        </div>

        <div
          onClick={() => setCurrentView('patients')}
          className="bg-white hover:bg-slate-50 border border-slate-200/80 p-5 rounded-2xl shadow-soft cursor-pointer flex items-center gap-4 group transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0A2540] flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#0A2540]">{patientsCount} {t('patient_count_label')}</h3>
            <p className="text-slate-500 text-xs mt-0.5">{t('view_patient_list')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-soft">
          <span className="text-[10px] md:text-xs font-bold uppercase text-slate-400 tracking-wider block mb-1">{t('triages_today')}</span>
          <span className="text-2xl md:text-3xl font-black text-[#0A2540]">{triagesTodayCount}</span>
        </div>
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-soft">
          <span className="text-[10px] md:text-xs font-bold uppercase text-slate-400 tracking-wider block mb-1">{t('red_alerts')}</span>
          <span className="text-2xl md:text-3xl font-black text-red-600">{redAlertsCount}</span>
        </div>
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-soft">
          <span className="text-[10px] md:text-xs font-bold uppercase text-slate-400 tracking-wider block mb-1">{t('total_triages')}</span>
          <span className="text-2xl md:text-3xl font-black text-[#0A2540]">{triageHistory.length}</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-heading font-extrabold text-xl text-[#0A2540]">{t('recent_triages')}</h2>
          <button onClick={() => setCurrentView('history')} className="text-sm font-bold text-[#E07A5F] hover:underline flex items-center gap-1">
            {t('view_all')} <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {triageHistory.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center bg-white/50 text-slate-400">
            <p className="text-sm font-medium">{t('no_triages_yet')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {triageHistory.slice(0, 4).map((item) => {
              const isVerified = item.doctorVerificationStatus === 'verified' || item.doctorVerificationStatus === 'modified';
              const currentUrgency = item.doctorUrgency || item.urgency;
              return (
                <div key={item.id} onClick={() => setSelectedHistoryItem(item)} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:border-[#E07A5F] cursor-pointer transition-all shadow-sm gap-3">
                  <div className="flex items-center gap-4">
                    <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${currentUrgency === 'Red' ? 'bg-red-500 ring-4 ring-red-50' : currentUrgency === 'Yellow' ? 'bg-amber-500 ring-4 ring-amber-50' : 'bg-green-500 ring-4 ring-green-50'}`}></span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-[#0A2540]">{item.patientName}</h4>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${currentUrgency === 'Red' ? 'bg-red-100 text-red-800' : currentUrgency === 'Yellow' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>{currentUrgency}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(item.createdAt || item.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                    {isVerified ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">✓ Verified</span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">⏳ Pending</span>
                    )}
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
