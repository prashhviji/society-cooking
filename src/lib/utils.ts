import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ISODate, Unit } from "./types";

/** Tailwind-safe class merge. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Random uuid that works in every browser and in Node. */
export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Local calendar date as YYYY-MM-DD. */
export function toISODate(d: Date = new Date()): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: ISODate, days: number): ISODate {
  const d = parseISODate(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Monday of the week containing the given date. */
export function weekStartOf(s: ISODate = toISODate()): ISODate {
  const d = parseISODate(s);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

/** Whole days from today until the date; negative when already past. */
export function daysUntil(s: ISODate): number {
  const today = parseISODate(toISODate());
  const target = parseISODate(s);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function formatExpiry(s: ISODate): string {
  const d = daysUntil(s);
  if (d < 0) return "Expired";
  if (d === 0) return "Today";
  if (d === 1) return "1 day";
  if (d > 30) return "> 30 days";
  return `${d} days`;
}

export type ExpiryTone = "danger" | "warn" | "ok";
export function expiryTone(s: ISODate): ExpiryTone {
  const d = daysUntil(s);
  if (d <= 2) return "danger";
  if (d <= 4) return "warn";
  return "ok";
}

export function formatQuantity(qty: number, unit: Unit): string {
  if (unit === "pcs") return `${qty} ${qty === 1 ? "pc" : "pcs"}`;
  if (qty >= 1000) {
    const v = qty / 1000;
    return `${Number.isInteger(v) ? v : v.toFixed(1)} ${unit === "g" ? "kg" : "L"}`;
  }
  return `${Math.round(qty)} ${unit}`;
}

export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Title-case a snake_case enum value: "muscle_gain" -> "Muscle gain". */
export function humanize(s: string): string {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
