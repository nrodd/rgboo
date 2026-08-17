import { useState, useEffect } from "react";

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export const CountdownSection = () => {
  const [timeLeft, setTimeLeft] = useState<Countdown | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      let nextOctober = new Date(currentYear, 9, 1); // October 1st (month is 0-indexed)

      // If we've already passed October 1st this year, target next year
      if (now > nextOctober) {
        nextOctober = new Date(currentYear + 1, 9, 1);
      }

      const difference = nextOctober.getTime() - now.getTime();

      if (difference > 0) {
        return {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        };
      }
      return null;
    };

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    setTimeLeft(calculateTimeLeft());

    return () => clearInterval(timer);
  }, []);

  if (!timeLeft) {
    return null;
  }

  return (
    <div className="text-center text-bone space-y-4">
      <h2 className="text-lg sm:text-xl font-bold">See You Next October</h2>
      <div className="flex justify-center gap-4 text-sm sm:text-base">
        <div className="flex flex-col items-center">
          <span className="text-2xl sm:text-3xl font-bold text-pumpkin-400">
            {timeLeft.days}
          </span>
          <span className="text-xs opacity-75">Days</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl sm:text-3xl font-bold text-pumpkin-400">
            {timeLeft.hours}
          </span>
          <span className="text-xs opacity-75">Hours</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl sm:text-3xl font-bold text-pumpkin-400">
            {timeLeft.minutes}
          </span>
          <span className="text-xs opacity-75">Minutes</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl sm:text-3xl font-bold text-pumpkin-400">
            {timeLeft.seconds}
          </span>
          <span className="text-xs opacity-75">Seconds</span>
        </div>
      </div>
    </div>
  );
};
