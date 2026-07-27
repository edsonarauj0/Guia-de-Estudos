import { useState, useEffect } from 'react';
import { secondsUntil, formatCountdown } from '@/lib/helpers';

export function useCountdown(examDate?: string) {
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!examDate) return;

    const update = () => {
      const secs = secondsUntil(examDate);
      if (secs <= 0) {
        setIsExpired(true);
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setCountdown(formatCountdown(secs));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [examDate]);

  return { countdown, isExpired };
}
