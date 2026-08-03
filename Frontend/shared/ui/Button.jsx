import React from 'react';

/**
 * Standard Design System Button Primitive
 * Variant: primary | secondary | ghost | danger
 * Size: sm | md | lg
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  isDisabled = false,
  fullWidth = false,
  icon: Icon,
  className = '',
  ...props
}) {
  const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 select-none active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

  const variants = {
    primary: 'bg-[#1B3A25] hover:bg-[#142C1C] text-white shadow-md shadow-[#1B3A25]/15 focus:ring-2 focus:ring-[#1B3A25] focus:ring-offset-2',
    secondary: 'bg-[#FAF8F5] hover:bg-[#F7F3EE] text-[#1B3A25] border border-[#B58A63] focus:ring-2 focus:ring-[#B58A63]',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-700 focus:ring-2 focus:ring-slate-300',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-200 focus:ring-2 focus:ring-rose-500',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-5 py-3 text.base gap-2.5',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      disabled={isDisabled || isLoading}
      className={`${baseClasses} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${widthClass} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Loading...</span>
        </span>
      ) : (
        <>
          {Icon && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />}
          {children}
        </>
      )}
    </button>
  );
}

export default Button;
