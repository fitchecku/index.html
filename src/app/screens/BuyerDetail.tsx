import { useState } from 'react';
import type { Buyer, Interaction, Milestone, Stage } from '../types';
import { useStore } from '../store';
import { useNav } from '../App';
import { DraftBox, Field, Icon, Meter, Pill, SectionHead, Segmented, Sheet } from '../ui';
import BuyerForm from './BuyerForm';
import {
    CADENCE,
    FINANCING_LABEL,
    MILESTONE_INFO,
    QUAL_FIELDS,
    freshMilestones,
    isActive,
    likelihood,
    nextAction,
    qualificationGaps,
    qualificationScore,
    risks,
    stageLabel,
    stageShort,
    stagesFor,
    suggestedFollowUp
} from '../logic';
import { addDays, daysUntil, firstName, fmtDate, money, relDay, toDateTime, today, uid } from '../util';

type View = 'overview' | 'qualify' | 'build' | 'activity';

export default function BuyerDetail({ id }: { id: string }) {
    const { data, saveBuyer, update, toast } = useStore();
    const { closeBuyer, go } = useNav();
    const b = data.buyers.find((x) => x.id === id)!;
    const [view, setView] = useState<View>('overview');
    const [editing, setEditing] = useState(false);
    const [wrap, setWrap] = useState(false);

    const l = likelihood(b);
    const home = data.homes.find((h) => h.id === b.homeId);
    const flow = stagesFor(b);
    const idx = flow.indexOf(b.stage);
    const r = risks(b, data.homes);
    const tasks = data.tasks.filter((t) => t.buyerId === b.id && !t.done);

    const setStage = (stage: Stage) => {
        let nb: Buyer = { ...b, stage, nextFollowUp: addDays(today(), CADENCE[stage].days) };
        if (stage === 'contract' && !b.contractDate) nb.contractDate = today();
        if (b.saleType === 'bto' && ['contract', 'design', 'construction'].includes(stage) && !b.milestones) nb.milestones = freshMilestones();
        nb.interactions = [{ id: uid(), date: toDateTime(new Date()), type: 'note', summary: `Stage changed: ${stageLabel(b.stage)} → ${stageLabel(stage)}` }, ...b.interactions];
        saveBuyer(nb);
        toast(`Moved to ${stageLabel(stage)} · follow-up ${relDay(nb.nextFollowUp)}`);
    };

    const compose = (channel: 'email' | 'text', kind?: string) => go({ tab: 'write', compose: { mode: 'buyer', buyerId: b.id, channel, kind } });

    return (
        <div>
            <header className="topbar">
                <button className="icon-btn" onClick={closeBuyer} aria-label="Back">
                    <Icon name="back" />
                </button>
                <div className="row gap">
                    <button className={`icon-btn ${b.starred ? 'gold' : ''}`} onClick={() => saveBuyer({ ...b, starred: !b.starred })} aria-label="Star">
                        <Icon name="star" />
                    </button>
                    <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit">
                        <Icon name="edit" />
                    </button>
                </div>
            </header>

            <section className="portfolio compact">
                <div className="eyebrow">
                    {b.saleType === 'bto' ? 'Build-to-order' : 'Move-in ready'} · {b.community ?? 'No community yet'}
                </div>
                <h1 className="buyer-name">{b.name}</h1>
                <div className="big-number sm">{money(b.price ?? b.budgetMax)}</div>
                <div className={`delta ${l >= 50 ? 'pos' : 'neg'}`}>
                    {isActive(b) ? `${l}% likely to close` : stageLabel(b.stage)} <span className="muted">· {home ? home.address : b.plan ?? 'No home selected'}</span>
                </div>
            </section>

            <div className="quick-actions">
                {b.phone && (
                    <a className="qa" href={`tel:${b.phone}`}>
                        <Icon name="phone" />
                        Call
                    </a>
                )}
                <button className="qa" onClick={() => compose('text')}>
                    <Icon name="msg" />
                    Text
                </button>
                <button className="qa" onClick={() => compose('email')}>
                    <Icon name="mail" />
                    Email
                </button>
                <button className="qa" onClick={() => go({ tab: 'write', compose: { mode: 'prep', buyerId: b.id } })}>
                    <Icon name="clock" />
                    Prep
                </button>
                <button className="qa accent" onClick={() => setWrap(true)}>
                    <Icon name="check" />
                    Wrap-up
                </button>
            </div>

            {/* Stage tracker */}
            <div className="tracker">
                {flow.map((s, i) => (
                    <button key={s} className={`step ${i < idx ? 'done' : i === idx ? 'cur' : ''}`} onClick={() => s !== b.stage && setStage(s)} title={stageLabel(s)}>
                        <span />
                        <small>{stageShort(s)}</small>
                    </button>
                ))}
            </div>
            <div className="row gap wrap">
                {idx >= 0 && idx < flow.length - 1 && (
                    <button className="btn primary sm" onClick={() => setStage(flow[idx + 1])}>
                        Advance to {stageShort(flow[idx + 1])} →
                    </button>
                )}
                {b.stage !== 'lost' && b.stage !== 'closed' && (
                    <button className="btn sm" onClick={() => setStage('lost')}>
                        Mark inactive
                    </button>
                )}
                {b.stage === 'lost' && (
                    <button className="btn sm" onClick={() => setStage('contacted')}>
                        Reactivate
                    </button>
                )}
            </div>

            <div style={{ marginTop: 16 }}>
                <Segmented<View>
                    value={view}
                    onChange={setView}
                    options={[
                        { value: 'overview', label: 'Overview' },
                        { value: 'qualify', label: 'Qualify' },
                        ...(b.saleType === 'bto' ? [{ value: 'build' as View, label: 'Build' }] : []),
                        { value: 'activity', label: 'Activity' }
                    ]}
                />
            </div>

            {view === 'overview' && (
                <>
                    <div className="card next-action">
                        <div className="eyebrow">Recommended next action</div>
                        <div className="na-text">{nextAction(b, data.homes)}</div>
                        <div className="muted small">
                            {CADENCE[b.stage].method} · {CADENCE[b.stage].why}
                        </div>
                    </div>
                    <div className="kv-grid">
                        <div>
                            <span>Stage</span>
                            <strong>{stageLabel(b.stage)}</strong>
                        </div>
                        <div>
                            <span>Likelihood</span>
                            <strong>{isActive(b) ? `${l}%` : '—'}</strong>
                            {isActive(b) && <Meter value={l} />}
                        </div>
                        <div>
                            <span>Next follow-up</span>
                            <strong className={(daysUntil(b.nextFollowUp) ?? 0) < 0 ? 'neg' : ''}>{relDay(b.nextFollowUp)}</strong>
                            <button className="link small" onClick={() => saveBuyer({ ...b, nextFollowUp: suggestedFollowUp(b) })}>
                                Set to {fmtDate(suggestedFollowUp(b))}
                            </button>
                        </div>
                        <div>
                            <span>Last contact</span>
                            <strong>{relDay(b.lastContact)}</strong>
                        </div>
                        <div>
                            <span>Financing</span>
                            <strong>{FINANCING_LABEL[b.financing]}</strong>
                        </div>
                        <div>
                            <span>Closing</span>
                            <strong>{b.closingDate ? fmtDate(b.closingDate) : '—'}</strong>
                        </div>
                    </div>

                    <SectionHead title="Risks" />
                    {r.length === 0 ? (
                        <div className="empty">No risks flagged.</div>
                    ) : (
                        <div className="list">
                            {r.map((x, i) => (
                                <div key={i} className="risk">
                                    <span className={`tag ${x.level === 'high' ? 'red' : 'amber'}`}>{x.level === 'high' ? 'HIGH' : 'WATCH'}</span>
                                    {x.text}
                                </div>
                            ))}
                        </div>
                    )}

                    <SectionHead title="Outstanding tasks" action="Add" onAction={() => go({ tab: 'agenda', agendaView: 'tasks' })} />
                    {tasks.length === 0 && <div className="empty">No open tasks for {firstName(b.name)}.</div>}
                    <div className="list">
                        {tasks.map((t) => (
                            <label key={t.id} className="task">
                                <input type="checkbox" onChange={() => update((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, done: true } : x)) }))} />
                                <span>{t.title}</span>
                                {t.due && <small className={(daysUntil(t.due) ?? 0) < 0 ? 'neg' : 'muted'}>{relDay(t.due)}</small>}
                            </label>
                        ))}
                    </div>

                    {(b.mustHaves || b.concerns || b.niceToHaves) && (
                        <>
                            <SectionHead title="What matters to them" />
                            <div className="card">
                                {b.mustHaves && (
                                    <p>
                                        <strong>Must-haves:</strong> {b.mustHaves}
                                    </p>
                                )}
                                {b.niceToHaves && (
                                    <p>
                                        <strong>Nice-to-haves:</strong> {b.niceToHaves}
                                    </p>
                                )}
                                {b.concerns && (
                                    <p>
                                        <strong>Concerns:</strong> {b.concerns}{' '}
                                        <button className="link" onClick={() => go({ tab: 'tools', tool: 'objections' })}>
                                            Objection playbook →
                                        </button>
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                    {b.stage === 'closed' && !b.referralAsked && (
                        <div className="card">
                            <p>Closed buyers are your best source of referrals. Ask once they've settled in.</p>
                            <div className="row gap">
                                <button className="btn primary sm" onClick={() => compose('text', 'referral')}>
                                    Draft referral ask
                                </button>
                                <button className="btn sm" onClick={() => saveBuyer({ ...b, referralAsked: true })}>
                                    Mark as asked
                                </button>
                            </div>
                        </div>
                    )}
                    <button
                        className="btn danger sm"
                        style={{ marginTop: 24 }}
                        onClick={() => {
                            if (confirm(`Delete ${b.name}? This can't be undone.`)) {
                                update((d) => ({ ...d, buyers: d.buyers.filter((x) => x.id !== b.id), tasks: d.tasks.filter((t) => t.buyerId !== b.id) }));
                                closeBuyer();
                            }
                        }}
                    >
                        <Icon name="trash" size={16} /> Delete buyer
                    </button>
                </>
            )}

            {view === 'qualify' && <Qualify b={b} onEdit={() => setEditing(true)} />}
            {view === 'build' && <Build b={b} />}
            {view === 'activity' && <Activity b={b} onWrap={() => setWrap(true)} />}

            {editing && <BuyerForm initial={b} onClose={() => setEditing(false)} />}
            {wrap && <WrapUp b={b} onClose={() => setWrap(false)} />}
        </div>
    );
}

function Qualify({ b, onEdit }: { b: Buyer; onEdit: () => void }) {
    const gaps = qualificationGaps(b);
    const score = qualificationScore(b);
    return (
        <>
            <div className="card">
                <div className="row between">
                    <div>
                        <div className="eyebrow">Qualification</div>
                        <div className="big-number sm">{score}%</div>
                    </div>
                    <button className="btn sm" onClick={onEdit}>
                        Update
                    </button>
                </div>
                <Meter value={score} />
            </div>
            {gaps.length > 0 && (
                <>
                    <SectionHead title={`Gaps to fill (${gaps.length})`} />
                    <p className="muted small">Weave these into conversation naturally — one or two per touchpoint, not an interrogation.</p>
                    <div className="list">
                        {gaps.map((g) => (
                            <div key={g.key} className="gap-item">
                                <strong>{g.label}</strong>
                                <span>“{g.question}”</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
            <SectionHead title="What we know" />
            <div className="kv-list">
                {QUAL_FIELDS.filter((f) => !gaps.includes(f)).map((f) => {
                    let v = b[f.key] as string | number;
                    if (f.key === 'budgetMax') v = money(v as number);
                    if (f.key === 'financing') v = FINANCING_LABEL[b.financing];
                    if (f.key === 'currentHome') v = String(v).replace(/-/g, ' ');
                    return (
                        <div key={f.key}>
                            <span>{f.label}</span>
                            <strong>{String(v)}</strong>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

function Build({ b }: { b: Buyer }) {
    const { saveBuyer } = useStore();
    const { go } = useNav();
    const ms = b.milestones ?? freshMilestones();
    const setMs = (m: Milestone[]) => saveBuyer({ ...b, milestones: m });
    const makeCurrent = (i: number) => setMs(ms.map((m, j) => ({ ...m, status: j < i ? 'done' : j === i ? 'current' : 'pending' })));
    const cur = ms.find((m) => m.status === 'current');
    return (
        <>
            <div className="card">
                <div className="eyebrow">Current stage</div>
                <div className="na-text">{cur?.label ?? 'Not started'}</div>
                {cur && <p className="muted small">{MILESTONE_INFO[cur.key]?.why}</p>}
                <button className="btn primary sm" onClick={() => go({ tab: 'write', compose: { mode: 'buyer', buyerId: b.id, kind: 'milestone', channel: 'email' } })}>
                    Draft milestone update
                </button>
            </div>
            <p className="muted small">Tap a milestone to mark it current. Only dates marked “confirmed” are shared in buyer updates — no speculation.</p>
            <div className="timeline">
                {ms.map((m, i) => (
                    <div key={m.key} className={`tl-item ${m.status}`}>
                        <button className="tl-dot" onClick={() => makeCurrent(i)} aria-label={`Mark ${m.label} current`} />
                        <div className="tl-body">
                            <button className="tl-label" onClick={() => makeCurrent(i)}>
                                {m.label}
                            </button>
                            <div className="row gap small">
                                <input type="date" value={m.date ?? ''} onChange={(e) => setMs(ms.map((x, j) => (j === i ? { ...x, date: e.target.value || undefined } : x)))} aria-label={`${m.label} date`} />
                                <label className="row gap-sm">
                                    <input type="checkbox" checked={!!m.confirmed} onChange={(e) => setMs(ms.map((x, j) => (j === i ? { ...x, confirmed: e.target.checked } : x)))} />
                                    confirmed
                                </label>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

function Activity({ b, onWrap }: { b: Buyer; onWrap: () => void }) {
    const { saveBuyer, toast } = useStore();
    const [type, setType] = useState<Interaction['type']>('call');
    const [summary, setSummary] = useState('');
    const log = () => {
        if (!summary.trim()) return;
        saveBuyer({
            ...b,
            lastContact: toDateTime(new Date()),
            nextFollowUp: (daysUntil(b.nextFollowUp) ?? -1) <= 0 ? suggestedFollowUp(b) : b.nextFollowUp,
            interactions: [{ id: uid(), date: toDateTime(new Date()), type, summary: summary.trim() }, ...b.interactions]
        });
        setSummary('');
        toast('Logged');
    };
    return (
        <>
            <div className="card">
                <div className="row gap wrap">
                    {(['call', 'text', 'email', 'visit', 'note'] as const).map((t) => (
                        <button key={t} className={`chip ${type === t ? 'on' : ''}`} onClick={() => setType(t)}>
                            {t}
                        </button>
                    ))}
                </div>
                <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="What happened? Key takeaways…" aria-label="Activity summary" />
                <div className="row gap">
                    <button className="btn primary sm" onClick={log}>
                        Log activity
                    </button>
                    <button className="btn sm" onClick={onWrap}>
                        Full meeting wrap-up
                    </button>
                </div>
            </div>
            <div className="feed">
                {b.interactions.length === 0 && <div className="empty">No activity yet.</div>}
                {b.interactions.map((i) => (
                    <div key={i.id} className="feed-item">
                        <div className="feed-meta">
                            <Pill>{i.type}</Pill> {fmtDate(i.date)}
                        </div>
                        <div className="pre">{i.summary}</div>
                    </div>
                ))}
            </div>
        </>
    );
}

/** After-appointment workflow: summary, action items, CRM note, follow-up drafts, next steps. */
function WrapUp({ b, onClose }: { b: Buyer; onClose: () => void }) {
    const { data, saveBuyer, update, toast } = useStore();
    const [meeting, setMeeting] = useState('Community tour');
    const [notes, setNotes] = useState('');
    const [concerns, setConcerns] = useState(b.concerns ?? '');
    const [agreed, setAgreed] = useState('');
    const [actions, setActions] = useState('');
    const [next, setNext] = useState(suggestedFollowUp(b));
    const [channel, setChannel] = useState<'email' | 'text'>('email');
    const fn = firstName(b.name);
    const s = data.settings;

    const actionList = actions
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean);
    const summary = `${meeting} with ${b.name} on ${fmtDate(today())}.\n${notes.trim() || '[Key discussion points]'}${concerns ? `\nConcerns raised: ${concerns}` : ''}\nAgreed next step: ${agreed || '[next step]'} (follow-up ${fmtDate(next)}).`;
    const crm = `[${stageLabel(b.stage)}] ${meeting}. ${notes.trim().replace(/\n+/g, ' ')}${concerns ? ` Concerns: ${concerns}.` : ''} Next: ${agreed || 'TBD'} by ${fmtDate(next)}.${actionList.length ? ` Actions: ${actionList.join('; ')}.` : ''}`;
    const email = {
        subject: `Thank you, ${fn} — recap & next steps`,
        body: `Hi ${fn},\n\nThank you for your time today. Here's a quick recap so everything is in one place.\n\nWhat we covered:\n${notes.trim() ? notes.trim().split('\n').map((x) => `• ${x.replace(/^[-•]\s*/, '')}`).join('\n') : '• [Key points]'}\n${concerns ? `\nYou mentioned ${concerns.toLowerCase()}. I'll follow up with clear information so you can decide with confidence.\n` : ''}\nNext step: ${agreed || '[next step]'} — I'll check in on ${fmtDate(next)}.\n\nAnything else on your mind? Just reply here.\n\nBest,\n${s.name}\n${s.builder}${s.phone ? `\n${s.phone}` : ''}`
    };
    const text = `Hi ${fn}, thanks again for today! ${agreed ? `Next step: ${agreed}. ` : ''}I'll check in ${fmtDate(next)} — text me anytime with questions.`;

    const save = () => {
        saveBuyer({
            ...b,
            concerns: concerns || undefined,
            lastContact: toDateTime(new Date()),
            nextFollowUp: next,
            interactions: [{ id: uid(), date: toDateTime(new Date()), type: 'meeting', summary: crm }, ...b.interactions]
        });
        const newTasks = [...actionList, ...(agreed ? [`Next step: ${agreed}`] : [])].map((title) => ({
            id: uid(),
            title: `${title} (${fn})`,
            category: 'followup' as const,
            due: next,
            buyerId: b.id,
            done: false,
            createdAt: toDateTime(new Date())
        }));
        if (newTasks.length) update((d) => ({ ...d, tasks: [...newTasks, ...d.tasks] }));
        toast(`Saved note${newTasks.length ? ` + ${newTasks.length} task${newTasks.length > 1 ? 's' : ''}` : ''}`);
        onClose();
    };

    return (
        <Sheet title={`Wrap-up: ${b.name}`} onClose={onClose} wide>
            <div className="grid2">
                <Field label="Meeting">
                    <select value={meeting} onChange={(e) => setMeeting(e.target.value)}>
                        {['Community tour', 'Discovery call', 'Payment review', 'Contract appointment', 'Design center', 'Construction walkthrough', 'Final walkthrough', 'Closing', 'Phone call'].map((m) => (
                            <option key={m}>{m}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Next follow-up">
                    <input type="date" value={next} onChange={(e) => setNext(e.target.value)} />
                </Field>
            </div>
            <Field label="What happened (one point per line)">
                <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={'Loved the kitchen\nAsked about HOA\nWants to bring parents back'} />
            </Field>
            <Field label="Concerns raised">
                <input value={concerns} onChange={(e) => setConcerns(e.target.value)} />
            </Field>
            <Field label="Agreed next step">
                <input value={agreed} onChange={(e) => setAgreed(e.target.value)} placeholder="e.g., Second visit Saturday with parents" />
            </Field>
            <Field label="Your action items (one per line → become tasks)">
                <textarea rows={3} value={actions} onChange={(e) => setActions(e.target.value)} placeholder={'Send HOA docs\nAsk lender for buydown scenario'} />
            </Field>

            <SectionHead title="Meeting summary" />
            <div className="card pre small">{summary}</div>
            <SectionHead title="CRM note" />
            <div className="card pre small">{crm}</div>
            <SectionHead title="Follow-up" />
            <Segmented<"email" | "text">
                value={channel}
                onChange={setChannel}
                options={[
                    { value: 'email', label: 'Email' },
                    { value: 'text', label: 'Text' }
                ]}
            />
            {channel === 'email' ? <DraftBox channel="email" subject={email.subject} body={email.body} to={b.email} /> : <DraftBox channel="text" body={text} to={b.phone} />}
            <div className="sticky-actions">
                <button className="btn" onClick={onClose}>
                    Cancel
                </button>
                <button className="btn primary" onClick={save}>
                    Save to CRM
                </button>
            </div>
        </Sheet>
    );
}
