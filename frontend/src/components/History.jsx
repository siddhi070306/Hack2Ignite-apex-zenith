import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { formatDateTime } from '../utils/dateUtils';

export default function History({ triageHistory, setSelectedHistoryItem }) {
  const { t } = useLanguage();
  const [historyFilter, setHistoryFilter] = useState('All');

  const filteredHistory = triageHistory.filter(item =>
    historyFilter === 'All' ? true : item.urgency === historyFilter
  );

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-extrabold text-[#0A2540]">{t('triage_history')}</h1>

      <div className="flex flex-wrap gap-2">
        {['All', 'Red', 'Yellow', 'Green'].map(filterOption => (
          <button
            key={filterOption}
            onClick={() => setHistoryFilter(filterOption)}
            className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border-2 transition-all ${
              historyFilter === filterOption
                ? 'bg-[#0A2540] border-[#0A2540] text-white shadow-sm'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            {filterOption === 'All' ? t('all') : filterOption === 'Red' ? t('red') : filterOption === 'Yellow' ? t('yellow') : t('green')}
          </button>
        ))}
      </div>

      {filteredHistory.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center bg-white/50 text-slate-400">
          <p className="text-sm font-medium">{t('no_triages_found')}</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-4">{t('patient_name_col')}</th>
                  <th className="px-6 py-4">{t('urgency_level_col')}</th>
                  <th className="px-6 py-4">{t('doctor_verification_col')}</th>
                  <th className="px-6 py-4">{t('language_spoken_col')}</th>
                  <th className="px-6 py-4">{t('date_time_col')}</th>
                  <th className="px-6 py-4 text-right">{t('action_col')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredHistory.map((item) => {
                  const isVerified = item.doctorVerificationStatus === 'verified' || item.doctorVerificationStatus === 'modified';
                  const currentUrgency = item.doctorUrgency || item.urgency;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-[#0A2540] block">{item.patientName}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">{item.patientAge ? `${item.patientAge}y · ${item.patientGender}` : ''}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          currentUrgency === 'Red' ? 'bg-red-100 text-red-800' : currentUrgency === 'Yellow' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {(currentUrgency === 'Red' ? t('red') : currentUrgency === 'Yellow' ? t('yellow') : t('green'))} {t('alert_suffix')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isVerified ? (
                          <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-lg text-[10px] font-bold border border-green-200">✓ Verified by {item.verifiedBy || 'Doctor'}</span>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-bold border border-amber-200 animate-pulse">⏳ Doctor Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-600">{item.language}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-500">{formatDateTime(item.createdAt || item.date)}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => setSelectedHistoryItem(item)} className="px-3.5 py-1.5 bg-[#0A2540] hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors">
                          {t('view_details')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
