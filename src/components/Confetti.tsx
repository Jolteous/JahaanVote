import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiProps {
  trigger: boolean;
  onDone?: () => void;
}

const Confetti: React.FC<ConfettiProps> = ({ trigger, onDone }) => {
  const hasFired = useRef(false);

  useEffect(() => {
    if (trigger && !hasFired.current) {
      hasFired.current = true;
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.7 },
        zIndex: 9999,
      });
      setTimeout(() => {
        hasFired.current = false;
        onDone && onDone();
      }, 800);
    }
  }, [trigger, onDone]);

  return null;
};

export default Confetti;
