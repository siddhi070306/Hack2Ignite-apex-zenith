import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function AddPatient({ handleAddPatient }) {
  const { t } = useLanguage();
  const [newPatient, setNewPatient] = useState({
    name: '',
    age: '',
    gender: 'Female',
    village: '',
    phone: '',
    notes: ''
  });

  const handleSubmit = (e, andStartTriage = false) => {
    e.preventDefault();
    handleAddPatient(newPatient, andStartTriage);
    setNewPatient({ name: '', age: '', gender: 'Female', village: '', phone: '', notes: '' });
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="font-heading text-3xl font-extrabold text-[#0A2540]">{t('add_new_patient')}</h1>

      <form onSubmit={(e) => handleSubmit(e, false)} className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
        <div>
          <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-2">{t('full_name')}</label>
          <input
            type="text" required value={newPatient.name}
            onChange={(e) => setNewPatient(prev => ({ ...prev, name: e.target.value }))}
            className="w-full min-h-[50px] px-4 rounded-xl border border-slate-200 focus:border-[#E07A5F] focus:outline-none text-slate-700 font-medium"
            placeholder={t('full_name_placeholder')}
          />
        </div>

        <div>
          <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-2">{t('age')}</label>
          <input
            type="number" required min="0" max="125" value={newPatient.age}
            onChange={(e) => setNewPatient(prev => ({ ...prev, age: e.target.value }))}
            className="w-full min-h-[50px] px-4 rounded-xl border border-slate-200 focus:border-[#E07A5F] focus:outline-none text-slate-700 font-medium"
            placeholder={t('age_placeholder')}
          />
        </div>

        <div>
          <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-2.5">{t('gender')}</label>
          <div className="grid grid-cols-3 gap-2">
            {['Female', 'Male', 'Other'].map((genderOption) => (
              <button
                key={genderOption}
                type="button"
                onClick={() => setNewPatient(prev => ({ ...prev, gender: genderOption }))}
                className={`py-3.5 rounded-xl border-2 font-bold text-sm transition-all ${
                  newPatient.gender === genderOption
                    ? 'border-[#0A2540] bg-slate-50 text-[#0A2540]'
                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                }`}
              >
                {genderOption === 'Female' ? t('female') : genderOption === 'Male' ? t('male') : t('other')}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-2">{t('village')}</label>
            <input
              type="text" required value={newPatient.village}
              onChange={(e) => setNewPatient(prev => ({ ...prev, village: e.target.value }))}
              className="w-full min-h-[50px] px-4 rounded-xl border border-slate-200 focus:border-[#E07A5F] focus:outline-none text-slate-700 font-medium"
              placeholder={t('village_placeholder')}
            />
          </div>
          <div>
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-2">{t('phone_optional')}</label>
            <input
              type="tel" value={newPatient.phone}
              onChange={(e) => setNewPatient(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full min-h-[50px] px-4 rounded-xl border border-slate-200 focus:border-[#E07A5F] focus:outline-none text-slate-700 font-medium"
              placeholder={t('phone_placeholder')}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-2">{t('notes_optional')}</label>
          <textarea
            rows="3" value={newPatient.notes}
            onChange={(e) => setNewPatient(prev => ({ ...prev, notes: e.target.value }))}
            className="w-full p-4 rounded-xl border border-slate-200 focus:border-[#E07A5F] focus:outline-none text-slate-700 font-medium resize-none"
            placeholder={t('notes_placeholder')}
          ></textarea>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button type="submit" className="flex-grow min-h-[50px] px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm">
            {t('save_patient_info')}
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            className="flex-grow min-h-[50px] px-5 bg-[#E07A5F] hover:bg-[#D46A4F] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-soft transition-all text-sm hover:-translate-y-0.5 active:translate-y-0"
          >
            {t('save_start_triage')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
