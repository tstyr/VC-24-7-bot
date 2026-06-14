'use client';

import { useEffect, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  previousValue?: number;
  format?: (value: number) => string;
  className?: string;
}

export default function AnimatedNumber({ 
  value, 
  previousValue, 
  format = (v) => v.toString(),
  className = ''
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (previousValue !== undefined && previousValue !== value) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [value, previousValue]);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  // 増減を判定
  const change = previousValue !== undefined ? value - previousValue : 0;
  const isIncreasing = change > 0;
  const isDecreasing = change < 0;

  // 色を決定
  let colorClass = '';
  if (isIncreasing) {
    colorClass = 'text-green-400';
  } else if (isDecreasing) {
    colorClass = 'text-red-400';
  }

  return (
    <span 
      className={`
        ${className} 
        ${colorClass}
        transition-all duration-300 ease-out
        ${isAnimating ? 'scale-110' : 'scale-100'}
      `}
      style={{
        display: 'inline-block',
        transformOrigin: 'center'
      }}
    >
      {format(displayValue)}
    </span>
  );
}
