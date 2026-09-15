export function num(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function fmt(v: number | null | undefined, decimals = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(decimals);
}

export function fmtSigned(v: number | null | undefined, decimals = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toFixed(decimals)}`;
}

export function formatHours(h: number | null | undefined, decimals = 1): string {
  if (h == null || !Number.isFinite(h)) return "—";
  if (Math.abs(h) >= 10 && decimals === 1) return Math.round(h).toString();
  return h.toFixed(decimals);
}

export function formatDurationMin(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min) || min <= 0) return "—";
  const m = Math.round(min);
  if (m < 60) return `${m}'`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}'`;
}

export function formatKm(km: number | null | undefined, decimals = 1): string {
  if (km == null || !Number.isFinite(km)) return "—";
  return km >= 10 && decimals === 1 ? String(Math.round(km)) : km.toFixed(decimals);
}

export function formatPace(minPerKm: number | null | undefined): string {
  if (minPerKm == null || !Number.isFinite(minPerKm) || minPerKm <= 0) return "—";
  const totalSec = Math.round(minPerKm * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function paceFromWorkout(
  distanceKm: number | null | undefined,
  durationMin: number | null | undefined,
): number | null {
  if (distanceKm == null || durationMin == null || distanceKm <= 0 || durationMin <= 0) {
    return null;
  }
  return durationMin / distanceKm;
}

export function formatClock(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return "—";
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function formatClockDelta(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const sign = seconds > 0 ? "+" : seconds < 0 ? "−" : "";
  const abs = Math.abs(Math.round(seconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${sign}${h}:${String(mm).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}

export function formatZScore(z: string | number | null | undefined): string | null {
  if (z == null) return null;
  const n = Number(z);
  if (!Number.isFinite(n)) return null;
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(2)} z`;
}

export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function timeAgo(iso: string, now = Date.now()): string {
  const ms = now - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
