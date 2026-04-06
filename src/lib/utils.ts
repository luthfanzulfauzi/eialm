import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility for merging Tailwind CSS classes safely, 
 * resolving conflicts between base styles and conditional overrides.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Maps User Roles to Technical Access Tiers for UI display.
 * Used in the header to reflect the "Auth Tier" level from the design.
 */
export function getAuthTier(role: string | undefined) {
  if (!role) return "Level 0";
  
  switch (role.toUpperCase()) {
    case 'ADMIN': 
      return "Level 3";
    case 'OPERATOR': 
      return "Level 2";
    case 'VIEWER': 
      return "Level 1";
    default: 
      return "Level 0";
  }
}

/**
 * Formats currency or numbers for asset valuation (Optional utility)
 */
export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}