import React from 'react';

/**
 * Standard Design System Status Badge
 * Status: pending | confirmed | preparing | ready | transit | delivered | cancelled
 */
export function Badge({ status = 'confirmed', children, className = '' }) {
  const statusConfigs = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
    preparing: 'bg-purple-100 text-purple-800 border-purple-200',
    ready: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    transit: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    delivered: 'bg-green-100 text-green-800 border-green-200',
    cancelled: 'bg-rose-100 text-rose-800 border-rose-200',
    promo: 'bg-[#B58A63] text-white border-transparent font-bold',
  };

  const styleClass = statusConfigs[status] || statusConfigs.confirmed;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${styleClass} ${className}`}>
      {children || status.toUpperCase()}
    </span>
  );
}

export default Badge;
