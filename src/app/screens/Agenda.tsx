import { useMemo, useState } from 'react';
import type { Appointment, ApptType, Task, TaskCategory } from '../types';
import { useStore } from '../store';
import { useNav } from '../App';
import { DraftBox, Field, Icon, SectionHead, Segmented, Sheet } from '../ui';
import { dueFollowUps, isActive, likelihood, nextAction, stageShort } from '../logic';
import { addDays, daysUntil, fmtLongDate, fmtTime, parseDate, relDay, toDate, toDateTime, today, uid } from '../util';

export default function Agenda({ initial }: { initial?: 'schedule' | 'tasks' }) {
    const [view, setView] = useState<'schedule' | 'tasks'>(initial ?? 'schedule');
    return (
        <div>
            <header className="topbar">
                <h1>Agenda</h1>
            </header>
            <Segmented<"schedule" | "tasks">
                value={view}
                onChange={setView}
                options={[
                    { value: 'schedule', label: 'Schedule' },
                    { value: 'tasks', label: 'Tasks & plan' }
                ]}
            />
            {view === 'schedule' ? <Schedule /> : <Tasks />}
        </div>
    );
}

const BUYER_TYPES: ApptType[] = ['tour', 'discovery', 'design', 'contract', 'closing', 'follow-up', 'construction'];

export function scheduleCheck(appts: Appointment[], followUps: number, day: string, now = new Date()) {
    const out: { tone: 'red' | 'amber' | 'green'; text: string }[] = [];
    const sorted = [...appts].sort((a, b) => a.start.localeCompare(b.start));
    const mins = (a: Appointment) => {
        const d = parseDate(a.start);
        return d.getHours() * 60 + d.getMinutes();
    };
    let booked = 0;
    // Track the appointment that runs latest so far, so long blocks catch every overlap.
    let latest: Appointment | undefined;
    for (const a of sorted) {
        booked += a.duration;
        if (latest) {
            const gap = mins(a) - (mins(latest) + latest.duration);
            if (gap < 0) out.push({ tone: 'red', text: `Conflict: “${a.title}” overlaps “${latest.title}”. Move the lower-priority item.` });
            else if (gap < 20 && latest.location && a.location && latest.location.trim().toLowerCase() !== a.location.trim().toLowerCase())
                out.push({ tone: 'amber', text: `Only ${gap} min to get from ${latest.location} to ${a.location} before “${a.title}”. Add travel time.` });
            else if (gap < 15 && BUYER_TYPES.includes(a.type)) out.push({ tone: 'amber', text: `No prep time before “${a.title}”. Block 15 min to review the buyer.` });
        }
        if (!latest || mins(a) + a.duration > mins(latest) + latest.duration) latest = a;
    }
    if (booked > 6 * 60) out.push({ tone: 'amber', text: `${Math.round(booked / 60)} hours booked — protect time for follow-ups and lunch.` });
    if (followUps) {
        // First free 30-min slot between 8:00 and 18:00 — never in the past when planning today.
        const isToday = day === toDate(now);
        const earliest = isToday ? Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30 : 0;
        let slot = '';
        for (let m = Math.max(8 * 60, earliest); m + 30 <= 18 * 60; m += 30) {
            const busy = sorted.some((a) => mins(a) < m + 30 && mins(a) + a.duration > m);
            if (!busy) {
                slot = `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')} ${m < 720 ? 'AM' : 'PM'}`;
                break;
            }
        }
        const label = `${followUps} follow-up${followUps > 1 ? 's' : ''} due`;
        out.push({ tone: 'green', text: slot ? `${label} — block 30 min at ${slot} for calls and texts.` : `${label} — no open 30-min slot left before 6 PM; send quick texts between appointments.` });
    }
    if (!out.length) out.push({ tone: 'green', text: 'Schedule looks efficient — buffers and prep time are in place.' });
    return out;
}

function Schedule() {
    const { data, update } = useStore();
    const { openBuyer, go } = useNav();
    const [day, setDay] = useState(today());
    const [editing, setEditing] = useState<Appointment | null>(null);
    const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i));
    const appts = data.appointments.filter((a) => a.start.startsWith(day)).sort((a, b) => a.start.localeCompare(b.start));
    const fu = day === today() ? dueFollowUps(data).length : data.buyers.filter((b) => b.nextFollowUp === day).length;
    const checks = scheduleCheck(appts, fu, day);

    return (
        <>
            <div className="date-strip">
                {days.map((d) => {
                    const dt = parseDate(d);
                    const n = data.appointments.filter((a) => a.start.startsWith(d)).length;
                    return (
                        <button key={d} className={d === day ? 'on' : ''} onClick={() => setDay(d)}>
                            <small>{dt.toLocaleDateString('en-US', { weekday: 'short' })}</small>
                            <strong>{dt.getDate()}</strong>
                            <i>{n ? '•'.repeat(Math.min(n, 3)) : ''}</i>
                        </button>
                    );
                })}
            </div>
            <div className="row between" style={{ marginTop: 12 }}>
                <strong>{fmtLongDate(day)}</strong>
                <button className="btn primary sm" onClick={() => setEditing({ id: uid(), title: '', type: 'tour', start: `${day}T10:00`, duration: 60, location: data.settings.community })}>
                    <Icon name="plus" size={16} /> Appointment
                </button>
            </div>

            <SectionHead title="Schedule check" />
            <div className="list">
                {checks.map((c, i) => (
                    <div key={i} className="risk">
                        <span className={`tag ${c.tone}`}>{c.tone === 'red' ? 'FIX' : c.tone === 'amber' ? 'TIP' : 'OK'}</span>
                        {c.text}
                    </div>
                ))}
            </div>

            <SectionHead title="Appointments" />
            {appts.length === 0 && <div className="empty">Nothing scheduled.</div>}
            <div className="list">
                {appts.map((a) => {
                    const b = data.buyers.find((x) => x.id === a.buyerId);
                    return (
                        <div key={a.id} className="appt">
                            <div className="appt-time">
                                <strong>{fmtTime(a.start)}</strong>
                                <small>{a.duration}m</small>
                            </div>
                            <div className="appt-body">
                                <button className="row-title link-plain" onClick={() => setEditing(a)}>
                                    {a.title}
                                </button>
                                <div className="row-sub">
                                    {a.type} · {a.location ?? '—'}
                                </div>
                                {b && (
                                    <div className="row gap wrap" style={{ marginTop: 6 }}>
                                        <button className="chip" onClick={() => openBuyer(b.id)}>
                                            {b.name}
                                        </button>
                                        <button className="chip" onClick={() => go({ tab: 'write', compose: { mode: 'prep', buyerId: b.id, apptId: a.id } })}>
                                            Prep
                                        </button>
                                        <button className="chip" onClick={() => go({ tab: 'write', compose: { mode: 'buyer', buyerId: b.id, kind: a.type === 'design' ? 'design-appt' : 'appt-confirm', channel: 'text', apptId: a.id } })}>
                                            Confirm text
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {editing && (
                <ApptForm
                    initial={editing}
                    onClose={() => setEditing(null)}
                    onSave={(a) =>
                        update((d) => ({ ...d, appointments: d.appointments.some((x) => x.id === a.id) ? d.appointments.map((x) => (x.id === a.id ? a : x)) : [...d.appointments, a] }))
                    }
                    onDelete={(id) => update((d) => ({ ...d, appointments: d.appointments.filter((x) => x.id !== id) }))}
                />
            )}
        </>
    );
}

function ApptForm({ initial, onClose, onSave, onDelete }: { initial: Appointment; onClose: () => void; onSave: (a: Appointment) => void; onDelete: (id: string) => void }) {
    const { data } = useStore();
    const [a, setA] = useState(initial);
    const exists = data.appointments.some((x) => x.id === a.id);
    return (
        <Sheet title={exists ? 'Edit appointment' : 'New appointment'} onClose={onClose}>
            <Field label="Buyer (optional)">
                <select
                    value={a.buyerId ?? ''}
                    onChange={(e) => {
                        const b = data.buyers.find((x) => x.id === e.target.value);
                        setA({ ...a, buyerId: e.target.value || undefined, title: a.title || (b ? `${a.type[0].toUpperCase()}${a.type.slice(1)} — ${b.name}` : '') });
                    }}
                >
                    <option value="">—</option>
                    {data.buyers.filter(isActive).map((b) => (
                        <option key={b.id} value={b.id}>
                            {b.name}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label="Title">
                <input value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} />
            </Field>
            <div className="grid2">
                <Field label="Type">
                    <select value={a.type} onChange={(e) => setA({ ...a, type: e.target.value as ApptType })}>
                        {(['tour', 'discovery', 'follow-up', 'contract', 'design', 'construction', 'closing', 'internal', 'other'] as ApptType[]).map((t) => (
                            <option key={t}>{t}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Duration (min)">
                    <input type="number" value={a.duration} min={5} step={15} onChange={(e) => setA({ ...a, duration: Number(e.target.value) || 30 })} />
                </Field>
                <Field label="Start">
                    <input type="datetime-local" value={a.start} onChange={(e) => setA({ ...a, start: e.target.value })} />
                </Field>
                <Field label="Location">
                    <input value={a.location ?? ''} onChange={(e) => setA({ ...a, location: e.target.value })} />
                </Field>
            </div>
            <div className="sticky-actions">
                {exists && (
                    <button
                        className="btn danger"
                        onClick={() => {
                            onDelete(a.id);
                            onClose();
                        }}
                    >
                        Delete
                    </button>
                )}
                <button
                    className="btn primary"
                    onClick={() => {
                        if (!a.title.trim()) return;
                        onSave(a);
                        onClose();
                    }}
                >
                    Save
                </button>
            </div>
        </Sheet>
    );
}

const GROUPS: { key: TaskCategory; title: string }[] = [
    { key: 'priority', title: 'Priority Tasks' },
    { key: 'deadline', title: 'Upcoming Deadlines' },
    { key: 'followup', title: 'Buyer Follow-Ups' },
    { key: 'internal', title: 'Internal Actions' },
    { key: 'question', title: 'Questions Needing Answers' }
];

function Tasks() {
    const { data, update } = useStore();
    const { openBuyer } = useNav();
    const [adding, setAdding] = useState<TaskCategory | null>(null);
    const [showDone, setShowDone] = useState(false);
    const [plan, setPlan] = useState(false);

    const toggle = (id: string) => update((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }));
    const remove = (id: string) => update((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
    const due = dueFollowUps(data);

    const nextSteps = useMemo(
        () =>
            data.buyers
                .filter(isActive)
                .sort((a, b) => likelihood(b) - likelihood(a))
                .slice(0, 6),
        [data.buyers]
    );

    const sortTasks = (ts: Task[]) => [...ts].sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? '9999').localeCompare(b.due ?? '9999'));

    const planText = useMemo(() => {
        const lines = [`DAILY PLAN — ${fmtLongDate(today())}`, ''];
        const appts = data.appointments.filter((a) => a.start.startsWith(today())).sort((a, b) => a.start.localeCompare(b.start));
        if (appts.length) lines.push('Appointments:', ...appts.map((a) => `• ${fmtTime(a.start)} ${a.title}`), '');
        for (const g of GROUPS) {
            const ts = data.tasks.filter((t) => t.category === g.key && !t.done);
            const extra = g.key === 'followup' ? due.map((b) => `${b.name} — ${nextAction(b, data.homes)}`) : [];
            const all = [...ts.map((t) => `${t.title}${t.due ? ` (${relDay(t.due)})` : ''}`), ...extra];
            if (all.length) lines.push(`${g.title}:`, ...all.map((x) => `• ${x}`), '');
        }
        lines.push('Next Steps:', ...nextSteps.map((b) => `• ${b.name}: ${nextAction(b, data.homes)}`));
        return lines.join('\n');
    }, [data, due, nextSteps]);

    return (
        <>
            <div className="row gap" style={{ marginTop: 12 }}>
                <button className="btn primary sm" onClick={() => setAdding('priority')}>
                    <Icon name="plus" size={16} /> Task
                </button>
                <button className="btn sm" onClick={() => setPlan(!plan)}>
                    {plan ? 'Hide' : 'Copy'} daily plan
                </button>
                <label className="row gap-sm small muted" style={{ marginLeft: 'auto' }}>
                    <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done
                </label>
            </div>
            {plan && <DraftBox channel="note" body={planText} />}

            {GROUPS.map((g) => {
                const ts = sortTasks(data.tasks.filter((t) => t.category === g.key && (showDone || !t.done)));
                return (
                    <div key={g.key}>
                        <SectionHead title={g.title} action="+ Add" onAction={() => setAdding(g.key)} />
                        <div className="list">
                            {g.key === 'followup' &&
                                due.map((b) => (
                                    <button key={b.id} className="task auto" onClick={() => openBuyer(b.id)}>
                                        <span className="tag amber">DUE</span>
                                        <span>
                                            {b.name} — {nextAction(b, data.homes)}
                                        </span>
                                        <small className={(daysUntil(b.nextFollowUp) ?? 0) < 0 ? 'neg' : 'muted'}>{relDay(b.nextFollowUp)}</small>
                                    </button>
                                ))}
                            {ts.map((t) => {
                                const b = data.buyers.find((x) => x.id === t.buyerId);
                                return (
                                    <div key={t.id} className={`task ${t.done ? 'done' : ''}`}>
                                        <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} aria-label="Done" />
                                        <span>
                                            {t.title}
                                            {b && (
                                                <button className="link small" onClick={() => openBuyer(b.id)}>
                                                    {' '}
                                                    · {b.name}
                                                </button>
                                            )}
                                        </span>
                                        {t.due && <small className={(daysUntil(t.due) ?? 0) < 0 && !t.done ? 'neg' : 'muted'}>{relDay(t.due)}</small>}
                                        <button className="icon-btn sm" onClick={() => remove(t.id)} aria-label="Delete task">
                                            <Icon name="close" size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                            {!ts.length && !(g.key === 'followup' && due.length) && <div className="empty sm">Nothing here.</div>}
                        </div>
                    </div>
                );
            })}

            <SectionHead title="Next Steps" />
            <div className="list">
                {nextSteps.map((b) => (
                    <button key={b.id} className="row-item" onClick={() => openBuyer(b.id)}>
                        <div className="row-main">
                            <div className="row-title">{b.name}</div>
                            <div className="row-sub">
                                {stageShort(b.stage)} · {nextAction(b, data.homes)}
                            </div>
                        </div>
                        <Icon name="chev" size={16} />
                    </button>
                ))}
            </div>

            {adding && <TaskForm category={adding} onClose={() => setAdding(null)} />}
        </>
    );
}

function TaskForm({ category, onClose }: { category: TaskCategory; onClose: () => void }) {
    const { data, update } = useStore();
    const [t, setT] = useState<Task>({ id: uid(), title: '', category, done: false, createdAt: toDateTime(new Date()) });
    return (
        <Sheet title="New task" onClose={onClose}>
            <Field label="Task">
                <input value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} autoFocus />
            </Field>
            <div className="grid2">
                <Field label="Category">
                    <select value={t.category} onChange={(e) => setT({ ...t, category: e.target.value as TaskCategory })}>
                        {GROUPS.map((g) => (
                            <option key={g.key} value={g.key}>
                                {g.title}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Due">
                    <input type="date" value={t.due ?? ''} onChange={(e) => setT({ ...t, due: e.target.value || undefined })} />
                </Field>
            </div>
            <Field label="Buyer (optional)">
                <select value={t.buyerId ?? ''} onChange={(e) => setT({ ...t, buyerId: e.target.value || undefined })}>
                    <option value="">—</option>
                    {data.buyers.map((b) => (
                        <option key={b.id} value={b.id}>
                            {b.name}
                        </option>
                    ))}
                </select>
            </Field>
            <div className="sticky-actions">
                <button
                    className="btn primary"
                    onClick={() => {
                        if (!t.title.trim()) return;
                        update((d) => ({ ...d, tasks: [t, ...d.tasks] }));
                        onClose();
                    }}
                >
                    Add task
                </button>
            </div>
        </Sheet>
    );
}
