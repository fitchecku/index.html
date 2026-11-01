import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { copyText, wordCount } from './util';
import { placeholderCount } from './templates';
import { useStore } from './store';

/* -------------------------------- Icons -------------------------------- */

const paths: Record<string, string> = {
    home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    users: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM22 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
    pen: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    plus: 'M12 5v14M5 12h14',
    back: 'M15 18l-6-6 6-6',
    close: 'M6 6l12 12M18 6L6 18',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
    phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z',
    mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
    msg: 'M4 5h16v11H8l-4 4z',
    check: 'M5 12l5 5L20 7',
    alert: 'M12 4l9 16H3zM12 10v4M12 17v.5',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
    copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
    edit: 'M4 20h4L19 9l-4-4L4 16z',
    chev: 'M9 6l6 6-6 6',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    hammer: 'M14 6l4 4M3 21l9-9M12 4l6 6-3 3-6-6z',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .2-1.2-1.6.6-2-2.8-1.4L13 4.6h-2l-1.6-1.4-2.8 1.4.6 2L6 8.2 4 8l-1 3 2 1-2 1 1 3 2-.2 1.2 1.6-.6 2 2.8 1.4 1.6-1.4h2l1.6 1.4 2.8-1.4-.6-2 1.2-1.6 2 .2 1-3z'
};

export function Icon({ name, size = 20, className = '' }: { name: keyof typeof paths | string; size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <path d={paths[name] ?? ''} />
        </svg>
    );
}

/* -------------------------------- Charts -------------------------------- */

export function AreaChart({ points, up, height = 170, onHover }: { points: number[]; up: boolean; height?: number; onHover?: (i: number | null) => void }) {
    const w = 600;
    const [hover, setHover] = useState<number | null>(null);
    const gid = `fill-${useId().replace(/:/g, '')}`;
    const { d, area, coords } = useMemo(() => {
        if (points.length < 2) return { d: '', area: '', coords: [] as [number, number][] };
        const min = Math.min(...points);
        const max = Math.max(...points);
        const span = max - min || 1;
        const coords = points.map((p, i) => [(i / (points.length - 1)) * w, 10 + (1 - (p - min) / span) * (height - 20)] as [number, number]);
        const d = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        return { d, area: `${d} L${w},${height} L0,${height} Z`, coords };
    }, [points, height]);
    const color = up ? 'var(--green)' : 'var(--red)';
    if (!d) return <div className="chart-empty">Your trend appears after a couple of days of use.</div>;
    const move = (e: React.PointerEvent<SVGSVGElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        const i = Math.round(((e.clientX - r.left) / r.width) * (points.length - 1));
        const idx = Math.max(0, Math.min(points.length - 1, i));
        setHover(idx);
        onHover?.(idx);
    };
    const leave = () => {
        setHover(null);
        onHover?.(null);
    };
    return (
        <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="chart" onPointerMove={move} onPointerLeave={leave} role="img" aria-label="Weighted pipeline trend">
            <defs>
                <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gid})`} />
            <path d={d} fill="none" stroke={color} strokeWidth={2.4} vectorEffect="non-scaling-stroke" />
            {hover !== null && coords[hover] && (
                <>
                    <line x1={coords[hover][0]} x2={coords[hover][0]} y1={0} y2={height} stroke="var(--muted)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                    <circle cx={coords[hover][0]} cy={coords[hover][1]} r={5} fill={color} vectorEffect="non-scaling-stroke" />
                </>
            )}
        </svg>
    );
}

export function Meter({ value, color }: { value: number; color?: string }) {
    const c = color ?? (value >= 70 ? 'var(--green)' : value >= 40 ? 'var(--amber)' : 'var(--red)');
    return (
        <div className="meter" aria-label={`${value}%`}>
            <span style={{ width: `${value}%`, background: c }} />
        </div>
    );
}

/* -------------------------------- Layout bits -------------------------------- */

export function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
    return (
        <div className="section-head">
            <h2>{title}</h2>
            {action && (
                <button className="link" onClick={onAction}>
                    {action}
                </button>
            )}
        </div>
    );
}

export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
    const close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, []);
    return (
        <div className="sheet-backdrop" onClick={onClose}>
            <div className={`sheet ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
                <div className="sheet-head">
                    <h3>{title}</h3>
                    <button className="icon-btn" onClick={onClose} aria-label="Close">
                        <Icon name="close" />
                    </button>
                </div>
                <div className="sheet-body">{children}</div>
            </div>
        </div>
    );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
    return (
        <label className="field">
            <span>{label}</span>
            {children}
            {hint && <small>{hint}</small>}
        </label>
    );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: NoInfer<T>; label: string }[]; onChange: (v: T) => void }) {
    return (
        <div className="segmented" role="tablist">
            {options.map((o) => (
                <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export function Empty({ children }: { children: ReactNode }) {
    return <div className="empty">{children}</div>;
}

/** Output box for generated drafts: editable, word count, placeholder warning, copy/send. */
export function DraftBox({ subject, body, channel, to, maxWords = 250 }: { subject?: string; body: string; channel: 'email' | 'text' | 'note'; to?: string; maxWords?: number }) {
    const { toast } = useStore();
    const [subj, setSubj] = useState(subject ?? '');
    const [text, setText] = useState(body);
    const [lastBody, setLastBody] = useState(body);
    const [lastSubj, setLastSubj] = useState(subject);
    if (body !== lastBody) {
        setLastBody(body);
        setText(body);
    }
    if (subject !== lastSubj) {
        setLastSubj(subject);
        setSubj(subject ?? '');
    }
    const words = wordCount(text);
    const holes = placeholderCount(subj + text);
    const over = channel === 'email' && words > maxWords;
    const long = channel === 'text' && text.length > 320;
    const href =
        channel === 'email'
            ? `mailto:${to ?? ''}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(text)}`
            : channel === 'text'
              ? `sms:${to ?? ''}?&body=${encodeURIComponent(text)}`
              : undefined;
    return (
        <div className="draft">
            {channel === 'email' && <input className="draft-subject" value={subj} onChange={(e) => setSubj(e.target.value)} placeholder="Subject" aria-label="Subject" />}
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={channel === 'text' ? 4 : 12} aria-label="Draft" />
            <div className="draft-meta">
                <span className={over || long ? 'neg' : ''}>
                    {channel === 'text' ? `${text.length} chars${long ? ' · consider shortening' : ''}` : `${words} words${over ? ` · over ${maxWords}` : ''}`}
                </span>
                {holes > 0 && <span className="warn">⚠ {holes} [bracket] item{holes > 1 ? 's' : ''} to confirm before sending</span>}
            </div>
            <div className="row gap">
                <button
                    className="btn"
                    onClick={async () => {
                        await copyText(channel === 'email' && subj ? `Subject: ${subj}\n\n${text}` : text);
                        toast('Copied');
                    }}
                >
                    <Icon name="copy" size={16} /> Copy
                </button>
                {href && (
                    <a className="btn primary" href={href}>
                        <Icon name={channel === 'email' ? 'mail' : 'msg'} size={16} /> Open in {channel === 'email' ? 'Mail' : 'Messages'}
                    </a>
                )}
            </div>
        </div>
    );
}

export function Pill({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'green' | 'red' | 'amber' | 'blue' }) {
    return <span className={`pill ${tone}`}>{children}</span>;
}
