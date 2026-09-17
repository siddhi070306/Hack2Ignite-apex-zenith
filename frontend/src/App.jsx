import { useLanguage } from './context/LanguageContext';

function App() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-slate-800">
      <h1 className="text-2xl font-semibold">{t('app_name')}</h1>
    </div>
  );
}

export default App;
