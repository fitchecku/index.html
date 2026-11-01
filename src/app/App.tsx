import { createContext, useContext, useEffect, useState } from 'react';
import { StoreProvider, useStore } from './store';
import { ConfirmDialog, Icon } from './ui';
import Home from './screens/Home';
import Buyers from './screens/Buyers';
import BuyerDetail from './screens/BuyerDetail';
import Compose from './screens/Compose';
import Agenda from './screens/Agenda';
import Tools from './screens/Tools';

export type Tab = 'home' | 'buyers' | 'write' | 'agenda' | 'tools';

export interface ComposeParams {
    mode?: 'buyer' | 'internal' | 'prep';
    buyerId?: string;
    kind?: string;
    channel?: 'email' | 'text';
    apptId?: string;
}

export interface Nav {
    tab: Tab;
    buyerId?: string;
    compose?: ComposeParams;
    tool?: string;
    agendaView?: 'schedule' | 'tasks';
}

interface NavCtx {
    nav: Nav;
    go: (n: Partial<Nav> & { tab: Tab }) => void;
    openBuyer: (id: string) => void;
    closeBuyer: () => void;
    /** Return to the previous screen (same as the phone/browser Back button). */
    back: (fallback: Nav) => void;
}

const Ctx = createContext<NavCtx | null>(null);
export const useNav = () => useContext(Ctx)!;

const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'home', label: 'Home', icon: 'home' },
    { key: 'buyers', label: 'Buyers', icon: 'users' },
    { key: 'write', label: 'Write', icon: 'pen' },
    { key: 'agenda', label: 'Agenda', icon: 'calendar' },
    { key: 'tools', label: 'Playbook', icon: 'grid' }
];

function Shell() {
    const [nav, setNav] = useState<Nav>({ tab: 'home' });
    const { toastMsg, data } = useStore();

    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, [nav.tab, nav.buyerId, nav.tool]);

    // Wire screens into browser history so the phone/browser Back button works.
    useEffect(() => {
        try {
            history.replaceState({ nav: { tab: 'home' }, depth: 0 }, '');
        } catch {
            /* history unavailable in this host — in-app navigation still works */
        }
        const onPop = (e: PopStateEvent) => setNav((e.state?.nav as Nav) ?? { tab: 'home' });
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);

    const push = (next: Nav) => {
        try {
            const depth = ((history.state?.depth as number) ?? 0) + 1;
            history.pushState({ nav: next, depth }, '');
        } catch {
            /* ignore */
        }
        setNav(next);
    };

    const value: NavCtx = {
        nav,
        go: (n) => push({ ...n }),
        openBuyer: (id) => push({ ...nav, buyerId: id }),
        closeBuyer: () => value.back({ ...nav, buyerId: undefined }),
        back: (fallback) => {
            let depth = 0;
            try {
                depth = history.state?.depth ?? 0;
            } catch {
                /* ignore */
            }
            if (depth > 0) history.back();
            else setNav(fallback);
        }
    };

    const buyerOpen = nav.buyerId && data.buyers.some((b) => b.id === nav.buyerId);

    return (
        <Ctx.Provider value={value}>
            <div className="app">
                <main className="screen">
                    {buyerOpen ? (
                        <BuyerDetail id={nav.buyerId!} />
                    ) : (
                        <>
                            {nav.tab === 'home' && <Home />}
                            {nav.tab === 'buyers' && <Buyers />}
                            {nav.tab === 'write' && <Compose params={nav.compose} />}
                            {nav.tab === 'agenda' && <Agenda initial={nav.agendaView} />}
                            {nav.tab === 'tools' && <Tools tool={nav.tool} />}
                        </>
                    )}
                </main>
                <nav className="tabbar" aria-label="Main">
                    {TABS.map((t) => (
                        <button key={t.key} className={nav.tab === t.key && !buyerOpen ? 'on' : ''} onClick={() => push({ tab: t.key })} aria-current={nav.tab === t.key}>
                            <Icon name={t.icon} size={22} />
                            <span>{t.label}</span>
                        </button>
                    ))}
                </nav>
                <ConfirmDialog />
                {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
            </div>
        </Ctx.Provider>
    );
}

export default function App() {
    return (
        <StoreProvider>
            <Shell />
        </StoreProvider>
    );
}
