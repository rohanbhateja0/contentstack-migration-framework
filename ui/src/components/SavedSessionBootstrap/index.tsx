import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { getSavedSession } from '../../services/api/login.service';
import { getDataFromLocalStorage, setDataInLocalStorage } from '../../utilities/functions';
import { getUserDetails, setAuthToken, setUser } from '../../store/slice/authSlice';

const PUBLIC_AUTH_PATHS = new Set(['/', '/region-login', '/login']);

const SavedSessionBootstrap = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const attemptedRestore = useRef(false);

  useEffect(() => {
    if (attemptedRestore.current || getDataFromLocalStorage('app_token')) {
      return;
    }

    attemptedRestore.current = true;

    const restoreSession = async () => {
      const response = await getSavedSession();

      if (response?.status !== 200 || !response?.data?.app_token) {
        return;
      }

      setDataInLocalStorage('app_token', response.data.app_token);

      dispatch(
        setAuthToken({
          authToken: response.data.app_token,
          isAuthenticated: true,
        })
      );

      dispatch(
        setUser({
          email: response?.data?.user?.email ?? '',
          region: response?.data?.user?.region ?? '',
        })
      );

      dispatch(getUserDetails());

      if (PUBLIC_AUTH_PATHS.has(location.pathname)) {
        navigate('/projects', { replace: true });
      }
    };

    restoreSession().catch((error) => {
      console.error('Unable to restore saved session:', error);
    });
  }, [dispatch, location.pathname, navigate]);

  return null;
};

export default SavedSessionBootstrap;