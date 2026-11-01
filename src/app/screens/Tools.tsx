import { useRef, useState } from 'react';
import type { Competitor, Home } from '../types';
import { useStore, emptyData, normalize, sampleData } from '../store';
import { useNav } from '../App';
import { DraftBox, Field, Icon, Pill, SectionHead, Sheet } from '../ui';
import { DECISION_SECTIONS, DISCOVERY, OBJECTIONS, RESEARCH_SECTIONS } from '../templates';
import { CADENCE, STAGES } from '../logic';
import { copyText, fmtDate, money, monthlyPayment, relDayInline, today, uid } from '../util';

const TILES = [
    { key: 'objections', title: 'Objection Handling', sub: 'Acknowledge → explore → respond', icon: 'msg' },
    { key: 'discovery', title: 'Discovery Questions', sub: 'Conversation, not interrogation', icon: 'search' },
    { key: 'calculator', title: 'Payment Calculator', sub: 'Compare scenarios side by side', icon: 'grid' },
    { key: 'inventory', title: 'Inventory Homes', sub: 'Availability, incentives, compare', icon: 'home' },
    { key: 'competitors', title: 'Competitor Intel', sub: 'Objective, verified comparisons', icon: 'users' },
    { key: 'cadence', title: 'Follow-Up Playbook', sub: 'When and how to reach out', icon: 'clock' },
    { key: 'briefs', title: 'Research & Decisions', sub: 'Structured briefs', icon: 'pen' },
    { key: 'settings', title: 'Settings & Backup', sub: 'Profile, export, import', icon: 'gear' }
];

export default function Tools({ tool }: { tool?: string }) {
    const { go, back } = useNav();
    if (!tool)
        return (
            <div>
                <header className="topbar">
                    <h1>Playbook</h1>
                </header>
                <div className="tiles">
                    {TILES.map((t) => (
                        <button key={t.key} className="tile" onClick={() => go({ tab: 'tools', tool: t.key })}>
                            <Icon name={t.icon} size={22} />
                            <strong>{t.title}</strong>
                            <small>{t.sub}</small>
                        </button>
                    ))}
                </div>
            </div>
        );
    const t = TILES.find((x) => x.key === tool)!;
    return (
        <div>
            <header className="topbar">
                <button className="icon-btn" onClick={() => back({ tab: 'tools' })} aria-label="Back">
                    <Icon name="back" />
                </button>
                <h1 className="h-sm">{t.title}</h1>
                <span style={{ width: 36 }} />
            </header>
            {tool === 'objections' && <Objections />}
            {tool === 'discovery' && <Discovery />}
            {tool === 'calculator' && <Calculator />}
            {tool === 'inventory' && <Inventory />}
            {tool === 'competitors' && <Competitors />}
            {tool === 'cadence' && <Cadence />}
            {tool === 'briefs' && <Briefs />}
            {tool === 'settings' && <SettingsView />}
        </div>
    );
}

function Objections() {
    const [open, setOpen] = useState<string | null>(OBJECTIONS[0].key);
    const { toast } = useStore();
    return (
        <div className="list">
            <p className="muted small">Always acknowledge first, then provide factual, balanced guidance. Never manufacture urgency.</p>
            {OBJECTIONS.map((o) => (
                <div key={o.key} className={`accordion ${open === o.key ? 'open' : ''}`}>
                    <button className="acc-head" onClick={() => setOpen(open === o.key ? null : o.key)}>
                        <strong>{o.title}</strong>
                        <Icon name="chev" size={16} />
                    </button>
                    {open === o.key && (
                        <div className="acc-body">
                            <div className="step-label">1 · Acknowledge</div>
                            <p className="quote" onClick={() => copyText(o.acknowledge).then(() => toast('Copied'))}>
                                “{o.acknowledge}”
                            </p>
                            <div className="step-label">2 · Explore</div>
                            <ul>
                                {o.explore.map((x) => (
                                    <li key={x}>“{x}”</li>
                                ))}
                            </ul>
                            <div className="step-label">3 · Respond with facts</div>
                            <ul>
                                {o.respond.map((x) => (
                                    <li key={x}>{x}</li>
                                ))}
                            </ul>
                            <div className="avoid">Avoid: {o.avoid}</div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function Discovery() {
    const { toast } = useStore();
    const all = DISCOVERY.map((d) => `${d.topic}\n${d.questions.map((q) => `• ${q}`).join('\n')}`).join('\n\n');
    return (
        <>
            <p className="muted small">Pick 1–2 per topic and follow their lead. Listen more than you talk; reflect back what you hear.</p>
            {DISCOVERY.map((d) => (
                <div key={d.topic}>
                    <SectionHead title={d.topic} />
                    <ul className="qlist">
                        {d.questions.map((q) => (
                            <li key={q}>{q}</li>
                        ))}
                    </ul>
                </div>
            ))}
            <button className="btn" style={{ marginTop: 16 }} onClick={() => copyText(all).then(() => toast('Copied all questions'))}>
                <Icon name="copy" size={16} /> Copy all
            </button>
        </>
    );
}

function Calculator() {
    const { data } = useStore();
    const s = data.settings;
    const mk = (price: number, rate: number) => ({ price, down: 10, rate, years: 30, credit: 0 });
    const [a, setA] = useState(mk(data.homes[0]?.price ?? 450000, s.rate));
    const [b, setB] = useState(mk(data.homes[0]?.price ?? 450000, Math.max(0, s.rate - 1)));
    const calc = (x: typeof a) => {
        const pi = monthlyPayment(x.price - x.credit, x.down, x.rate, x.years);
        const tax = (x.price * s.taxRate) / 100 / 12;
        const ins = s.insurance / 12;
        return { pi, tax, ins, hoa: s.hoa, total: pi + tax + ins + s.hoa, cash: (x.price * x.down) / 100 };
    };
    const ra = calc(a),
        rb = calc(b);
    const diff = rb.total - ra.total;
    const col = (x: typeof a, set: (v: typeof a) => void, r: ReturnType<typeof calc>, label: string) => (
        <div className="calc-col">
            <div className="eyebrow">{label}</div>
            <div className="big-number sm">{money(r.total)}</div>
            <div className="muted small">/ month est.</div>
            <Field label="Price">
                <input inputMode="numeric" value={x.price} onChange={(e) => set({ ...x, price: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
            </Field>
            <Field label="Down %">
                <input type="number" step={0.5} value={x.down} onChange={(e) => set({ ...x, down: Number(e.target.value) })} />
            </Field>
            <Field label="Rate %">
                <input type="number" step={0.125} value={x.rate} onChange={(e) => set({ ...x, rate: Number(e.target.value) })} />
            </Field>
            <Field label="Price reduction $">
                <input inputMode="numeric" value={x.credit} onChange={(e) => set({ ...x, credit: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
            </Field>
            <div className="kv-list small">
                <div>
                    <span>Principal & interest</span>
                    <strong>{money(r.pi)}</strong>
                </div>
                <div>
                    <span>Taxes</span>
                    <strong>{money(r.tax)}</strong>
                </div>
                <div>
                    <span>Insurance</span>
                    <strong>{money(r.ins)}</strong>
                </div>
                <div>
                    <span>HOA</span>
                    <strong>{money(r.hoa)}</strong>
                </div>
                <div>
                    <span>Down payment</span>
                    <strong>{money(r.cash)}</strong>
                </div>
            </div>
        </div>
    );
    return (
        <>
            <div className="calc">
                {col(a, setA, ra, 'Scenario A')}
                {col(b, setB, rb, 'Scenario B')}
            </div>
            <div className={`card center ${diff <= 0 ? 'pos' : 'neg'}`}>
                Scenario B is <strong>{money(Math.abs(diff))}</strong> {diff <= 0 ? 'lower' : 'higher'} per month.
            </div>
            <p className="fine">
                Estimates only, for conversation. Tax {s.taxRate}%, insurance {money(s.insurance)}/yr and HOA {money(s.hoa)}/mo come from Settings. Always have the buyer's lender confirm exact payments, rates and buydown costs.
            </p>
        </>
    );
}

function Inventory() {
    const { data, update } = useStore();
    const [edit, setEdit] = useState<Home | null>(null);
    const [compare, setCompare] = useState<string[]>([]);
    const homes = [...data.homes].sort((a, b) => a.status.localeCompare(b.status) || a.price - b.price);
    const cmp = data.homes.filter((h) => compare.includes(h.id));
    return (
        <>
            <div className="row between">
                <span className="muted small">Tap to edit · check up to 3 to compare</span>
                <button className="btn primary sm" onClick={() => setEdit({ id: uid(), address: '', community: data.settings.community, plan: '', beds: 3, baths: 2, sqft: 2000, price: 0, status: 'available' })}>
                    <Icon name="plus" size={16} /> Home
                </button>
            </div>
            <div className="list">
                {homes.map((h) => {
                    const dl = h.incentiveDeadline ? relDayInline(h.incentiveDeadline) : '';
                    return (
                        <div key={h.id} className="row-item tall">
                            <input
                                type="checkbox"
                                checked={compare.includes(h.id)}
                                onChange={(e) => setCompare(e.target.checked ? [...compare, h.id].slice(-3) : compare.filter((x) => x !== h.id))}
                                aria-label={`Compare ${h.address}`}
                            />
                            <button className="row-main" onClick={() => setEdit(h)}>
                                <div className="row-title">{h.address}</div>
                                <div className="row-sub">
                                    {h.plan} · {h.beds} bd / {h.baths} ba · {h.sqft.toLocaleString()} sf
                                </div>
                                {h.incentive && (
                                    <div className="row-sub pos">
                                        {h.incentive}
                                        {dl && ` · ends ${dl}`}
                                    </div>
                                )}
                            </button>
                            <div className="row-right">
                                <div className="row-price">{money(h.price, true)}</div>
                                <Pill tone={h.status === 'available' ? 'green' : h.status === 'hold' ? 'amber' : 'red'}>{h.status}</Pill>
                                {h.moveIn && <small className="muted">Ready {fmtDate(h.moveIn)}</small>}
                            </div>
                        </div>
                    );
                })}
                {!homes.length && <div className="empty">Add your move-in ready homes to match them to buyers.</div>}
            </div>
            {cmp.length >= 2 && (
                <>
                    <SectionHead title="Compare" />
                    <div className="table-wrap">
                        <table className="cmp">
                            <thead>
                                <tr>
                                    <th />
                                    {cmp.map((h) => (
                                        <th key={h.id}>{h.address}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(
                                    [
                                        ['Price', (h: Home) => money(h.price)],
                                        ['Est. payment', (h: Home) => money(monthlyPayment(h.price, 10, data.settings.rate, 30) + (h.price * data.settings.taxRate) / 1200 + data.settings.insurance / 12 + data.settings.hoa)],
                                        ['$/sq ft', (h: Home) => money(h.price / h.sqft)],
                                        ['Plan', (h: Home) => h.plan],
                                        ['Beds / baths', (h: Home) => `${h.beds} / ${h.baths}`],
                                        ['Sq ft', (h: Home) => h.sqft.toLocaleString()],
                                        ['Move-in', (h: Home) => (h.moveIn ? fmtDate(h.moveIn) : '—')],
                                        ['Incentive', (h: Home) => h.incentive ?? '—'],
                                        ['Incentive ends', (h: Home) => (h.incentiveDeadline ? fmtDate(h.incentiveDeadline) : '—')]
                                    ] as [string, (h: Home) => string][]
                                ).map(([label, f]) => (
                                    <tr key={label}>
                                        <th>{label}</th>
                                        {cmp.map((h) => (
                                            <td key={h.id}>{f(h)}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="fine">Payment estimate: 10% down at {data.settings.rate}% + taxes, insurance, HOA. Lender to confirm.</p>
                </>
            )}
            {edit && (
                <HomeForm
                    initial={edit}
                    onClose={() => setEdit(null)}
                    onSave={(h) => update((d) => ({ ...d, homes: d.homes.some((x) => x.id === h.id) ? d.homes.map((x) => (x.id === h.id ? h : x)) : [...d.homes, h] }))}
                    onDelete={(id) => update((d) => ({ ...d, homes: d.homes.filter((x) => x.id !== id) }))}
                />
            )}
        </>
    );
}

function HomeForm({ initial, onClose, onSave, onDelete }: { initial: Home; onClose: () => void; onSave: (h: Home) => void; onDelete: (id: string) => void }) {
    const [h, setH] = useState(initial);
    const n = (k: 'beds' | 'baths' | 'sqft' | 'price') => ({ type: 'number', value: h[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setH({ ...h, [k]: Number(e.target.value) }) });
    const s = (k: 'address' | 'community' | 'plan' | 'incentive' | 'moveIn' | 'incentiveDeadline') => ({ value: h[k] ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement>) => setH({ ...h, [k]: e.target.value || undefined }) });
    return (
        <Sheet title={initial.address || 'New home'} onClose={onClose}>
            <Field label="Address">
                <input {...s('address')} />
            </Field>
            <div className="grid2">
                <Field label="Community">
                    <input {...s('community')} />
                </Field>
                <Field label="Plan">
                    <input {...s('plan')} />
                </Field>
                <Field label="Beds">
                    <input {...n('beds')} />
                </Field>
                <Field label="Baths">
                    <input {...n('baths')} step={0.5} />
                </Field>
                <Field label="Sq ft">
                    <input {...n('sqft')} />
                </Field>
                <Field label="Price">
                    <input {...n('price')} />
                </Field>
                <Field label="Status">
                    <select value={h.status} onChange={(e) => setH({ ...h, status: e.target.value as Home['status'] })}>
                        <option value="available">Available</option>
                        <option value="hold">On hold</option>
                        <option value="sold">Sold</option>
                    </select>
                </Field>
                <Field label="Move-in ready">
                    <input type="date" {...s('moveIn')} />
                </Field>
            </div>
            <Field label="Incentive (confirmed only)">
                <input {...s('incentive')} />
            </Field>
            <Field label="Incentive deadline">
                <input type="date" {...s('incentiveDeadline')} />
            </Field>
            <div className="sticky-actions">
                {initial.address && (
                    <button
                        className="btn danger"
                        onClick={() => {
                            onDelete(h.id);
                            onClose();
                        }}
                    >
                        Delete
                    </button>
                )}
                <button
                    className="btn primary"
                    onClick={() => {
                        if (!h.address.trim()) return;
                        onSave(h);
                        onClose();
                    }}
                >
                    Save
                </button>
            </div>
        </Sheet>
    );
}

const COMP_FIELDS: { key: keyof Competitor; label: string }[] = [
    { key: 'priceFrom', label: 'Price from' },
    { key: 'included', label: 'Included features' },
    { key: 'incentives', label: 'Incentives' },
    { key: 'floorPlans', label: 'Floor plans' },
    { key: 'quality', label: 'Build quality' },
    { key: 'reputation', label: 'Reputation' },
    { key: 'warranty', label: 'Warranty' },
    { key: 'buildTime', label: 'Construction timeline' },
    { key: 'amenities', label: 'Community amenities' },
    { key: 'experience', label: 'Buyer experience' }
];

function Competitors() {
    const { data, update } = useStore();
    const [edit, setEdit] = useState<Competitor | null>(null);
    const save = (c: Competitor) => update((d) => ({ ...d, competitors: d.competitors.some((x) => x.id === c.id) ? d.competitors.map((x) => (x.id === c.id ? c : x)) : [...d.competitors, c] }));
    return (
        <>
            <p className="muted small">Record only what you've verified (website, sales office visit, public reviews) and when. Present findings objectively — never make unsupported claims to buyers.</p>
            <button className="btn primary sm" onClick={() => setEdit({ id: uid(), builder: '', community: '' })}>
                <Icon name="plus" size={16} /> Competitor
            </button>
            {data.competitors.length > 0 && (
                <div className="table-wrap" style={{ marginTop: 12 }}>
                    <table className="cmp">
                        <thead>
                            <tr>
                                <th />
                                <th>{data.settings.builder} (you)</th>
                                {data.competitors.map((c) => (
                                    <th key={c.id}>
                                        <button className="link" onClick={() => setEdit(c)}>
                                            {c.builder}
                                        </button>
                                        <div className="muted small">{c.community}</div>
                                        {c.verifiedOn ? <Pill tone="green">verified {fmtDate(c.verifiedOn)}</Pill> : <Pill tone="amber">unverified</Pill>}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {COMP_FIELDS.map((f) => (
                                <tr key={f.key}>
                                    <th>{f.label}</th>
                                    <td className="muted">[your data]</td>
                                    {data.competitors.map((c) => (
                                        <td key={c.id}>{f.key === 'priceFrom' ? money(c.priceFrom) : ((c[f.key] as string) ?? '—')}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {edit && (
                <Sheet title={edit.builder || 'New competitor'} onClose={() => setEdit(null)}>
                    <div className="grid2">
                        <Field label="Builder">
                            <input value={edit.builder} onChange={(e) => setEdit({ ...edit, builder: e.target.value })} />
                        </Field>
                        <Field label="Community">
                            <input value={edit.community} onChange={(e) => setEdit({ ...edit, community: e.target.value })} />
                        </Field>
                    </div>
                    {COMP_FIELDS.map((f) => (
                        <Field key={f.key} label={f.label}>
                            <input
                                value={(edit[f.key] as string | number | undefined) ?? ''}
                                inputMode={f.key === 'priceFrom' ? 'numeric' : undefined}
                                onChange={(e) => setEdit({ ...edit, [f.key]: f.key === 'priceFrom' ? Number(e.target.value.replace(/\D/g, '')) || undefined : e.target.value || undefined })}
                            />
                        </Field>
                    ))}
                    <Field label="Verified on">
                        <input type="date" value={edit.verifiedOn ?? ''} onChange={(e) => setEdit({ ...edit, verifiedOn: e.target.value })} />
                    </Field>
                    <div className="sticky-actions">
                        <button
                            className="btn danger"
                            onClick={() => {
                                update((d) => ({ ...d, competitors: d.competitors.filter((x) => x.id !== edit.id) }));
                                setEdit(null);
                            }}
                        >
                            Delete
                        </button>
                        <button
                            className="btn primary"
                            onClick={() => {
                                if (!edit.builder.trim()) return;
                                save(edit);
                                setEdit(null);
                            }}
                        >
                            Save
                        </button>
                    </div>
                </Sheet>
            )}
        </>
    );
}

function Cadence() {
    return (
        <>
            <p className="muted small">The app uses this cadence to suggest each buyer's next follow-up date when you log activity or change stages.</p>
            <div className="list">
                {STAGES.map((s) => (
                    <div key={s.key} className="card cadence">
                        <div className="row between">
                            <strong>{s.label}</strong>
                            <Pill tone="blue">every {CADENCE[s.key].days}d</Pill>
                        </div>
                        <div className="small">{CADENCE[s.key].method}</div>
                        <div className="muted small">{CADENCE[s.key].why}</div>
                    </div>
                ))}
            </div>
            <SectionHead title="Post-closing rhythm" />
            <ul className="qlist">
                <li>Closing day: congratulations text + photo</li>
                <li>Day 7: “How's move-in going?” + customer care reminder</li>
                <li>Day 30: check-in and review request</li>
                <li>Day 90: referral conversation</li>
                <li>1 year: home anniversary note + warranty reminder</li>
            </ul>
        </>
    );
}

function Briefs() {
    const [kind, setKind] = useState<'research' | 'decision'>('research');
    const [topic, setTopic] = useState('');
    const sections = kind === 'research' ? RESEARCH_SECTIONS : DECISION_SECTIONS;
    const [vals, setVals] = useState<Record<string, string>>({});
    const text = `${kind === 'research' ? 'RESEARCH BRIEF' : 'DECISION BRIEF'}: ${topic || '[Topic]'}\n${fmtDate(today())}\n\n${sections.map((s) => `${s.toUpperCase()}\n${vals[s] || '—'}`).join('\n\n')}`;
    return (
        <>
            <div className="chips">
                <button className={`chip ${kind === 'research' ? 'on' : ''}`} onClick={() => setKind('research')}>
                    Research brief
                </button>
                <button className={`chip ${kind === 'decision' ? 'on' : ''}`} onClick={() => setKind('decision')}>
                    Decision brief
                </button>
            </div>
            <Field label="Topic">
                <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={kind === 'research' ? 'e.g., Q4 rate buydown programs in our market' : 'e.g., Offer buydown vs. price reduction on 1421 Willow Bend'} />
            </Field>
            {sections.map((s) => (
                <Field key={s} label={s}>
                    <textarea rows={2} value={vals[s] ?? ''} onChange={(e) => setVals({ ...vals, [s]: e.target.value })} />
                </Field>
            ))}
            <DraftBox channel="note" body={text} />
        </>
    );
}

function SettingsView() {
    const { data, update, replace, toast, ask } = useStore();
    const s = data.settings;
    const [paste, setPaste] = useState('');
    const file = useRef<HTMLInputElement>(null);
    const set = (k: keyof typeof s, v: string) => update((d) => ({ ...d, settings: { ...d.settings, [k]: ['rate', 'taxRate', 'insurance', 'hoa'].includes(k) ? Number(v) : v } }));
    const exportData = () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `sales-assistant-backup-${today()}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    };
    const restore = async (text: string) => {
        let d = null;
        try {
            d = normalize(JSON.parse(text));
        } catch {
            /* invalid JSON */
        }
        if (!d) return toast('That is not a valid backup');
        if (!(await ask(`Replace your current data with this backup (${d.buyers.length} buyers)?`, 'Restore'))) return;
        replace(d);
        setPaste('');
        toast('Backup restored');
    };
    const importData = (f: File) => f.text().then(restore);
    const copyBackup = async () => {
        const ok = await copyText(JSON.stringify(data));
        toast(ok ? 'Backup copied — paste it into a note or email to yourself' : 'Copy failed — use Download backup');
    };
    return (
        <>
            <SectionHead title="Your profile" />
            <p className="muted small">Used in email signatures and drafts.</p>
            <div className="grid2">
                {(
                    [
                        ['name', 'Your name'],
                        ['builder', 'Builder'],
                        ['community', 'Primary community'],
                        ['phone', 'Phone'],
                        ['email', 'Email']
                    ] as const
                ).map(([k, l]) => (
                    <Field key={k} label={l}>
                        <input value={s[k]} onChange={(e) => set(k, e.target.value)} />
                    </Field>
                ))}
            </div>
            <SectionHead title="Payment defaults" />
            <div className="grid2">
                <Field label="Interest rate %">
                    <input type="number" step={0.125} value={s.rate} onChange={(e) => set('rate', e.target.value)} />
                </Field>
                <Field label="Property tax %">
                    <input type="number" step={0.05} value={s.taxRate} onChange={(e) => set('taxRate', e.target.value)} />
                </Field>
                <Field label="Insurance $/yr">
                    <input type="number" value={s.insurance} onChange={(e) => set('insurance', e.target.value)} />
                </Field>
                <Field label="HOA $/mo">
                    <input type="number" value={s.hoa} onChange={(e) => set('hoa', e.target.value)} />
                </Field>
            </div>

            <SectionHead title="Your data" />
            <p className="muted small">Everything is stored privately in this browser on this device. Back up regularly, and restore the backup to move to another device or browser.</p>
            <div className="row gap wrap">
                <button className="btn" onClick={copyBackup}>
                    <Icon name="copy" size={16} /> Copy backup
                </button>
                {!(window as unknown as { __SALES_STANDALONE__?: boolean }).__SALES_STANDALONE__ && (
                    <button className="btn" onClick={exportData}>
                        Download backup
                    </button>
                )}
                <button className="btn" onClick={() => file.current?.click()}>
                    Restore from file
                </button>
                <input ref={file} type="file" accept="application/json" hidden onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) importData(f);
                    }} />
            </div>
            <Field label="Or paste a copied backup to restore" hint="If a download doesn't start, use Copy backup instead.">
                <textarea id="paste-backup" rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder='{"version":1,…}' />
            </Field>
            {paste.trim() && (
                <button className="btn primary sm" onClick={() => restore(paste)}>
                    Restore pasted backup
                </button>
            )}
            <div className="row gap wrap" style={{ marginTop: 12 }}>
                <button
                    className="btn danger"
                    onClick={async () => {
                        if (await ask('Clear all buyers, tasks, homes and appointments? Your profile is kept. Back up first if you might need them.', 'Clear data')) {
                            replace(emptyData(s));
                            toast('Started fresh');
                        }
                    }}
                >
                    Start fresh (clear data)
                </button>
                <button
                    className="btn"
                    onClick={async () => {
                        if (await ask('Replace everything with sample data?', 'Load samples')) replace(sampleData());
                    }}
                >
                    Load sample data
                </button>
            </div>
        </>
    );
}
