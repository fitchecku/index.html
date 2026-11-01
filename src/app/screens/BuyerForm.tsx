import { useState } from 'react';
import type { Buyer, CurrentHome, Financing, SaleType, Stage, Timeline } from '../types';
import { useStore } from '../store';
import { FINANCING_LABEL, STAGES, freshMilestones, suggestedFollowUp } from '../logic';
import { Field, Segmented, Sheet } from '../ui';
import { toDateTime, uid } from '../util';

export function newBuyer(): Buyer {
    const b: Buyer = {
        id: uid(),
        name: '',
        saleType: 'inventory',
        stage: 'lead',
        timeline: '',
        financing: 'unknown',
        currentHome: 'unknown',
        interactions: [],
        createdAt: toDateTime(new Date())
    };
    b.nextFollowUp = suggestedFollowUp(b);
    return b;
}

export default function BuyerForm({ initial, onClose, onSaved }: { initial: Buyer; onClose: () => void; onSaved?: (b: Buyer) => void }) {
    const { data, saveBuyer, toast } = useStore();
    const [b, setB] = useState<Buyer>(initial);
    const set = <K extends keyof Buyer>(k: K, v: Buyer[K]) => setB((p) => ({ ...p, [k]: v }));
    const str = (k: keyof Buyer) => ({
        value: (b[k] as string | undefined) ?? '',
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, (e.target.value || undefined) as never)
    });
    const num = (k: 'price' | 'budgetMax') => ({
        value: b[k] ?? '',
        inputMode: 'numeric' as const,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            const n = parseFloat(e.target.value.replace(/[^0-9.]/g, ''));
            set(k, isNaN(n) ? undefined : n);
        }
    });

    const save = () => {
        if (!b.name.trim()) return toast('Add a name first');
        let out = { ...b, name: b.name.trim() };
        if (out.saleType === 'inventory' && (out.stage === 'design' || out.stage === 'construction')) out.stage = 'contract';
        if (out.saleType === 'bto' && !out.milestones) out.milestones = freshMilestones();
        const home = data.homes.find((h) => h.id === out.homeId);
        if (home && !out.price) out = { ...out, price: home.price, community: out.community ?? home.community, plan: out.plan ?? home.plan };
        saveBuyer(out);
        toast('Saved');
        onSaved?.(out);
        onClose();
    };

    return (
        <Sheet title={initial.name ? `Edit ${initial.name}` : 'New buyer'} onClose={onClose}>
            <Field label="Name(s)">
                <input {...str('name')} placeholder="e.g., Jordan & Taylor Reyes" autoFocus />
            </Field>
            <Segmented<SaleType>
                value={b.saleType}
                onChange={(v) => setB((p) => ({ ...p, saleType: v, stage: v === 'inventory' && (p.stage === 'design' || p.stage === 'construction') ? 'contract' : p.stage }))}
                options={[
                    { value: 'inventory', label: 'Move-in ready' },
                    { value: 'bto', label: 'Build-to-order' }
                ]}
            />
            <div className="grid2">
                <Field label="Stage">
                    <select value={b.stage} onChange={(e) => set('stage', e.target.value as Stage)}>
                        {STAGES.filter((s) => b.saleType === 'bto' || !['design', 'construction'].includes(s.key)).map((s) => (
                            <option key={s.key} value={s.key}>
                                {s.label}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Source">
                    <input {...str('source')} placeholder="Website, Zillow, walk-in…" />
                </Field>
                <Field label="Phone">
                    <input {...str('phone')} type="tel" />
                </Field>
                <Field label="Email">
                    <input {...str('email')} type="email" />
                </Field>
            </div>

            <h4 className="form-h">Qualification</h4>
            <div className="grid2">
                <Field label="Motivation">
                    <input {...str('motivation')} placeholder="Why move now?" />
                </Field>
                <Field label="Timeline">
                    <select value={b.timeline} onChange={(e) => set('timeline', e.target.value as Timeline)}>
                        <option value="">Unknown</option>
                        {['0-30 days', '1-3 months', '3-6 months', '6+ months'].map((t) => (
                            <option key={t}>{t}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Budget (max price)">
                    <input {...num('budgetMax')} placeholder="$" />
                </Field>
                <Field label="Financing">
                    <select value={b.financing} onChange={(e) => set('financing', e.target.value as Financing)}>
                        {Object.entries(FINANCING_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Lender">
                    <input {...str('lender')} />
                </Field>
                <Field label="Desired community">
                    <input {...str('community')} list="communities" />
                </Field>
                <Field label="Bedrooms needed">
                    <input {...str('homeSize')} inputMode="numeric" placeholder="e.g., 4" />
                </Field>
                <Field label="Current home">
                    <select value={b.currentHome} onChange={(e) => set('currentHome', e.target.value as CurrentHome)}>
                        <option value="unknown">Unknown</option>
                        <option value="renting">Renting</option>
                        <option value="own-must-sell">Owns — must sell</option>
                        <option value="own-no-contingency">Owns — no sale needed</option>
                        <option value="other">Other</option>
                    </select>
                </Field>
                <Field label="Family needs">
                    <input {...str('familyNeeds')} />
                </Field>
                <Field label="Work commute">
                    <input {...str('commute')} />
                </Field>
            </div>
            <Field label="Decision makers">
                <input {...str('decisionMakers')} placeholder="Who else decides?" />
            </Field>
            <Field label="Must-haves">
                <input {...str('mustHaves')} />
            </Field>
            <Field label="Nice-to-haves">
                <input {...str('niceToHaves')} />
            </Field>
            <Field label="Concerns / objections">
                <input {...str('concerns')} placeholder="e.g., interest rates, timeline" />
            </Field>

            <h4 className="form-h">Home & dates</h4>
            <div className="grid2">
                <Field label="Inventory home">
                    <select value={b.homeId ?? ''} onChange={(e) => set('homeId', e.target.value || undefined)}>
                        <option value="">—</option>
                        {data.homes.map((h) => (
                            <option key={h.id} value={h.id}>
                                {h.address}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Plan">
                    <input {...str('plan')} />
                </Field>
                <Field label="Price">
                    <input {...num('price')} placeholder="$" />
                </Field>
                <Field label="Next follow-up">
                    <input type="date" {...str('nextFollowUp')} />
                </Field>
                <Field label="Contract date">
                    <input type="date" {...str('contractDate')} />
                </Field>
                <Field label="Closing date">
                    <input type="date" {...str('closingDate')} />
                </Field>
            </div>
            <datalist id="communities">
                {[...new Set([data.settings.community, ...data.homes.map((h) => h.community)])].map((c) => (
                    <option key={c} value={c} />
                ))}
            </datalist>
            <div className="sticky-actions">
                <button className="btn" onClick={onClose}>
                    Cancel
                </button>
                <button className="btn primary" onClick={save}>
                    Save buyer
                </button>
            </div>
        </Sheet>
    );
}
