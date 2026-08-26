import { useEffect, useState } from 'react';

/**
 * Reactively reports whether the viewport is currently "mobile" sized.
 * Used to gate desktop-only decorative effects (custom cursor, particle
 * backgrounds) so they never run on phones/small touch screens, while
 * staying enabled on desktop/laptop and reacting live if the window is
 * resized or a device is rotated across the breakpoint.
 */
export default function useIsMobile(breakpoint = 768) {
  const getMatch = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches
      : false;

  const [isMobile, setIsMobile] = useState(getMatch);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange); // Safari <14 fallback
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, [breakpoint]);

  return isMobile;
}
