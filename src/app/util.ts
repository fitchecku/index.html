export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const pad = (n: number) => String(n).padStart(2, '0');

export const toDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toDateTime = (d: Date) => `${toDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const today = () => toDate(new Date());

export const addDays = (date: string | Date, days: number) => {
    const d = typeof date === 'string' ? parseDate(date) : new Date(date);
    d.setDate(d.getDate() + days);
    return toDate(d);
};

/** Parse YYYY-MM-DD as a local date (not UTC). */
export const parseDate = (s: string) => {
    if (s.length > 10) return new Date(s);
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
};

/** Whole days from today until date (negative = in the past). */
export const daysUntil = (s?: string) => {
    if (!s) return undefined;
    const a = parseDate(today()).getTime();
    const b = parseDate(s.slice(0, 10)).getTime();
    return Math.round((b - a) / 86400000);
};

export const daysSince = (s?: string) => {
    const d = daysUntil(s);
    return d === undefined ? undefined : -d;
};

export const money = (n?: number, compact = false) => {
    if (n === undefined || n === null || isNaN(n)) return '—';
    if (compact && Math.abs(n) >= 1000) {
        if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
        return `$${Math.round(n / 1000)}K`;
    }
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
};

export const fmtDate = (s?: string) => {
    if (!s) return '—';
    const d = parseDate(s.slice(0, 10));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const fmtLongDate = (s?: string) => {
    if (!s) return '';
    const d = parseDate(s.slice(0, 10));
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};

export const fmtTime = (s: string) => {
    const d = new Date(s);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

export const relDay = (s?: string) => {
    const d = daysUntil(s);
    if (d === undefined) return '—';
    if (d === 0) return 'Today';
    if (d === 1) return 'Tomorrow';
    if (d === -1) return 'Yesterday';
    if (d < 0) return `${-d}d ago`;
    if (d < 7) return `In ${d}d`;
    return fmtDate(s);
};

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export async function copyText(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
    }
}

export function monthlyPayment(price: number, downPct: number, ratePct: number, years: number) {
    const principal = price * (1 - downPct / 100);
    const r = ratePct / 100 / 12;
    const n = years * 12;
    if (r === 0) return principal / n;
    return (principal * r) / (1 - Math.pow(1 + r, -n));
}

/** relDay for mid-sentence use ("ends in 6d", "closes today", "closes Nov 13"). */
export const relDayInline = (s?: string) => {
    const r = relDay(s);
    return /^(In |Today|Tomorrow|Yesterday)/.test(r) ? r[0].toLowerCase() + r.slice(1) : r;
};
