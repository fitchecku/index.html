import { strict as assert } from 'node:assert';
import { addDays, daysUntil, fmtTime, money, monthlyPayment, parseDate, relDay, relDayInline, toDate, today, wordCount, firstName } from '../src/app/util';
import { likelihood, risks, qualificationGaps, matchingHomes, nextAction, pipelineValue } from '../src/app/logic';
import { normalize, sampleData } from '../src/app/store';
import { scheduleCheck } from '../src/app/screens/Agenda';
import type { Appointment } from '../src/app/types';
import { generateMessage, MESSAGE_KINDS, internalMessage, placeholderCount, prepText } from '../src/app/templates';

let failed = 0;
const t = (name: string, fn: () => void) => { try { fn(); console.log('ok  ', name); } catch (e: any) { failed++; console.log('FAIL', name, '\n     ', e.message); } };

t('addDays across month/year', () => { assert.equal(addDays('2026-12-30', 3), '2027-01-02'); assert.equal(addDays('2026-03-01', -1), '2026-02-28'); });
t('addDays across DST', () => { assert.equal(addDays('2026-03-07', 1), '2026-03-08'); assert.equal(addDays('2026-11-01', 1), '2026-11-02'); });
t('daysUntil today/±', () => { assert.equal(daysUntil(today()), 0); assert.equal(daysUntil(addDays(today(), 5)), 5); assert.equal(daysUntil(addDays(today(), -3)), -3); assert.equal(daysUntil(undefined), undefined); });
t('daysUntil with datetime', () => assert.equal(daysUntil(`${today()}T23:59`), 0));
t('parseDate local', () => assert.equal(toDate(parseDate('2026-01-15')), '2026-01-15'));
t('parseDate datetime local', () => { const d = parseDate('2026-01-15T09:30'); assert.equal(d.getHours(), 9); assert.equal(d.getDate(), 15); });
t('fmtTime', () => assert.match(fmtTime('2026-01-15T14:05'), /2:05\s?PM/));
t('money', () => { assert.equal(money(459900), '$459,900'); assert.equal(money(459900, true), '$460K'); assert.equal(money(1810121, true), '$1.81M'); assert.equal(money(undefined), '—'); assert.equal(money(NaN), '—'); assert.equal(money(0), '$0'); });
t('money compact rounding edge', () => assert.equal(money(999999, true), '$1.00M'));
t('relDay', () => { assert.equal(relDay(today()), 'Today'); assert.equal(relDay(addDays(today(), 1)), 'Tomorrow'); assert.equal(relDay(addDays(today(), -4)), '4d ago'); assert.equal(relDay(undefined), '—'); });
t('relDayInline', () => { assert.equal(relDayInline(addDays(today(), 3)), 'in 3d'); assert.equal(relDayInline(today()), 'today'); assert.match(relDayInline(addDays(today(), 30)), /^[A-Z][a-z]{2} \d+$/); });
t('wordCount', () => { assert.equal(wordCount(''), 0); assert.equal(wordCount('  a  b\nc '), 3); });
t('firstName', () => { assert.equal(firstName('Jordan & Taylor'), 'Jordan'); assert.equal(firstName('  '), '  '); });
t('monthlyPayment standard', () => { const p = monthlyPayment(400000, 20, 6, 30); assert.ok(Math.abs(p - 1918.56) < 0.1, String(p)); });
t('monthlyPayment 0%', () => assert.ok(Math.abs(monthlyPayment(360000, 0, 0, 30) - 1000) < 0.01));
t('monthlyPayment bad inputs finite', () => { for (const [a, b, c, e] of [[400000, 10, 6, 0], [400000, 120, 6, 30], [-5, 10, 6, 30], [400000, 10, -1, 30], [NaN, 10, 6, 30]]) { const args = [a, b, c, e]; const v = monthlyPayment(a, b, c, e); assert.ok(Number.isFinite(v) && v >= 0, `${args} -> ${v}`); } });

const d = sampleData();
t('sample likelihoods in range', () => d.buyers.forEach((b) => { const l = likelihood(b); assert.ok(l >= 0 && l <= 100, `${b.name} ${l}`); }));
t('pipeline positive', () => assert.ok(pipelineValue(d.buyers) > 0));
t('closed/lost have no risks', () => d.buyers.filter((b) => b.stage === 'closed').forEach((b) => assert.equal(risks(b, d.homes).length, 0)));
t('new lead has gaps', () => assert.equal(qualificationGaps(d.buyers.find((b) => b.stage === 'lead')!).length, 10));
t('nextAction always text', () => d.buyers.forEach((b) => assert.ok(nextAction(b, d.homes).length > 5)));
t('matchingHomes excludes over budget', () => { const b = d.buyers.find((x) => x.name.startsWith('Chris'))!; matchingHomes(b, d.homes).forEach((h) => assert.ok(h.price <= (b.budgetMax ?? 0) * 1.05, h.address)); });
t('templates render for every buyer/kind/channel w/o "undefined"', () => {
  for (const b of [undefined, ...d.buyers]) for (const k of MESSAGE_KINDS) for (const ch of ['email', 'text'] as const) {
    const m = generateMessage(k.key, ch, { b, s: d.settings, homes: d.homes });
    assert.ok(m.body.length > 20, `${k.key} empty`);
    assert.ok(!/undefined|NaN|null/.test(m.subject + m.body), `${b?.name} ${k.key} ${ch}: ${m.body}`);
    if (ch === 'email') assert.ok(wordCount(m.body) <= 250, `${k.key} ${wordCount(m.body)} words`);
  }
});
t('internal message no undefined / clean ref', () => d.buyers.forEach((b) => { const m = internalMessage('PM', { b, s: d.settings, homes: d.homes, objective: 'X', action: '', deadline: '', context: '' }); assert.ok(!/undefined|  /.test(m.subject), m.subject); }));
t('prepText no undefined', () => d.buyers.forEach((b) => assert.ok(!/undefined/.test(prepText('tour', { b, s: d.settings, homes: d.homes })))));
t('placeholderCount', () => assert.equal(placeholderCount('a [x] b [y z]'), 2));

const ap = (start: string, duration: number, title: string, location = 'Model'): Appointment => ({ id: title, title, start, duration, type: 'tour', location });
t('schedule: long block overlap caught', () => {
  const r = scheduleCheck([ap('2026-01-05T09:00', 180, 'Long'), ap('2026-01-05T10:00', 30, 'B'), ap('2026-01-05T11:00', 30, 'C')], 0, '2026-01-05');
  assert.equal(r.filter((x) => x.text.startsWith('Conflict')).length, 2, JSON.stringify(r));
});
t('schedule: travel warning', () => { const r = scheduleCheck([ap('2026-01-05T09:00', 60, 'A', 'Model'), ap('2026-01-05T10:10', 30, 'B', 'Lot 12')], 0, '2026-01-05'); assert.ok(r.some((x) => x.text.includes('travel time'))); });
t('schedule: no past slot suggested today', () => {
  const now = new Date(2026, 0, 5, 14, 10);
  const r = scheduleCheck([], 2, '2026-01-05', now);
  assert.ok(r[0].text.includes('2:30 PM'), r[0].text);
});
t('schedule: late day has no slot', () => { const r = scheduleCheck([], 1, '2026-01-05', new Date(2026, 0, 5, 18, 5)); assert.ok(r[0].text.includes('no open'), r[0].text); });
t('normalize rejects junk, fills gaps', () => {
  assert.equal(normalize(null), null); assert.equal(normalize({ version: 2, buyers: [] }), null);
  const d = normalize({ version: 1, buyers: [{ id: 'x', name: 'A' }, { name: 'no id' }] })!;
  assert.equal(d.buyers.length, 1); assert.deepEqual(d.buyers[0].interactions, []); assert.deepEqual(d.tasks, []); assert.equal(d.settings.rate, 6.5);
});
t('never-contacted old lead flagged high', () => {
  const b = { ...d.buyers.find((x) => x.stage === 'lead')!, createdAt: addDays(today(), -3) + 'T09:00', lastContact: undefined };
  assert.ok(risks(b, d.homes).some((r) => r.level === 'high' && r.text.includes('not contacted')));
});

if (failed) { console.log(`\n${failed} failed`); process.exit(1); } else console.log('\nall passed');
