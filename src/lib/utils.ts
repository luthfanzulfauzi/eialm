import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const ASSET_SERIAL_NUMBER_NOT_AVAILABLE = "N/A";
const ASSET_SERIAL_NUMBER_NA_PREFIX = "__NA__:";
const ASSET_SERIAL_NUMBER_NA_PREFIX_LEGACY = /^_+NA_+:?/i;

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

export function isAssetSerialNumberNotAvailable(value: string | null | undefined) {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  return (
    normalized.toUpperCase() === ASSET_SERIAL_NUMBER_NOT_AVAILABLE ||
    normalized.startsWith(ASSET_SERIAL_NUMBER_NA_PREFIX) ||
    ASSET_SERIAL_NUMBER_NA_PREFIX_LEGACY.test(normalized)
  );
}

export function formatAssetSerialNumber(value: string | null | undefined) {
  if (!value) return "—";
  return isAssetSerialNumberNotAvailable(value) ? ASSET_SERIAL_NUMBER_NOT_AVAILABLE : value;
}

export function createAssetSerialNumberNotAvailableValue() {
  return `${ASSET_SERIAL_NUMBER_NA_PREFIX}${crypto.randomUUID()}`;
}
