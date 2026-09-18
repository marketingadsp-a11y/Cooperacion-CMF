import { Timestamp } from 'firebase/firestore';
import type { SchoolCycle } from './types';

/**
 * Convierte de manera segura cualquier timestamp de Firestore, Date o string a un objeto Date.
 */
export function toDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  if (timestamp instanceof Timestamp || (typeof timestamp === 'object' && typeof timestamp.toDate === 'function')) {
    return timestamp.toDate();
  }
  if (typeof timestamp === 'object' && 'seconds' in timestamp) {
    return new Date(timestamp.seconds * 1000);
  }
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  return new Date();
}

/**
 * Verifica si una fecha cae dentro del rango de un ciclo escolar (incluyendo todo el día final).
 */
export function isDateInCycle(dateVal: any, cycle?: SchoolCycle | null): boolean {
  if (!cycle || !cycle.startDate || !cycle.endDate) return true;
  
  const d = toDate(dateVal);
  
  // Parsear YYYY-MM-DD en fecha local para evitar desfases de zona horaria UTC
  const [startYear, startMonth, startDay] = cycle.startDate.split('-').map(Number);
  const start = new Date(startYear, (startMonth || 1) - 1, startDay || 1, 0, 0, 0, 0);

  const [endYear, endMonth, endDay] = cycle.endDate.split('-').map(Number);
  const end = new Date(endYear, (endMonth || 1) - 1, endDay || 1, 23, 59, 59, 999);

  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

/**
 * Filtra una lista de elementos por ciclo escolar.
 * Si showPrevious es true o no hay ciclo especificado, devuelve todos los elementos.
 */
export function filterByCycle<T>(
  items: T[] | undefined | null,
  getDate: (item: T) => any,
  cycle?: SchoolCycle | null,
  showPrevious = false
): T[] {
  if (!items) return [];
  if (showPrevious || !cycle) return items;
  return items.filter((item) => isDateInCycle(getDate(item), cycle));
}
