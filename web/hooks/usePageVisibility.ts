import { useEffect, useState } from 'react';

export function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof document !== 'undefined') {
      return !document.hidden;
    }
    return true;
  });
  const [lastVisibleTime, setLastVisibleTime] = useState(Date.now());
  const [wasHiddenDuration, setWasHiddenDuration] = useState(0);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    let hiddenStartTime = document.hidden ? Date.now() : 0;

    const handleVisibilityChange = () => {
      const isCurrentlyVisible = !document.hidden;
      setIsVisible(isCurrentlyVisible);
      
      if (isCurrentlyVisible) {
        // Page just became visible
        const now = Date.now();
        setLastVisibleTime(now);
        
        if (hiddenStartTime > 0) {
          // Calculate how long the page was hidden
          const hiddenDuration = now - hiddenStartTime;
          setWasHiddenDuration(hiddenDuration);
          console.log(`🔄 Page became visible after ${Math.round(hiddenDuration / 1000)}s`);
        }
        hiddenStartTime = 0;
      } else {
        // Page just became hidden
        hiddenStartTime = Date.now();
      }
    };

    // Check for other wake-from-sleep indicators
    const handleFocus = () => {
      const now = Date.now();
      const timeSinceLastVisible = now - lastVisibleTime;
      
      // If page gets focus after being inactive for >30 seconds, likely wake from sleep
      if (timeSinceLastVisible > 30000) {
        console.log('🔄 Detected potential wake from sleep');
        setWasHiddenDuration(timeSinceLastVisible);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    // Also listen for online/offline events
    const handleOnline = () => {
      console.log('🌐 Network connection restored');
    };
    
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [lastVisibleTime]);

  return { isVisible, wasHiddenDuration };
}