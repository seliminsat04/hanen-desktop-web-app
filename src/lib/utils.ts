// Layout utilities
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSafeDate(dateVal: any, formatType: 'date' | 'time' | 'datetime' | 'relative' = 'date'): string {
  if (!dateVal) return 'N/A';
  
  let d: Date;
  if (typeof dateVal === 'object' && dateVal !== null && 'seconds' in dateVal && typeof dateVal.seconds === 'number') {
    d = new Date(dateVal.seconds * 1000);
  } else if (dateVal instanceof Date) {
    d = dateVal;
  } else if (typeof dateVal === 'string' || typeof dateVal === 'number') {
    d = new Date(dateVal);
  } else {
    return 'N/A';
  }

  if (isNaN(d.getTime())) {
    return 'N/A';
  }

  if (formatType === 'time') {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } else if (formatType === 'datetime') {
    return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (formatType === 'relative') {
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 0) return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
