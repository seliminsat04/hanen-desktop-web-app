import React, { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';

interface CountUpProps {
  value: number | string;
  duration?: number;
}

export function CountUp({ value }: CountUpProps) {
  // Parse numeric value and check for percentage
  const stringValue = String(value);
  const numberValue = parseFloat(stringValue.replace('%', '')) || 0;
  const isPercentage = stringValue.includes('%');

  // Set up spring animation with more elegant, slower physics
  const spring = useSpring(0, {
    stiffness: 25,
    damping: 20,
    restDelta: 0.001
  });

  // Transform spring value to display format
  const displayValue = useTransform(spring, (latest) => {
    const rounded = Math.round(latest);
    return isPercentage ? `${rounded}%` : rounded.toLocaleString();
  });

  useEffect(() => {
    // Start animation on mount or value change
    spring.set(numberValue);
  }, [numberValue, spring]);

  return <motion.span>{displayValue}</motion.span>;
}
