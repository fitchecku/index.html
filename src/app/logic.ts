import type { AppData, Buyer, Financing, Home, Milestone, Stage } from './types';
import { addDays, daysSince, daysUntil, today } from './util';

export const STAGES: { key: Stage; label: string; short: string }[] = [
    { key: 'lead', label: 'New Lead', short: 'Lead' },
    { key: 'contacted', label: 'Contacted', short: 'Contacted' },
    { key: 'toured', label: 'Toured', short: 'Toured' },
    { key: 'qualified', label: 'Qualified', short: 'Qualified' },
    { key: 'contract', label: 'Under Contract', short: 'Contract' },
    { key: 'design', label: 'Design Selections', short: 'Design' },
    { key: 'construction', label: 'Under Construction', short: 'Build' },
    { key: 'pre-closing', label: 'Pre-Closing', short: 'Pre-Close' },
    { key: 'closed', label: 'Closed', short: 'Closed' },
    { key: 'lost', label: 'Lost / Inactive', short: 'Lost' }
];

export const stageLabel = (s: Stage) => STAGES.find((x) => x.key === s)?.label ?? s;
export const stageShort = (s: Stage) => STAGES.find((x) => x.key === s)?.short ?? s;

/** Stages that apply to a given sale type, in order. */
export const stagesFor = (b: Buyer): Stage[] =>
    b.saleType === 'bto'
        ? ['lead', 'contacted', 'toured', 'qualified', 'contract', 'design', 'construction', 'pre-closing', 'closed']
        : ['lead', 'contacted', 'toured', 'qualified', 'contract', 'pre-closing', 'closed'];

export const isActive = (b: Buyer) => b.stage !== 'closed' && b.stage !== 'lost';
export const isUnderContract = (b: Buyer) => ['contract', 'design', 'construction', 'pre-closing'].includes(b.stage);

export const FINANCING_LABEL: Record<Financing, string> = {
    unknown: 'Unknown',
    cash: 'Cash',
    prequal: 'Pre-qualified',
    preapproved: 'Pre-approved',
    underwriting: 'In underwriting',
    'clear-to-close': 'Clear to close'
};

export const DEFAULT_MILESTONES: Omit<Milestone, 'status'>[] = [
    { key: 'contract', label: 'Contract signed' },
    { key: 'design', label: 'Design center selections' },
    { key: 'permits', label: 'Permits & site prep' },
    { key: 'foundation', label: 'Foundation' },
    { key: 'framing', label: 'Framing' },
    { key: 'predrywall', label: 'Pre-drywall walkthrough' },
    { key: 'drywall', label: 'Drywall & interior trim' },
    { key: 'finishes', label: 'Finishes (cabinets, counters, flooring)' },
    { key: 'final', label: 'Final inspections' },
    { key: 'orientation', label: 'New home orientation / walkthrough' },
    { key: 'closing', label: 'Closing & keys' }
];

export const MILESTONE_INFO: Record<string, { next: string; buyerAction?: string; why: string }> = {
    contract: { why: 'Your home is officially on the way.', next: 'Design center selections', buyerAction: 'Watch for your design appointment invitation and start saving inspiration photos.' },
    design: { why: 'This is where the home becomes yours.', next: 'Permits and site preparation', buyerAction: 'Finalize and sign your selections by the design deadline.' },
    permits: { why: 'Permits and site work set the foundation for a smooth build.', next: 'Foundation' },
    foundation: { why: 'The foundation is poured and curing — a major structural step.', next: 'Framing' },
    framing: { why: 'Walls and roof go up — you can now see the rooms take shape.', next: 'Mechanical rough-ins and pre-drywall walkthrough' },
    predrywall: { why: 'You get to see what goes behind the walls — wiring, plumbing and structure.', next: 'Drywall and interior trim', buyerAction: 'Attend the pre-drywall walkthrough and bring questions.' },
    drywall: { why: 'The home starts to look and feel like a home.', next: 'Cabinets, counters and flooring' },
    finishes: { why: 'Your design selections come to life.', next: 'Final inspections' },
    final: { why: 'Inspections confirm the home meets code and quality standards.', next: 'New home orientation', buyerAction: 'Confirm homeowner insurance and utility transfers.' },
    orientation: { why: 'We walk the home together and learn how everything works.', next: 'Closing', buyerAction: 'Attend the orientation and note any items for follow-up.' },
    closing: { why: 'Keys in hand — welcome home!', next: 'Warranty and customer care check-ins' }
};

export const freshMilestones = (): Milestone[] =>
    DEFAULT_MILESTONES.map((m, i) => ({ ...m, status: i === 0 ? 'current' : 'pending' }));

/* -------------------------------- Scoring -------------------------------- */

const STAGE_BASE: Record<Stage, number> = {
    lead: 10,
    contacted: 20,
    toured: 35,
    qualified: 50,
    contract: 78,
    design: 82,
    construction: 86,
    'pre-closing': 92,
    closed: 100,
    lost: 0
};

export function likelihood(b: Buyer): number {
    if (b.stage === 'closed') return 100;
    if (b.stage === 'lost') return 0;
    let s = STAGE_BASE[b.stage];
    const contract = isUnderContract(b);
    const fin = b.financing;
    if (!contract) {
        if (fin === 'preapproved' || fin === 'cash') s += 10;
        else if (fin === 'prequal') s += 4;
        else if (fin === 'unknown') s -= 5;
        if (b.timeline === '0-30 days' || b.timeline === '1-3 months') s += 5;
        if (b.timeline === '6+ months') s -= 6;
        if (b.currentHome === 'own-must-sell') s -= 6;
        if (b.decisionMakers) s += 3;
        if (b.motivation) s += 3;
    } else {
        if (fin === 'unknown' || fin === 'prequal') s -= 12;
        if (fin === 'clear-to-close' || fin === 'cash') s += 5;
        if (b.currentHome === 'own-must-sell') s -= 5;
    }
    const since = daysSince(b.lastContact);
    if (since !== undefined) {
        if (since > 21) s -= 15;
        else if (since > 10) s -= 8;
        else if (since <= 3) s += 3;
    }
    return Math.max(1, Math.min(99, Math.round(s)));
}

export const weightedValue = (b: Buyer) => (isActive(b) ? ((b.price ?? b.budgetMax ?? 0) * likelihood(b)) / 100 : 0);

export const pipelineValue = (buyers: Buyer[]) => buyers.reduce((sum, b) => sum + weightedValue(b), 0);

/* -------------------------------- Risks -------------------------------- */

export interface Risk {
    level: 'high' | 'medium';
    text: string;
}

export function risks(b: Buyer, homes: Home[]): Risk[] {
    if (!isActive(b)) return [];
    const out: Risk[] = [];
    const since = daysSince(b.lastContact);
    const fu = daysUntil(b.nextFollowUp);
    const contract = isUnderContract(b);

    if (fu !== undefined && fu < 0) out.push({ level: 'high', text: `Follow-up overdue by ${-fu} day${fu === -1 ? '' : 's'}` });
    if (!b.nextFollowUp) out.push({ level: 'medium', text: 'No next follow-up scheduled' });
    if (since !== undefined && since > (contract ? 14 : 7))
        out.push({ level: since > 21 ? 'high' : 'medium', text: `No contact in ${since} days` });

    if (['qualified', 'toured'].includes(b.stage) && (b.financing === 'unknown' || b.financing === 'prequal'))
        out.push({ level: 'medium', text: 'Not pre-approved yet — connect with a lender' });
    if (contract && (b.financing === 'unknown' || b.financing === 'prequal'))
        out.push({ level: 'high', text: 'Under contract without full loan approval' });

    if (b.currentHome === 'own-must-sell') out.push({ level: 'medium', text: 'Must sell current home (contingency risk)' });
    if (!b.decisionMakers && !['lead', 'contacted'].includes(b.stage)) out.push({ level: 'medium', text: 'Decision makers not confirmed' });

    const home = homes.find((h) => h.id === b.homeId);
    if (home?.incentiveDeadline && !contract) {
        const d = daysUntil(home.incentiveDeadline);
        if (d !== undefined && d >= 0 && d <= 10)
            out.push({ level: 'medium', text: `Incentive on ${home.address} ends ${d === 0 ? 'today' : `in ${d}d`} (genuine deadline)` });
    }
    const price = b.price ?? home?.price;
    if (price && b.budgetMax && price > b.budgetMax * 1.05)
        out.push({ level: 'medium', text: 'Home price is above stated budget — review payment options' });

    const cd = daysUntil(b.closingDate);
    if (cd !== undefined && cd >= 0 && cd <= 21 && b.financing !== 'clear-to-close' && b.financing !== 'cash')
        out.push({ level: 'high', text: `Closing in ${cd}d and not clear to close` });

    if (b.stage === 'construction' && since !== undefined && since > 14)
        out.push({ level: 'medium', text: 'Construction buyer due for a milestone update' });

    return out;
}

export const needsAttention = (b: Buyer, homes: Home[]) => risks(b, homes).some((r) => r.level === 'high') || risks(b, homes).length >= 3;

/* -------------------------------- Qualification gaps -------------------------------- */

export const QUAL_FIELDS: { key: keyof Buyer; label: string; question: string }[] = [
    { key: 'motivation', label: 'Motivation', question: "What's prompting the move right now?" },
    { key: 'timeline', label: 'Timeline', question: 'When would you ideally like to be moved in?' },
    { key: 'budgetMax', label: 'Budget', question: 'What monthly payment range feels comfortable for you?' },
    { key: 'financing', label: 'Financing status', question: 'Have you had a chance to talk with a lender yet?' },
    { key: 'community', label: 'Desired community', question: 'Which areas or communities are you considering?' },
    { key: 'homeSize', label: 'Home size', question: 'How many bedrooms and how much space do you need day to day?' },
    { key: 'familyNeeds', label: 'Family needs', question: "Who'll be living in the home, and how do you use your space?" },
    { key: 'commute', label: 'Work commute', question: 'Where do you commute to, and what drive time works for you?' },
    { key: 'currentHome', label: 'Current home situation', question: 'Are you renting now, or would you need to sell a home?' },
    { key: 'decisionMakers', label: 'Decision makers', question: 'Who else will be part of the decision?' }
];

export function qualificationGaps(b: Buyer) {
    return QUAL_FIELDS.filter((f) => {
        const v = b[f.key];
        if (f.key === 'financing') return v === 'unknown';
        if (f.key === 'currentHome') return v === 'unknown';
        return v === undefined || v === '' || v === null;
    });
}

export const qualificationScore = (b: Buyer) => Math.round(((QUAL_FIELDS.length - qualificationGaps(b).length) / QUAL_FIELDS.length) * 100);

/* -------------------------------- Next action & cadence -------------------------------- */

export const CADENCE: Record<Stage, { days: number; method: string; why: string }> = {
    lead: { days: 1, method: 'Call, then text if no answer', why: 'Fast response on new leads builds trust and wins appointments.' },
    contacted: { days: 2, method: 'Text', why: 'Keep momentum toward a tour without pressure.' },
    toured: { days: 1, method: 'Email recap + text', why: 'Post-visit follow-up within 24 hours while the home is top of mind.' },
    qualified: { days: 3, method: 'Call', why: 'Help them compare options and resolve open questions.' },
    contract: { days: 7, method: 'Email', why: 'Weekly touchpoint sets expectations and prevents surprises.' },
    design: { days: 3, method: 'Text', why: 'Support selections and keep deadlines on track.' },
    construction: { days: 14, method: 'Email with photos', why: 'Milestone updates build excitement and trust during the build.' },
    'pre-closing': { days: 3, method: 'Call', why: 'Confirm lender, title, walkthrough and move-in logistics.' },
    closed: { days: 30, method: 'Text, then call', why: '30/90/365-day check-ins drive referrals and reviews.' },
    lost: { days: 60, method: 'Email', why: 'A light check-in keeps the door open without pressure.' }
};

export const suggestedFollowUp = (b: Buyer) => addDays(today(), CADENCE[b.stage].days);

export function nextAction(b: Buyer, homes: Home[]): string {
    const fu = daysUntil(b.nextFollowUp);
    const gaps = qualificationGaps(b);
    if (fu !== undefined && fu < 0) return `Follow up today — ${CADENCE[b.stage].method.toLowerCase()}`;
    switch (b.stage) {
        case 'lead':
            return 'Respond quickly and invite them for a personal community tour';
        case 'contacted':
            return gaps.length > 4 ? 'Book a discovery call or tour to learn their needs' : 'Schedule a community tour';
        case 'toured':
            return b.concerns ? `Send a post-visit recap that addresses: ${b.concerns}` : 'Send post-visit recap and ask what stood out';
        case 'qualified':
            if (b.financing === 'unknown' || b.financing === 'prequal') return 'Introduce a lender to get a full pre-approval';
            if (b.saleType === 'inventory') {
                const h = homes.find((x) => x.id === b.homeId);
                return h?.incentive ? `Review payment & incentive on ${h.address}` : 'Compare 2–3 move-in ready homes side by side';
            }
            return 'Walk through lot, plan options and the build timeline';
        case 'contract':
            return b.saleType === 'bto' ? 'Schedule the design center appointment' : 'Confirm lender docs, appraisal and closing timeline';
        case 'design':
            return 'Confirm selections deadline and answer design questions';
        case 'construction':
            return 'Send a milestone update with what happens next';
        case 'pre-closing':
            return 'Confirm walkthrough, title, utilities and closing logistics';
        case 'closed':
            return b.referralAsked ? 'Post-closing check-in and warranty reminder' : 'Check in and ask for a review or referral';
        default:
            return 'Light check-in to keep the door open';
    }
}

/* -------------------------------- Portfolio helpers -------------------------------- */

export function dueFollowUps(data: AppData) {
    return data.buyers
        .filter((b) => b.stage !== 'lost' && b.nextFollowUp && (daysUntil(b.nextFollowUp) ?? 99) <= 0)
        .sort((a, b) => (a.nextFollowUp ?? '').localeCompare(b.nextFollowUp ?? ''));
}

export function closingsThisMonth(buyers: Buyer[]) {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return buyers.filter((b) => b.closingDate?.startsWith(ym) && b.stage !== 'lost');
}

export function matchingHomes(b: Buyer, homes: Home[]) {
    const beds = parseInt(b.homeSize ?? '', 10);
    return homes
        .filter((h) => h.status === 'available')
        .map((h) => {
            let score = 0;
            if (b.budgetMax) score += h.price <= b.budgetMax ? 3 : h.price <= b.budgetMax * 1.05 ? 1 : -3;
            if (!isNaN(beds)) score += h.beds >= beds ? 2 : -2;
            if (b.community && h.community.toLowerCase().includes(b.community.toLowerCase())) score += 2;
            if (b.saleType === 'inventory' && h.moveIn) score += 1;
            return { h, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.h)
        .slice(0, 3);
}
