'use client';

import { useEffect, useState, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  previousValue?: number;
  format?: (value: number) => string;
  className?: string;
  duration?: number; // アニメーション時間（ミリ秒）
}

export default function AnimatedNumber({ 
  value, 
  previousValue, 
  format = (v) => v.toString(),
  className = '',
  duration = 500
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef<number>(value);

  useEffect(() => {
    if (previousValue !== undefined && previousValue !== value) {
      setIsAnimating(true);
      startValueRef.current = previousValue;
      startTimeRef.current = Date.now();

      const animate = () => {
        const now = Date.now();
        const elapsed = now - (startTimeRef.current || now);
        const progress = Math.min(elapsed / duration, 1);

        // イージング関数（ease-out）
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = startValueRef.current + (value - startValueRef.current) * easeOut;

        setDisplayValue(currentValue);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setDisplayValue(value);
          setIsAnimating(false);
        }
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    } else {
      setDisplayValue(value);
    }
  }, [value, previousValue, duration]);

  // 増減を判定
  const change = previousValue !== undefined ? value - previousValue : 0;
  const isIncreasing = change > 0;
  const isDecreasing = change < 0;

  // 色を決定
  let colorClass = '';
  if (isIncreasing && isAnimating) {
    colorClass = 'text-green-400';
  } else if (isDecreasing && isAnimating) {
    colorClass = 'text-red-400';
  }

  return (
    <span 
      className={`${className} ${colorClass} transition-colors duration-300`}
      style={{
        display: 'inline-block'
      }}
    >
      {format(displayValue)}
    </span>
  );
}
