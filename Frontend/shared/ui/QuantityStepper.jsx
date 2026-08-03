import React from 'react';

/**
 * Standard Quantity Stepper Component (- 1 +)
 */
export function QuantityStepper({
  value = 1,
  min = 1,
  max = 99,
  onChange,
  className = '',
}) {
  const handleDecrement = (e) => {
    e.stopPropagation();
    if (value > min) onChange(value - 1);
  };

  const handleIncrement = (e) => {
    e.stopPropagation();
    if (value < max) onChange(value + 1);
  };

  return (
    <div className={`inline-flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 select-none ${className}`}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        className="w-7 h-7 rounded-md bg-white text-slate-800 font-bold flex items-center justify-center shadow-2xs hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        -
      </button>
      <span className="w-8 text-center text-xs font-bold text-slate-900 font-mono">
        {value}
      </span>
      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= max}
        className="w-7 h-7 rounded-md bg-white text-slate-800 font-bold flex items-center justify-center shadow-2xs hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        +
      </button>
    </div>
  );
}

export default QuantityStepper;
