import { useEffect, useState } from 'react';

// Returns days/hours/minutes/seconds remaining until the target date,
// and a `done` flag once the date has passed.
export function useCountdown(targetDate) {
  const target = targetDate ? new Date(targetDate).getTime() : null;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!target) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: false };

  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return { days, hours, minutes, seconds, done: diff === 0 };
}
