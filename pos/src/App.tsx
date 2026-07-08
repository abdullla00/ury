import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DefaultScreenRedirect from './components/DefaultScreenRedirect';
import GlobalShortcuts from './components/GlobalShortcuts';
import Footer from './components/Footer';
import Header from './components/Header';
import Orders from './pages/Orders';
import POS from './pages/POS';
import Table from './pages/Table';
import TableOrder from './pages/TableOrder';
import AuthGuard from './components/AuthGuard';
import POSOpeningProvider from './components/POSOpeningProvider';
import { ToastProvider } from './components/ui/toast';
import { usePOSStore } from './store/pos-store';
import { useEffect } from 'react';
import { getActiveLanguage } from './i18n';

const POS_PROFILE_CACHE_VERSION = '5';

function NavGuard() {
  const { activeOrders } = usePOSStore();

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (activeOrders.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [activeOrders.length]);

  return null;
}

function AuthenticatedShell() {
  return (
    <AuthGuard>
      <POSOpeningProvider>
        <NavGuard />
        <DefaultScreenRedirect />
        <GlobalShortcuts />
        <div className="flex h-screen flex-col bg-gray-100 font-inter">
          <Header />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Routes>
              <Route path="/" element={<POS />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/table" element={<Table />} />
            </Routes>
          </div>
          <Footer />
        </div>
      </POSOpeningProvider>
    </AuthGuard>
  );
}

function App() {
  const { initializeApp } = usePOSStore();

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
      <Router basename="/pos">
        <Routes>
          <Route path="/table-order/:token" element={<TableOrder />} />
          <Route path="/*" element={<AuthenticatedShell />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;
