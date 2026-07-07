import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Footer from './components/Footer';
import Header from './components/Header';
import Orders from './pages/Orders';
import POS from './pages/POS';
import Table from './pages/Table';
import AuthGuard from './components/AuthGuard';
import POSOpeningProvider from './components/POSOpeningProvider';
import { ToastProvider } from './components/ui/toast';
import { usePOSStore } from './store/pos-store';
import { useEffect } from 'react';
import { getActiveLanguage } from './i18n';

const POS_PROFILE_CACHE_VERSION = '3';

function App() {
  const {
    initializeApp
  } = usePOSStore();
  
  useEffect(() => {
    if (sessionStorage.getItem('posProfileCacheVersion') !== POS_PROFILE_CACHE_VERSION) {
      sessionStorage.removeItem('posProfile');
      sessionStorage.setItem('posProfileCacheVersion', POS_PROFILE_CACHE_VERSION);
    }
    initializeApp();
  }, [initializeApp]);

  useEffect(() => {
    const lang = getActiveLanguage();
    const isRtl = ['ar', 'he', 'fa', 'ur', 'ku'].includes(lang);
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lang || 'en';
  }, []);
  return (
    <>
      <ToastProvider />
      <AuthGuard>
        <POSOpeningProvider>
          <Router basename="/pos">
            <div className="flex h-screen flex-col bg-gray-100 font-inter">
              <Header />
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <Routes>
                  <Route path="/" element={<POS/>} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/table" element={<Table />} />
                </Routes>
              </div>
              <Footer />
            </div>
          </Router>
        </POSOpeningProvider>
      </AuthGuard>
    </>
  );
}

export default App;
