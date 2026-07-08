import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePOSStore } from '../store/pos-store';

const DefaultScreenRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { posProfile } = usePOSStore();

  useEffect(() => {
    if (!posProfile || location.pathname !== '/') {
      return;
    }
    const key = `ury_default_screen_applied_${posProfile.name}`;
    if (sessionStorage.getItem(key)) {
      return;
    }
    sessionStorage.setItem(key, '1');
    if (posProfile.default_pos_screen === 'Tables') {
      navigate('/table', { replace: true });
    }
  }, [posProfile, location.pathname, navigate]);

  return null;
};

export default DefaultScreenRedirect;
