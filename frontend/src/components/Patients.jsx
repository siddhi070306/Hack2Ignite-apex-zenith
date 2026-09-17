import React, { useState } from 'react';
import { Search, X, UserPlus, Users, MapPin, Phone, Mic, ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function Patients({ patients, setCurrentView, onStartTriage }) {
  const { t } = useLanguage();
  const [patientSearch, setPatientSearch] = useState('');

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.village.toLowerCase().includes(patientSearch.toLowerCase()) ||
    (p.phone || '').includes(patientSearch)
  );

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-extrabold text-[#0A2540]">{t('your_patients')}</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            className="w-full min-h-[50px] pl-12 pr-4 bg-white border border-slate-200 rounded-xl focus:border-[#E07A5F] focus:outline-none text-slate-700 font-medium placeholder:text-slate-400 shadow-sm"
            placeholder={t('search_placeholder')}
          />
          {patientSearch && (
            <button onClick={() => setPatientSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setCurrentView('add-patient')}
          className="min-h-[50px] px-5 bg-[#E07A5F] hover:bg-[#D46A4F] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all text-sm shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          {t('add_patient_btn')}
        </button>
      </div>

      {filteredPatients.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center bg-white/50">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-[#0A2540] text-lg mb-1">{t('no_patients_found')}</h3>
          <p className="text-slate-500 text-sm max-w-xs mx-auto">{t('no_patients_desc', { search: patientSearch })}</p>
          <button
            onClick={() => setCurrentView('add-patient')}
            className="mt-4 px-4 py-2.5 bg-[#0A2540] text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors"
          >
            {t('create_patient_record')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPatients.map(patient => (
            <div key={patient.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-soft flex flex-col justify-between hover:border-slate-300 transition-all">
              <div>
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="font-bold text-[#0A2540] text-lg leading-snug">{patient.name}</h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      {patient.age} {t('years')} · {patient.gender === 'Female' ? t('female').toLowerCase() : patient.gender === 'Male' ? t('male').toLowerCase() : t('other').toLowerCase()}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-[#0A2540] text-sm font-heading select-none shrink-0">
                    {patient.name.charAt(0).toUpperCase()}
                  </div>
                </div>

                <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{patient.village}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{patient.phone}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onStartTriage(patient)}
                className="mt-5 w-full py-3 bg-[#0A2540] hover:bg-[#123152] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98]"
              >
                <Mic className="w-3.5 h-3.5 text-[#E07A5F]" />
                {t('start_triage_btn')}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
