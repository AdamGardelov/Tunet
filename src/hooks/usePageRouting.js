import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

/**
 * Keeps dashboard page state in sync with route params and localStorage.
 * Route shape: /page/:pageId
 */
export function usePageRouting() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pageId } = useParams();

  const [activePage, _setActivePage] = useState(() => {
    try {
      return localStorage.getItem('tunet_active_page') || 'home';
    } catch {
      return 'home';
    }
  });

  const setActivePage = useCallback((page) => {
    _setActivePage(page);
    try {
      localStorage.setItem('tunet_active_page', page);
    } catch {}
  }, []);

  useEffect(() => {
    if (!pageId) return;
    _setActivePage((prev) => {
      if (prev !== pageId) {
        try {
          localStorage.setItem('tunet_active_page', pageId);
        } catch {}
        return pageId;
      }
      return prev;
    });
  }, [pageId]);

  const isInitialRender = useRef(true);

  useEffect(() => {
    if (!activePage) return;
    if (isInitialRender.current) {
      isInitialRender.current = false;
      // Only canonicalize a bare URL on first load; never fight an
      // explicit /page/:id deep link (the param-to-state effect wins).
      if (pageId) return;
      const target = `/page/${activePage}`;
      if (location.pathname !== target) {
        navigate(target, { replace: true });
      }
      return;
    }
    const target = `/page/${activePage}`;
    if (location.pathname !== target) {
      navigate(target, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pathname/pageId are read, not drivers
  }, [activePage, navigate]);

  return { activePage, setActivePage };
}
