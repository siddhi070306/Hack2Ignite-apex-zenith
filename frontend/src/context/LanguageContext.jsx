import React, { createContext, useContext, useState } from 'react';
import { translations } from '../utils/translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('ui_lang') || 'en';
  });

  const setLanguage = (lang) => {
    if (translations[lang]) {
      setLanguageState(lang);
      localStorage.setItem('ui_lang', lang);
    }
  };

  const t = (key, replacements = {}) => {
    const langTranslations = translations[language] || translations['en'];
    let translated = langTranslations[key] || translations['en'][key] || key;

    Object.keys(replacements).forEach(placeholder => {
      translated = translated.replace(`{${placeholder}}`, replacements[placeholder]);
    });

    return translated;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
