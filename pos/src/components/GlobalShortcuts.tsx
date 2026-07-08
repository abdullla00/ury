import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const GlobalShortcuts = () => {
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (e.key === '/' && !isInput && (location.pathname === '/' || location.pathname === '/orders')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('ury-focus-search'));
      }

      if (e.key === 'Escape' && !isInput) {
        window.dispatchEvent(new CustomEvent('ury-close-overlays'));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [location.pathname]);

  return null;
};

export default GlobalShortcuts;
