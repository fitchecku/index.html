import { useState } from 'react';
import type { ApptType } from '../types';
import type { ComposeParams } from '../App';
import { useStore } from '../store';
import { DraftBox, Field, SectionHead, Segmented } from '../ui';
import { INTERNAL_RECIPIENTS, MESSAGE_KINDS, generateMessage, internalMessage, meetingPrep, prepText, suggestedKind } from '../templates';
import { isActive, stageShort } from '../logic';
import { fmtDate, fmtTime, money, today } from '../util';

type Mode = 'buyer' | 'internal' | 'prep';

export default function Compose({ params }: { params?: ComposeParams }) {
    const [mode, setMode] = useState<Mode>(params?.mode ?? 'buyer');
    return (
        <div>
            <header className="topbar">
                <h1>Write</h1>
            </header>
            <Segmented<Mode>
                value={mode}
                onChange={setMode}
                options={[
                    { value: 'buyer', label: 'Buyer message' },
                    { value: 'internal', label: 'Internal' },
                    { value: 'prep', label: 'Meeting prep' }
                ]}
            />
            {mode === 'buyer' && <BuyerMessage params={params} />}
            {mode === 'internal' && <Internal buyerId={params?.buyerId} />}
            {mode === 'prep' && <Prep buyerId={params?.buyerId} apptId={params?.apptId} />}
        </div>
    );
}

function BuyerPicker({ value, onChange, allowNone = true }: { value: string; onChange: (v: string) => void; allowNone?: boolean }) {
    const { data } = useStore();
    const sorted = [...data.buyers].sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || a.name.localeCompare(b.name));
    return (
        <Field label="Buyer">
            <select value={value} onChange={(e) => onChange(e.target.value)}>
                {allowNone && <option value="">— No buyer (generic) —</option>}
                {sorted.map((b) => (
                    <option key={b.id} value={b.id}>
                        {b.name} · {stageShort(b.stage)}
                    </option>
                ))}
            </select>
        </Field>
    );
}

function BuyerMessage({ params }: { params?: ComposeParams }) {
    const { data } = useStore();
    const [buyerId, setBuyerId] = useState(params?.buyerId ?? '');
    const b = data.buyers.find((x) => x.id === buyerId);
    const [kind, setKind] = useState(params?.kind ?? suggestedKind(b));
    const [channel, setChannel] = useState<'email' | 'text'>(params?.channel ?? 'email');
    const appts = data.appointments.filter((a) => a.start.slice(0, 10) >= today() && (!buyerId || a.buyerId === buyerId)).sort((a, z) => a.start.localeCompare(z.start));
    const [apptId, setApptId] = useState(params?.apptId ?? appts[0]?.id ?? '');
    const appt = data.appointments.find((a) => a.id === apptId);
    const msg = generateMessage(kind, channel, { b, s: data.settings, homes: data.homes, appt });
    const usesAppt = ['appt-confirm', 'design-appt', 'pre-closing'].includes(kind);
    const groups = [...new Set(MESSAGE_KINDS.map((k) => k.group))];

    return (
        <>
            <BuyerPicker
                value={buyerId}
                onChange={(v) => {
                    setBuyerId(v);
                    setKind(suggestedKind(data.buyers.find((x) => x.id === v)));
                    setApptId(data.appointments.find((a) => a.buyerId === v && a.start.slice(0, 10) >= today())?.id ?? '');
                }}
            />
            <Field label="Message type" hint={b ? `Suggested for ${stageShort(b.stage)}: ${MESSAGE_KINDS.find((k) => k.key === suggestedKind(b))?.label}` : undefined}>
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                    {groups.map((g) => (
                        <optgroup key={g} label={g}>
                            {MESSAGE_KINDS.filter((k) => k.group === g).map((k) => (
                                <option key={k.key} value={k.key}>
                                    {k.label}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>
            </Field>
            {usesAppt && (
                <Field label="Appointment">
                    <select value={apptId} onChange={(e) => setApptId(e.target.value)}>
                        <option value="">— Fill in manually —</option>
                        {appts.map((a) => (
                            <option key={a.id} value={a.id}>
                                {fmtDate(a.start)} {fmtTime(a.start)} · {a.title}
                            </option>
                        ))}
                    </select>
                </Field>
            )}
            <Segmented<"email" | "text">
                value={channel}
                onChange={setChannel}
                options={[
                    { value: 'email', label: 'Email' },
                    { value: 'text', label: 'Text' }
                ]}
            />
            <DraftBox channel={channel} subject={msg.subject} body={msg.body} to={channel === 'email' ? b?.email : b?.phone} />
            <p className="fine">Drafts follow your style guide: warm, consultative, no pressure. Emails stay under 250 words. Anything in [brackets] needs confirming — the app never invents dates, prices or promises.</p>
        </>
    );
}

function Internal({ buyerId: initial }: { buyerId?: string }) {
    const { data } = useStore();
    const [to, setTo] = useState(INTERNAL_RECIPIENTS[1]);
    const [buyerId, setBuyerId] = useState(initial ?? '');
    const [objective, setObjective] = useState('');
    const [action, setAction] = useState('');
    const [deadline, setDeadline] = useState('');
    const [context, setContext] = useState('');
    const b = data.buyers.find((x) => x.id === buyerId);
    const msg = internalMessage(to, { b, s: data.settings, homes: data.homes, objective, action, deadline, context });
    return (
        <>
            <div className="chips">
                {INTERNAL_RECIPIENTS.map((r) => (
                    <button key={r} className={`chip ${to === r ? 'on' : ''}`} onClick={() => setTo(r)}>
                        {r}
                    </button>
                ))}
            </div>
            <BuyerPicker value={buyerId} onChange={setBuyerId} />
            <Field label="Objective">
                <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="e.g., Confirm pre-drywall walkthrough date" />
            </Field>
            <Field label="Required action">
                <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g., Reply with confirmed date/time" />
            </Field>
            <Field label="Deadline">
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Field>
            <Field label="Context (optional — auto-filled from buyer)">
                <textarea rows={3} value={context} onChange={(e) => setContext(e.target.value)} />
            </Field>
            <DraftBox channel="email" subject={msg.subject} body={msg.body} />
        </>
    );
}

const APPT_TYPES: ApptType[] = ['tour', 'discovery', 'follow-up', 'contract', 'design', 'construction', 'closing'];

function Prep({ buyerId: initial, apptId }: { buyerId?: string; apptId?: string }) {
    const { data } = useStore();
    const appt = data.appointments.find((a) => a.id === apptId);
    const [buyerId, setBuyerId] = useState(initial ?? appt?.buyerId ?? data.buyers.find(isActive)?.id ?? '');
    const [type, setType] = useState<ApptType>(appt?.type ?? 'tour');
    const b = data.buyers.find((x) => x.id === buyerId);
    const ctx = { b, s: data.settings, homes: data.homes };
    const p = meetingPrep(type, ctx);
    return (
        <>
            <BuyerPicker value={buyerId} onChange={setBuyerId} />
            <div className="chips">
                {APPT_TYPES.map((t) => (
                    <button key={t} className={`chip ${type === t ? 'on' : ''}`} onClick={() => setType(t)}>
                        {t}
                    </button>
                ))}
            </div>
            <div className="prep">
                <SectionHead title="Objectives" />
                <ul>{p.objectives.map((x) => <li key={x}>{x}</li>)}</ul>
                <SectionHead title="Questions to ask" />
                <ul>{p.questions.map((x) => <li key={x}>{x}</li>)}</ul>
                <SectionHead title="Likely objections" />
                <ul>{p.objections.length ? p.objections.map((x) => <li key={x}>{x}</li>) : <li className="muted">None noted yet — listen for them.</li>}</ul>
                <SectionHead title="Relevant homes" />
                <ul>
                    {p.homes.length ? (
                        p.homes.map((h) => (
                            <li key={h.id}>
                                {h.address} — {h.plan}, {h.beds} bd, {money(h.price)}
                                {h.incentive ? ` · ${h.incentive}` : ''}
                            </li>
                        ))
                    ) : (
                        <li className="muted">No matches — add inventory in Playbook → Inventory.</li>
                    )}
                </ul>
                <SectionHead title="Talking points" />
                <ul>{p.talking.map((x) => <li key={x}>{x}</li>)}</ul>
                {p.risks.length > 0 && (
                    <>
                        <SectionHead title="Watch-outs" />
                        <ul>{p.risks.map((x) => <li key={x}>{x}</li>)}</ul>
                    </>
                )}
                <div className="card next-action">
                    <div className="eyebrow">Desired outcome</div>
                    <div className="na-text">{p.outcome}</div>
                </div>
            </div>
            <SectionHead title="Copy as notes" />
            <DraftBox channel="note" body={prepText(type, ctx)} />
        </>
    );
}
