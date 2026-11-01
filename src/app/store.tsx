import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppData, Buyer, Milestone, Settings } from './types';
import { DEFAULT_MILESTONES, pipelineValue } from './logic';
import { addDays, today, toDateTime, uid } from './util';

const KEY = 'homesales-assistant-v1';

export const DEFAULT_SETTINGS: Settings = {
    name: 'Your Name',
    builder: 'Your Builder',
    community: 'Your Community',
    phone: '',
    email: '',
    rate: 6.5,
    taxRate: 1.1,
    insurance: 1500,
    hoa: 75
};

const ago = (days: number, hour = 10) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(hour, 0, 0, 0);
    return toDateTime(d);
};
const at = (daysFromNow: number, hour: number, min = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, min, 0, 0);
    return toDateTime(d);
};

function milestonesUpTo(currentKey: string, confirmedDates: Record<string, string> = {}): Milestone[] {
    const idx = DEFAULT_MILESTONES.findIndex((m) => m.key === currentKey);
    return DEFAULT_MILESTONES.map((m, i) => ({
        ...m,
        status: i < idx ? 'done' : i === idx ? 'current' : 'pending',
        date: confirmedDates[m.key],
        confirmed: !!confirmedDates[m.key]
    }));
}

export function sampleData(): AppData {
    const t = today();
    const homes = [
        { id: 'h1', address: '1421 Willow Bend Dr', community: 'Willow Creek', plan: 'The Aspen', beds: 4, baths: 3, sqft: 2410, price: 459900, status: 'available' as const, moveIn: addDays(t, 21), incentive: '$15K toward closing costs or rate buydown', incentiveDeadline: addDays(t, 6) },
        { id: 'h2', address: '1433 Willow Bend Dr', community: 'Willow Creek', plan: 'The Birch', beds: 3, baths: 2, sqft: 1880, price: 399900, status: 'available' as const, moveIn: addDays(t, 3), incentive: 'Refrigerator + blinds package' },
        { id: 'h3', address: '208 Meadow Lark Ln', community: 'Meadow Ridge', plan: 'The Cedar', beds: 5, baths: 3.5, sqft: 3120, price: 549900, status: 'available' as const, moveIn: addDays(t, 45) },
        { id: 'h4', address: '215 Meadow Lark Ln', community: 'Meadow Ridge', plan: 'The Aspen', beds: 4, baths: 3, sqft: 2410, price: 474900, status: 'hold' as const, moveIn: addDays(t, 30) }
    ];
    const mk = (b: Partial<Buyer> & Pick<Buyer, 'name' | 'stage' | 'saleType'>): Buyer => ({
        id: uid(),
        timeline: '',
        financing: 'unknown',
        currentHome: 'unknown',
        interactions: [],
        createdAt: ago(30),
        ...b
    });
    const buyers: Buyer[] = [
        mk({ name: 'Jordan & Taylor Reyes', stage: 'qualified', saleType: 'inventory', community: 'Willow Creek', homeId: 'h1', price: 459900, budgetMax: 470000, timeline: '0-30 days', financing: 'preapproved', lender: 'Preferred Lender', motivation: 'Lease ends next month', homeSize: '4', familyNeeds: 'Two kids, home office', commute: 'Downtown, 25 min', currentHome: 'renting', decisionMakers: 'Both spouses', mustHaves: 'Office, fenced yard', concerns: 'Monthly payment', lastContact: ago(2), nextFollowUp: t, starred: true, source: 'Website', email: 'reyes@example.com', phone: '555-0101', interactions: [{ id: uid(), date: ago(2), type: 'visit', summary: 'Toured 1421 Willow Bend. Loved kitchen and office. Asked about payment with incentive.' }] }),
        mk({ name: 'Priya Natarajan', stage: 'construction', saleType: 'bto', community: 'Meadow Ridge', plan: 'The Cedar', price: 562000, timeline: '3-6 months', financing: 'underwriting', lender: 'Preferred Lender', motivation: 'Growing family', homeSize: '5', familyNeeds: 'Parents visit often — needs guest suite', currentHome: 'own-no-contingency', decisionMakers: 'Priya and husband Dev', contractDate: addDays(t, -70), closingDate: addDays(t, 75), lastContact: ago(16), nextFollowUp: addDays(t, -1), milestones: milestonesUpTo('framing', { contract: addDays(t, -70), design: addDays(t, -55), predrywall: addDays(t, 12) }), email: 'priya@example.com', phone: '555-0102', starred: true }),
        mk({ name: 'Marcus Bell', stage: 'lead', saleType: 'inventory', source: 'Zillow', lastContact: undefined, nextFollowUp: t, email: 'mbell@example.com', phone: '555-0103', createdAt: ago(0) }),
        mk({ name: 'The Okafor Family', stage: 'toured', saleType: 'bto', community: 'Meadow Ridge', budgetMax: 520000, timeline: '6+ months', financing: 'prequal', motivation: 'Want a newer home, more space', homeSize: '4', currentHome: 'own-must-sell', concerns: 'Interest rates, build timeline', lastContact: ago(9), nextFollowUp: addDays(t, -2), email: 'okafor@example.com', phone: '555-0104' }),
        mk({ name: 'Elena Park', stage: 'pre-closing', saleType: 'inventory', community: 'Willow Creek', homeId: 'h2', price: 399900, financing: 'underwriting', lender: 'Preferred Lender', timeline: '0-30 days', currentHome: 'renting', decisionMakers: 'Elena', motivation: 'First home', contractDate: addDays(t, -24), closingDate: addDays(t, 12), lastContact: ago(3), nextFollowUp: addDays(t, 1), email: 'elena@example.com', phone: '555-0105' }),
        mk({ name: 'Sam & Riley Chen', stage: 'design', saleType: 'bto', community: 'Willow Creek', plan: 'The Aspen', price: 486500, financing: 'preapproved', timeline: '3-6 months', currentHome: 'renting', decisionMakers: 'Both', contractDate: addDays(t, -10), lastContact: ago(4), nextFollowUp: addDays(t, 2), milestones: milestonesUpTo('design', { contract: addDays(t, -10), design: addDays(t, 5) }), email: 'chen@example.com', phone: '555-0106' }),
        mk({ name: 'Dana Whitfield', stage: 'closed', saleType: 'inventory', community: 'Willow Creek', price: 438000, financing: 'clear-to-close', closingDate: addDays(t, -35), lastContact: ago(30), nextFollowUp: addDays(t, 1), referralAsked: false, email: 'dana@example.com', phone: '555-0107' }),
        mk({ name: 'Chris Alvarez', stage: 'contacted', saleType: 'inventory', budgetMax: 420000, timeline: '1-3 months', motivation: 'Relocating for work', commute: 'Tech park', lastContact: ago(4), nextFollowUp: addDays(t, 1), email: 'chris@example.com', phone: '555-0108' })
    ];
    const byName = (n: string) => buyers.find((b) => b.name.startsWith(n))!.id;

    const data: AppData = {
        version: 1,
        isSample: true,
        settings: { ...DEFAULT_SETTINGS },
        homes,
        buyers,
        appointments: [
            { id: uid(), title: 'Tour — Marcus Bell', buyerId: byName('Marcus'), type: 'tour', start: at(0, 10, 0), duration: 60, location: 'Willow Creek Model' },
            { id: uid(), title: 'Payment review — Reyes', buyerId: byName('Jordan'), type: 'follow-up', start: at(0, 11, 0), duration: 45, location: 'Willow Creek Model' },
            { id: uid(), title: 'Weekly sales meeting', type: 'internal', start: at(0, 14, 0), duration: 60, location: 'Division office' },
            { id: uid(), title: 'Final walkthrough — Elena Park', buyerId: byName('Elena'), type: 'closing', start: at(2, 9, 30), duration: 90, location: '1433 Willow Bend Dr' },
            { id: uid(), title: 'Design center — Chen', buyerId: byName('Sam'), type: 'design', start: at(5, 13, 0), duration: 180, location: 'Design Studio' }
        ],
        tasks: [
            { id: uid(), title: 'Send Reyes payment comparison with $15K incentive', category: 'priority', due: t, buyerId: byName('Jordan'), done: false, createdAt: ago(1) },
            { id: uid(), title: 'Confirm pre-drywall date with PM for Natarajan', category: 'internal', due: addDays(t, 1), buyerId: byName('Priya'), done: false, createdAt: ago(1) },
            { id: uid(), title: 'Ask title for Park closing disclosure status', category: 'deadline', due: addDays(t, 3), buyerId: byName('Elena'), done: false, createdAt: ago(1) },
            { id: uid(), title: 'Can the Okafors add a home-sale contingency on a BTO?', category: 'question', buyerId: byName('The Okafor'), done: false, createdAt: ago(2) },
            { id: uid(), title: 'Update Q4 competitor incentives sheet', category: 'internal', due: addDays(t, 4), done: false, createdAt: ago(3) }
        ],
        competitors: [
            { id: uid(), builder: 'Example Builder A', community: 'Oak Hollow', priceFrom: 429000, incentives: '[verify] Rate buydown on select homes', warranty: '[verify] 1/2/10', buildTime: '[verify] 5–7 months', verifiedOn: '' }
        ],
        history: []
    };
    // Sample 90-day trend ending at today's value
    const end = pipelineValue(buyers);
    let v = end * 0.78;
    for (let i = 90; i >= 1; i--) {
        v += (end - v) / (i + 6) + (Math.sin(i * 1.7) * end) / 90;
        data.history.push({ date: addDays(t, -i), value: Math.round(v) });
    }
    data.history.push({ date: t, value: Math.round(end) });
    return data;
}

export function emptyData(settings = DEFAULT_SETTINGS): AppData {
    return { version: 1, isSample: false, settings, buyers: [], tasks: [], homes: [], competitors: [], appointments: [], history: [] };
}

/** Fill in any missing fields so older or hand-edited backups can't crash the app. Returns null if unusable. */
export function normalize(raw: unknown): AppData | null {
    if (!raw || typeof raw !== 'object') return null;
    const d = raw as Partial<AppData>;
    if (d.version !== 1 || !Array.isArray(d.buyers)) return null;
    const arr = <T,>(v: T[] | undefined) => (Array.isArray(v) ? v : []);
    return {
        ...emptyData(),
        ...d,
        version: 1,
        isSample: !!d.isSample,
        settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
        buyers: d.buyers
            .filter((b) => b && typeof b === 'object' && b.id && b.name)
            .map((b) => ({ timeline: '', financing: 'unknown', currentHome: 'unknown', saleType: 'inventory', stage: 'lead', createdAt: toDateTime(new Date()), ...b, interactions: arr(b.interactions) }) as Buyer),
        tasks: arr(d.tasks),
        homes: arr(d.homes),
        competitors: arr(d.competitors),
        appointments: arr(d.appointments),
        history: arr(d.history)
    };
}

function load(): AppData {
    let raw: string | null = null;
    try {
        raw = localStorage.getItem(KEY);
    } catch {
        return sampleData(); // storage blocked (private mode etc.)
    }
    if (!raw) return sampleData();
    try {
        const d = normalize(JSON.parse(raw));
        if (d) return d;
    } catch {
        /* corrupt JSON */
    }
    // Never silently overwrite unreadable data — park a copy so it can be recovered.
    try {
        localStorage.setItem(`${KEY}-recovery-${Date.now()}`, raw);
    } catch {
        /* ignore */
    }
    return sampleData();
}

/** Record today's weighted pipeline value so the chart builds real history over time. */
function withSnapshot(d: AppData): AppData {
    const t = today();
    const value = Math.round(pipelineValue(d.buyers));
    const last = d.history[d.history.length - 1];
    if (last && last.date === t) {
        if (last.value === value) return d;
        return { ...d, history: [...d.history.slice(0, -1), { date: t, value }] };
    }
    return { ...d, history: [...d.history, { date: t, value }].slice(-730) };
}

interface Ctx {
    data: AppData;
    update: (fn: (d: AppData) => AppData) => void;
    replace: (d: AppData) => void;
    saveBuyer: (b: Buyer) => void;
    toast: (msg: string) => void;
    toastMsg: string;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
    const [data, setData] = useState<AppData>(() => withSnapshot(load()));
    const [toastMsg, setToast] = useState('');
    const timer = useRef<number>();

    const toast = useCallback((msg: string) => {
        setToast(msg);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setToast(''), 2200);
    }, []);

    const lastSaved = useRef('');
    const warned = useRef(false);
    useEffect(() => {
        const json = JSON.stringify(data);
        if (json === lastSaved.current) return;
        try {
            localStorage.setItem(KEY, json);
            lastSaved.current = json;
            warned.current = false;
        } catch {
            if (!warned.current) {
                warned.current = true;
                toast('⚠ Could not save — export a backup in Settings');
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    // Keep multiple open tabs/windows in sync instead of overwriting each other.
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key !== KEY || !e.newValue || e.newValue === lastSaved.current) return;
            try {
                const d = normalize(JSON.parse(e.newValue));
                if (d) {
                    lastSaved.current = e.newValue;
                    setData(d);
                }
            } catch {
                /* ignore */
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => withSnapshot(fn(d))), []);
    const replace = useCallback((d: AppData) => setData(withSnapshot(normalize(d) ?? d)), []);
    const saveBuyer = useCallback(
        (b: Buyer) =>
            update((d) => ({
                ...d,
                buyers: d.buyers.some((x) => x.id === b.id) ? d.buyers.map((x) => (x.id === b.id ? b : x)) : [b, ...d.buyers]
            })),
        [update]
    );

    return <StoreCtx.Provider value={{ data, update, replace, saveBuyer, toast, toastMsg }}>{children}</StoreCtx.Provider>;
}

export function useStore() {
    const c = useContext(StoreCtx);
    if (!c) throw new Error('StoreProvider missing');
    return c;
}
