import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useNav } from '../App';
import { Icon, Meter, Pill } from '../ui';
import BuyerForm, { newBuyer } from './BuyerForm';
import { STAGES, isActive, isUnderContract, likelihood, needsAttention, stageShort, weightedValue } from '../logic';
import { daysUntil, money, relDay } from '../util';

type Filter = 'active' | 'attention' | 'inventory' | 'bto' | 'contract' | 'closed' | 'all';
const FILTERS: { key: Filter; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'attention', label: 'Needs attention' },
    { key: 'inventory', label: 'Move-in ready' },
    { key: 'bto', label: 'Build-to-order' },
    { key: 'contract', label: 'Under contract' },
    { key: 'closed', label: 'Closed' },
    { key: 'all', label: 'All' }
];
type Sort = 'followup' | 'likelihood' | 'value' | 'name';

export default function Buyers() {
    const { data } = useStore();
    const { openBuyer } = useNav();
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState<Filter>('active');
    const [sort, setSort] = useState<Sort>('followup');
    const [adding, setAdding] = useState(false);

    const list = useMemo(() => {
        const ql = q.toLowerCase();
        return data.buyers
            .filter((b) => !ql || [b.name, b.community, b.plan, b.email, b.phone].some((x) => x?.toLowerCase().includes(ql)))
            .filter((b) => {
                switch (filter) {
                    case 'active':
                        return isActive(b);
                    case 'attention':
                        return needsAttention(b, data.homes);
                    case 'inventory':
                        return isActive(b) && b.saleType === 'inventory';
                    case 'bto':
                        return isActive(b) && b.saleType === 'bto';
                    case 'contract':
                        return isUnderContract(b);
                    case 'closed':
                        return b.stage === 'closed';
                    default:
                        return true;
                }
            })
            .sort((a, b) => {
                if (sort === 'likelihood') return likelihood(b) - likelihood(a);
                if (sort === 'value') return weightedValue(b) - weightedValue(a);
                if (sort === 'name') return a.name.localeCompare(b.name);
                return (a.nextFollowUp ?? '9999').localeCompare(b.nextFollowUp ?? '9999');
            });
    }, [data, q, filter, sort]);

    const counts = STAGES.filter((s) => s.key !== 'lost').map((s) => ({ ...s, n: data.buyers.filter((b) => b.stage === s.key).length }));
    const maxN = Math.max(1, ...counts.map((c) => c.n));

    return (
        <div>
            <header className="topbar">
                <h1>Buyers</h1>
                <button className="btn primary sm" onClick={() => setAdding(true)}>
                    <Icon name="plus" size={16} /> Add
                </button>
            </header>

            {/* ESPN standings-style pipeline */}
            <div className="standings" aria-label="Pipeline by stage">
                {counts.map((c) => (
                    <div key={c.key} className="standing">
                        <div className="standing-bar">
                            <span style={{ height: `${(c.n / maxN) * 100}%` }} />
                        </div>
                        <strong>{c.n}</strong>
                        <small>{c.short}</small>
                    </div>
                ))}
            </div>

            <div className="search">
                <Icon name="search" size={18} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, community, plan…" aria-label="Search buyers" />
            </div>
            <div className="chips">
                {FILTERS.map((f) => (
                    <button key={f.key} className={`chip ${filter === f.key ? 'on' : ''}`} onClick={() => setFilter(f.key)}>
                        {f.label}
                    </button>
                ))}
            </div>
            <div className="sortline">
                <span className="muted">{list.length} buyers</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
                    <option value="followup">Next follow-up</option>
                    <option value="likelihood">Likelihood</option>
                    <option value="value">Weighted value</option>
                    <option value="name">Name</option>
                </select>
            </div>

            <div className="list">
                {list.map((b) => {
                    const l = likelihood(b);
                    const fu = daysUntil(b.nextFollowUp);
                    const attention = needsAttention(b, data.homes);
                    return (
                        <button key={b.id} className="row-item tall" onClick={() => openBuyer(b.id)}>
                            <div className="row-main">
                                <div className="row-title">
                                    {b.starred && <span className="star">★</span>}
                                    {b.name}
                                    {attention && <span className="dot-red" aria-label="needs attention" />}
                                </div>
                                <div className="row-sub">
                                    {stageShort(b.stage)} · {b.saleType === 'bto' ? 'Build' : 'MIR'} · {b.community ?? '—'}
                                </div>
                                <div className={`row-sub ${fu !== undefined && fu < 0 ? 'neg' : ''}`}>Follow-up {relDay(b.nextFollowUp)}</div>
                            </div>
                            <div className="row-right">
                                <div className="row-price">{money(b.price ?? b.budgetMax, true)}</div>
                                <Pill tone={b.stage === 'closed' ? 'green' : l >= 70 ? 'green' : l >= 40 ? 'amber' : 'red'}>{b.stage === 'closed' ? 'Closed' : `${l}%`}</Pill>
                                {isActive(b) && <Meter value={l} />}
                            </div>
                        </button>
                    );
                })}
                {list.length === 0 && <div className="empty">No buyers here yet.</div>}
            </div>
            {adding && <BuyerForm initial={newBuyer()} onClose={() => setAdding(false)} onSaved={(b) => openBuyer(b.id)} />}
        </div>
    );
}
