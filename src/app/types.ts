export type SaleType = 'inventory' | 'bto';

export type Stage =
    | 'lead'
    | 'contacted'
    | 'toured'
    | 'qualified'
    | 'contract'
    | 'design'
    | 'construction'
    | 'pre-closing'
    | 'closed'
    | 'lost';

export type Financing = 'unknown' | 'cash' | 'prequal' | 'preapproved' | 'underwriting' | 'clear-to-close';
export type CurrentHome = 'unknown' | 'renting' | 'own-must-sell' | 'own-no-contingency' | 'other';
export type Timeline = '' | '0-30 days' | '1-3 months' | '3-6 months' | '6+ months';

export interface Interaction {
    id: string;
    date: string; // ISO datetime
    type: 'call' | 'text' | 'email' | 'visit' | 'meeting' | 'note';
    summary: string;
}

export interface Milestone {
    key: string;
    label: string;
    status: 'pending' | 'current' | 'done';
    date?: string; // YYYY-MM-DD
    confirmed?: boolean; // only confirmed dates are shared with buyers
}

export interface Buyer {
    id: string;
    name: string;
    partner?: string;
    email?: string;
    phone?: string;
    source?: string;
    saleType: SaleType;
    stage: Stage;
    community?: string;
    homeId?: string;
    plan?: string;
    price?: number;
    budgetMax?: number;
    timeline: Timeline;
    financing: Financing;
    lender?: string;
    motivation?: string;
    homeSize?: string;
    familyNeeds?: string;
    commute?: string;
    currentHome: CurrentHome;
    decisionMakers?: string;
    mustHaves?: string;
    niceToHaves?: string;
    concerns?: string;
    lastContact?: string; // ISO
    nextFollowUp?: string; // YYYY-MM-DD
    contractDate?: string;
    closingDate?: string;
    referralAsked?: boolean;
    starred?: boolean;
    milestones?: Milestone[];
    interactions: Interaction[];
    createdAt: string;
}

export type TaskCategory = 'priority' | 'deadline' | 'followup' | 'internal' | 'question';

export interface Task {
    id: string;
    title: string;
    category: TaskCategory;
    due?: string; // YYYY-MM-DD
    buyerId?: string;
    done: boolean;
    createdAt: string;
}

export interface Home {
    id: string;
    address: string;
    community: string;
    plan: string;
    beds: number;
    baths: number;
    sqft: number;
    price: number;
    status: 'available' | 'hold' | 'sold';
    moveIn?: string; // YYYY-MM-DD
    incentive?: string;
    incentiveDeadline?: string;
}

export interface Competitor {
    id: string;
    builder: string;
    community: string;
    priceFrom?: number;
    included?: string;
    incentives?: string;
    floorPlans?: string;
    quality?: string;
    reputation?: string;
    warranty?: string;
    buildTime?: string;
    amenities?: string;
    experience?: string;
    verifiedOn?: string;
}

export type ApptType = 'tour' | 'discovery' | 'design' | 'construction' | 'contract' | 'closing' | 'internal' | 'follow-up' | 'other';

export interface Appointment {
    id: string;
    title: string;
    buyerId?: string;
    type: ApptType;
    start: string; // YYYY-MM-DDTHH:mm
    duration: number; // minutes
    location?: string;
}

export interface Settings {
    name: string;
    builder: string;
    community: string;
    phone: string;
    email: string;
    rate: number;
    taxRate: number;
    insurance: number;
    hoa: number;
}

export interface AppData {
    version: 1;
    buyers: Buyer[];
    tasks: Task[];
    homes: Home[];
    competitors: Competitor[];
    appointments: Appointment[];
    settings: Settings;
    history: { date: string; value: number }[];
    isSample: boolean;
}
