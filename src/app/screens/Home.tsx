import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useNav } from '../App';
import { AreaChart, Icon, Pill, SectionHead, Segmented } from '../ui';
import { closingsThisMonth, dueFollowUps, isActive, isUnderContract, likelihood, needsAttention, nextAction, pipelineValue, risks, stageShort } from '../logic';
import { addDays, daysUntil, fmtDate, fmtTime, money, relDay, relDayInline, today } from '../util';

type Range = '1W' | '1M' | '3M' | '1Y' | 'ALL';
const RANGE_DAYS: Record<Range, number> = { '1W': 7, '1M': 30, '3M': 90, '1Y': 365, ALL: 100000 };

export default function Home() {
    const { data } = useStore();
    const { openBuyer, go } = useNav();
    const [range, setRange] = useState<Range>('1M');
    const [hover, setHover] = useState<number | null>(null);
    const t = today();

    const series = useMemo(() => {
        const from = addDays(t, -RANGE_DAYS[range]);
        return data.history.filter((h) => h.date >= from);
    }, [data.history, range, t]);

    const current = Math.round(pipelineValue(data.buyers));
    const shown = hover !== null && series[hover] ? series[hover].value : current;
    const start = series[0]?.value ?? current;
    const change = shown - start;
    const pct = start ? (change / start) * 100 : 0;
    const up = change >= 0;

    const todays = data.appointments.filter((a) => a.start.startsWith(t)).sort((a, b) => a.start.localeCompare(b.start));
    const active = data.buyers.filter(isActive);
    const contract = data.buyers.filter(isUnderContract);
    const closing = closingsThisMonth(data.buyers);
    const due = dueFollowUps(data);
    const watch = data.buyers.filter((b) => b.starred && b.stage !== 'lost');

    const headlines = useMemo(() => {
        const out: { id: string; tag: string; tone: 'red' | 'amber' | 'green' | 'blue'; title: string; sub: string }[] = [];
        for (const b of data.buyers) {
            const r = risks(b, data.homes);
            const high = r.find((x) => x.level === 'high');
            if (high) out.push({ id: b.id, tag: 'ALERT', tone: 'red', title: `${b.name}: ${high.text}`, sub: nextAction(b, data.homes) });
            else if (needsAttention(b, data.homes)) out.push({ id: b.id, tag: 'WATCH', tone: 'amber', title: `${b.name} needs attention`, sub: r.map((x) => x.text).join(' · ') });
            const cd = daysUntil(b.closingDate);
            if (cd !== undefined && cd >= 0 && cd <= 14 && b.stage !== 'closed') out.push({ id: b.id, tag: 'CLOSING', tone: 'green', title: `${b.name} closes ${relDayInline(b.closingDate)}`, sub: 'Confirm walkthrough, title and utilities' });
            if (b.stage === 'closed' && !b.referralAsked && (daysUntil(b.closingDate) ?? 0) <= -21)
                out.push({ id: b.id, tag: 'REFERRAL', tone: 'blue', title: `Ask ${b.name} for a review or referral`, sub: `Closed ${fmtDate(b.closingDate)} — great time to ask` });
        }
        for (const h of data.homes) {
            const d = daysUntil(h.incentiveDeadline);
            if (h.status === 'available' && d !== undefined && d >= 0 && d <= 7)
                out.push({ id: '', tag: 'DEADLINE', tone: 'amber', title: `Incentive on ${h.address} ends ${relDayInline(h.incentiveDeadline)}`, sub: h.incentive ?? '' });
        }
        const order = { ALERT: 0, CLOSING: 1, DEADLINE: 2, WATCH: 3, REFERRAL: 4 } as Record<string, number>;
        return out.sort((a, b) => order[a.tag] - order[b.tag]).slice(0, 6);
    }, [data]);

    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const now = Date.now();

    return (
        <div>
            <header className="topbar">
                <div>
                    <div className="eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                    <h1 className="greet">
                        {greet}
                        {data.settings.name && data.settings.name !== 'Your Name' ? `, ${data.settings.name.split(' ')[0]}` : ''}
                    </h1>
                </div>
                <button className="icon-btn" onClick={() => go({ tab: 'tools', tool: 'settings' })} aria-label="Settings">
                    <Icon name="gear" />
                </button>
            </header>

            {data.isSample && (
                <div className="banner">
                    You're viewing sample data. <button className="link" onClick={() => go({ tab: 'tools', tool: 'settings' })}>Start fresh in Settings</button>
                </div>
            )}

            {/* ESPN-style scoreboard */}
            <div className="scoreboard" aria-label="Today's appointments">
                {todays.length === 0 && <div className="score-card muted-card">No appointments today</div>}
                {todays.map((a) => {
                    const s = new Date(a.start).getTime();
                    const live = now >= s && now <= s + a.duration * 60000;
                    const done = now > s + a.duration * 60000;
                    return (
                        <button key={a.id} className="score-card" onClick={() => (a.buyerId ? openBuyer(a.buyerId) : go({ tab: 'agenda' }))}>
                            <div className="score-top">
                                <span className={live ? 'live' : done ? 'final' : 'upcoming'}>{live ? '● LIVE' : done ? 'FINAL' : fmtTime(a.start)}</span>
                                <span className="score-type">{a.type.toUpperCase()}</span>
                            </div>
                            <div className="score-title">{a.title}</div>
                            <div className="score-sub">{a.location}</div>
                        </button>
                    );
                })}
                <button className="score-card add" onClick={() => go({ tab: 'agenda' })}>
                    <Icon name="calendar" /> Full agenda
                </button>
            </div>

            {/* Robinhood-style portfolio */}
            <section className="portfolio">
                <div className="eyebrow">Weighted pipeline</div>
                <div className="big-number">{money(shown)}</div>
                <div className={`delta ${up ? 'pos' : 'neg'}`}>
                    {up ? '▲' : '▼'} {money(Math.abs(change))} ({Math.abs(pct).toFixed(2)}%) <span className="muted">{hover !== null && series[hover] ? fmtDate(series[hover].date) : range === 'ALL' ? 'All time' : `Past ${range}`}</span>
                </div>
                <AreaChart points={series.map((s) => s.value)} up={up} onHover={setHover} />
                <Segmented<Range> value={range} onChange={setRange} options={(['1W', '1M', '3M', '1Y', 'ALL'] as Range[]).map((r) => ({ value: r, label: r }))} />
                <p className="fine">Sum of each active buyer's price × likelihood to close. Updates as you log activity and advance stages.</p>
            </section>

            <div className="stat-strip">
                <button onClick={() => go({ tab: 'buyers' })}>
                    <strong>{active.length}</strong>
                    <span>Active</span>
                </button>
                <button onClick={() => go({ tab: 'buyers' })}>
                    <strong>{contract.length}</strong>
                    <span>Contract</span>
                </button>
                <button onClick={() => go({ tab: 'buyers' })}>
                    <strong>{closing.length}</strong>
                    <span>Closing/mo</span>
                </button>
                <button onClick={() => go({ tab: 'agenda', agendaView: 'tasks' })} className={due.length ? 'hot' : ''}>
                    <strong>{due.length}</strong>
                    <span>Follow-ups</span>
                </button>
            </div>

            <SectionHead title="Top Headlines" />
            {headlines.length === 0 && <div className="empty">All clear — no urgent items. 🎉</div>}
            <div className="headlines">
                {headlines.map((h, i) => (
                    <button key={i} className="headline" onClick={() => (h.id ? openBuyer(h.id) : go({ tab: 'tools', tool: 'inventory' }))}>
                        <span className={`tag ${h.tone}`}>{h.tag}</span>
                        <div>
                            <div className="headline-title">{h.title}</div>
                            <div className="headline-sub">{h.sub}</div>
                        </div>
                    </button>
                ))}
            </div>

            <SectionHead title="Follow-ups due" action={due.length ? 'All tasks' : undefined} onAction={() => go({ tab: 'agenda', agendaView: 'tasks' })} />
            {due.length === 0 && <div className="empty">You're caught up on follow-ups.</div>}
            <div className="list">
                {due.map((b) => (
                    <div key={b.id} className="row-item">
                        <button className="row-main" onClick={() => openBuyer(b.id)}>
                            <div className="row-title">{b.name}</div>
                            <div className="row-sub">
                                {stageShort(b.stage)} · due {relDay(b.nextFollowUp)} · {nextAction(b, data.homes)}
                            </div>
                        </button>
                        <button className="icon-btn green" aria-label="Draft text" onClick={() => go({ tab: 'write', compose: { mode: 'buyer', buyerId: b.id, channel: 'text' } })}>
                            <Icon name="msg" />
                        </button>
                    </div>
                ))}
            </div>

            <SectionHead title="Watchlist" action="All buyers" onAction={() => go({ tab: 'buyers' })} />
            {watch.length === 0 && <div className="empty">Star buyers to pin them here.</div>}
            <div className="list">
                {watch.map((b) => {
                    const l = likelihood(b);
                    return (
                        <button key={b.id} className="row-item" onClick={() => openBuyer(b.id)}>
                            <div className="row-main">
                                <div className="row-title">{b.name}</div>
                                <div className="row-sub">
                                    {stageShort(b.stage)} · {money(b.price ?? b.budgetMax, true)}
                                </div>
                            </div>
                            <Pill tone={l >= 70 ? 'green' : l >= 40 ? 'amber' : 'red'}>{l}%</Pill>
                        </button>
                    );
                })}
            </div>

            <Insights />
        </div>
    );
}

function Insights() {
    const { data } = useStore();
    const { go } = useNav();
    const tips: string[] = [];
    const noRef = data.buyers.filter((b) => b.stage === 'closed' && !b.referralAsked).length;
    if (noRef) tips.push(`${noRef} closed buyer${noRef > 1 ? 's haven’t' : ' hasn’t'} been asked for a review or referral. A 30-day check-in is the best moment.`);
    const noFu = data.buyers.filter((b) => isActive(b) && !b.nextFollowUp).length;
    if (noFu) tips.push(`${noFu} active buyer${noFu > 1 ? 's have' : ' has'} no next follow-up date — set one so nobody slips through.`);
    const bto = data.buyers.filter((b) => b.stage === 'construction' && (daysUntil(b.lastContact) ?? 0) < -14).length;
    if (bto) tips.push(`${bto} construction buyer${bto > 1 ? 's are' : ' is'} due a milestone update. Use Write → Construction milestone.`);
    const unverified = data.competitors.filter((c) => !c.verifiedOn).length;
    if (unverified) tips.push(`${unverified} competitor record${unverified > 1 ? 's are' : ' is'} unverified. Confirm details before using them with buyers.`);
    if (!tips.length) tips.push('Tip: after each appointment, use the Wrap-up on the buyer page to log notes, set the next follow-up and draft the recap in one step.');
    return (
        <>
            <SectionHead title="Work smarter" />
            <div className="insight" onClick={() => go({ tab: 'agenda', agendaView: 'tasks' })}>
                {tips.map((t, i) => (
                    <p key={i}>💡 {t}</p>
                ))}
            </div>
        </>
    );
}
