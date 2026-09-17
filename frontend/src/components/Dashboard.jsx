import React from 'react';
import { Mic, UserPlus, Users } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function Dashboard({ user, patientsCount, setCurrentView, onStartTriage }) {
  const { t } = useLanguage();
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
    </div>
  );
}
