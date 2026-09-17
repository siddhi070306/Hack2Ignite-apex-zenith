import React from 'react';
import { UserPlus, Users } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function Dashboard({ user, patientsCount, setCurrentView }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-extrabold text-[#0A2540]">{t('namaste')}, {user.name.split(' ')[0]} 🙏</h1>

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
