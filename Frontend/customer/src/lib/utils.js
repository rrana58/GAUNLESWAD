import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}


export function formatNpr(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`
}