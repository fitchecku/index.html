import type { Appointment, ApptType, Buyer, Home, Settings } from './types';
import { FINANCING_LABEL, MILESTONE_INFO, likelihood, matchingHomes, nextAction, qualificationGaps, risks, stageLabel } from './logic';
import { firstName, fmtDate, fmtLongDate, fmtTime, money } from './util';

/** Anything wrapped in [brackets] must be confirmed or filled in before sending. */
export const placeholderCount = (s: string) => (s.match(/\[[^\]]+\]/g) || []).length;

export type Channel = 'email' | 'text';

export const MESSAGE_KINDS: { key: string; label: string; group: string }[] = [
    { key: 'new-lead', label: 'New lead welcome', group: 'Prospecting' },
    { key: 'appt-confirm', label: 'Appointment confirmation', group: 'Prospecting' },
    { key: 'post-visit', label: 'Post-visit follow-up', group: 'Prospecting' },
    { key: 'inventory-options', label: 'Move-in ready options', group: 'Prospecting' },
    { key: 'check-in', label: 'Friendly check-in', group: 'Prospecting' },
    { key: 'financing', label: 'Financing update / lender intro', group: 'Contract' },
    { key: 'design-appt', label: 'Design appointment', group: 'Contract' },
    { key: 'milestone', label: 'Construction milestone update', group: 'Contract' },
    { key: 'pre-closing', label: 'Pre-closing checklist', group: 'Closing' },
    { key: 'post-closing', label: 'Post-closing check-in', group: 'Closing' },
    { key: 'referral', label: 'Review / referral request', group: 'Closing' }
];

export function suggestedKind(b?: Buyer): string {
    if (!b) return 'new-lead';
    return (
        {
            lead: 'new-lead',
            contacted: 'appt-confirm',
            toured: 'post-visit',
            qualified: b.saleType === 'inventory' ? 'inventory-options' : 'check-in',
            contract: b.saleType === 'bto' ? 'design-appt' : 'financing',
            design: 'design-appt',
            construction: 'milestone',
            'pre-closing': 'pre-closing',
            closed: b.referralAsked ? 'post-closing' : 'referral',
            lost: 'check-in'
        } as Record<string, string>
    )[b.stage];
}

interface Ctx {
    b?: Buyer;
    s: Settings;
    homes: Home[];
    appt?: Appointment;
}

const sig = (s: Settings) => [s.name, `New Home Sales Consultant | ${s.builder}`, s.phone, s.email].filter(Boolean).join('\n');

const homeLine = (h: Home) =>
    `• ${h.address} — ${h.plan}, ${h.beds} bd / ${h.baths} ba, ${h.sqft.toLocaleString()} sq ft, ${money(h.price)}${h.moveIn ? `, move-in ready ${fmtDate(h.moveIn)}` : ''}${h.incentive ? ` (${h.incentive}${h.incentiveDeadline ? `, through ${fmtDate(h.incentiveDeadline)}` : ''})` : ''}`;

function currentMilestone(b?: Buyer) {
    const ms = b?.milestones ?? [];
    const idx = ms.findIndex((m) => m.status === 'current');
    return { cur: ms[idx], next: ms[idx + 1] };
}

export function generateMessage(kind: string, channel: Channel, ctx: Ctx): { subject: string; body: string } {
    const { b, s, homes } = ctx;
    const fn = b ? firstName(b.name) : '[First name]';
    const comm = b?.community || s.community;
    const home = homes.find((h) => h.id === b?.homeId);
    const apptWhen = ctx.appt ? `${fmtLongDate(ctx.appt.start)} at ${fmtTime(ctx.appt.start)}` : '[day] at [time]';
    const apptWhere = ctx.appt?.location || `[location]`;
    const text = channel === 'text';

    switch (kind) {
        case 'new-lead':
            return text
                ? { subject: '', body: `Hi ${fn}, this is ${s.name} with ${s.builder}. Thanks for your interest in ${comm}! Happy to answer questions or set up a quick tour — what day works best for you?` }
                : {
                      subject: `Welcome to ${comm}, ${fn}`,
                      body: `Hi ${fn},\n\nThank you for reaching out about ${comm}. I'm ${s.name}, and I'll be your point of contact for anything you need.\n\nTo make the most of your time, I'd love to learn a little about what you're looking for — timing, size, and what matters most in your next home. From there I can point you to the plans and homes that fit best.\n\nWould you be open to a 15-minute call or a personal tour this week? Just reply with a day and time that works, and I'll take care of the rest.\n\nLooking forward to meeting you,\n${sig(s)}`
                  };
        case 'appt-confirm':
            return text
                ? { subject: '', body: `Hi ${fn}! Confirming our visit ${apptWhen} at ${apptWhere}. Reply C to confirm or let me know if another time is better. See you soon!` }
                : {
                      subject: `Confirmed: ${apptWhen}`,
                      body: `Hi ${fn},\n\nI'm looking forward to our time together.\n\nWhen: ${apptWhen}\nWhere: ${apptWhere}\nPlan for: about ${ctx.appt?.duration ?? 60} minutes\n\nTo make the visit as useful as possible, feel free to bring a list of must-haves and any questions about financing or timing.\n\nIf anything changes, just reply here or text me at ${s.phone || '[phone]'}.\n\nSee you soon,\n${sig(s)}`
                  };
        case 'post-visit': {
            const concern = b?.concerns ? ` You mentioned ${b.concerns.toLowerCase()} — I've put together a few options so you can see the numbers clearly.` : '';
            return text
                ? { subject: '', body: `Hi ${fn}, thanks again for visiting ${comm} today! What stood out most to you? Happy to answer any questions that came up.` }
                : {
                      subject: `Great meeting you, ${fn}`,
                      body: `Hi ${fn},\n\nThank you for taking the time to visit ${comm}. I enjoyed getting to know you and hearing what you're looking for.${concern}\n\nQuick recap:\n• ${home ? `${home.address} (${home.plan}) — ${money(home.price)}` : '[Home or plan you viewed]'}\n• ${b?.mustHaves ? `Your must-haves: ${b.mustHaves}` : '[What mattered most to them]'}\n\nNext step: ${b ? nextAction(b, homes) : '[next step]'}.\n\nWhat questions came up after your visit? Reply anytime — I'm happy to help however is most useful.\n\nWarmly,\n${sig(s)}`
                  };
        }
        case 'inventory-options': {
            const list = b ? matchingHomes(b, homes) : homes.filter((h) => h.status === 'available').slice(0, 3);
            return text
                ? { subject: '', body: `Hi ${fn}, I pulled ${list.length || 'a few'} move-in ready homes that fit what you described. Want me to email the details or set up a quick look this week?` }
                : {
                      subject: `Move-in ready homes that fit your plans`,
                      body: `Hi ${fn},\n\nBased on what you shared, here are the move-in ready homes I'd look at first:\n\n${list.length ? list.map(homeLine).join('\n') : '[Add matching homes]'}\n\nIncentives and availability can change, so I'll always confirm the latest before we make any decisions. Your lender can also show you the estimated monthly payment for each.\n\nWould you like to see any of these in person? Just reply with a time that works.\n\nBest,\n${sig(s)}`
                  };
        }
        case 'check-in':
            return text
                ? { subject: '', body: `Hi ${fn}, just checking in — any questions I can help with on your home search? No rush at all.` }
                : {
                      subject: `Checking in`,
                      body: `Hi ${fn},\n\nI wanted to check in and see how your home search is going. If anything has changed with your timing or what you're looking for, I'm happy to adjust and send over options that fit.\n\nIs there anything I can answer for you right now?\n\nBest,\n${sig(s)}`
                  };
        case 'financing':
            return text
                ? { subject: '', body: `Hi ${fn}, quick financing update: ${b?.lender ? `${b.lender} is` : 'your lender is'} working on [next item]. Anything you need from me this week?` }
                : {
                      subject: `Financing update & next steps`,
                      body: `Hi ${fn},\n\nHere's where things stand with financing.\n\nCurrent status: ${b ? FINANCING_LABEL[b.financing] : '[status]'}${b?.lender ? ` with ${b.lender}` : ''}\nWhat's next: [confirm next lender step, e.g., appraisal or document review]\nYour action: [any documents or signatures needed]\n\nResponding to lender requests quickly is the best way to keep your timeline on track. If anything is unclear, reply here and I'll help sort it out.\n\nBest,\n${sig(s)}`
                  };
        case 'design-appt':
            return text
                ? { subject: '', body: `Hi ${fn}! Your design center appointment is ${apptWhen}. Start saving photos of looks you love — it's the fun part!` }
                : {
                      subject: `Your design center appointment`,
                      body: `Hi ${fn},\n\nThis is one of the most exciting parts of building — making the home yours.\n\nAppointment: ${apptWhen}\nLocation: ${apptWhere}\n\nTo prepare:\n• Save inspiration photos (kitchens, flooring, colors)\n• Think about your budget for upgrades\n• Bring everyone involved in decisions\n\nSelections are typically finalized at or shortly after this appointment, so they can be ordered on schedule. Questions beforehand? Just reply.\n\nBest,\n${sig(s)}`
                  };
        case 'milestone':
            return milestoneUpdate(channel, ctx);
        case 'pre-closing':
            return text
                ? { subject: '', body: `Hi ${fn}, closing is getting close! Quick checklist: homeowner insurance, utilities transfer, and final walkthrough ${ctx.appt ? apptWhen : '[date]'}. Any questions?` }
                : {
                      subject: `Getting ready for closing`,
                      body: `Hi ${fn},\n\nWe're almost there! Here's a checklist to keep everything smooth.\n\nClosing date: ${b?.closingDate ? fmtLongDate(b.closingDate) : '[confirm with title]'}\nFinal walkthrough: ${ctx.appt ? apptWhen : '[confirm date/time]'}\n\nPlease confirm:\n• Homeowner's insurance is bound\n• Utilities scheduled to transfer\n• Lender has everything they need\n• Wire instructions verified by phone with title (never by email alone)\n\nReply with any questions — I'll be with you through closing day.\n\nBest,\n${sig(s)}`
                  };
        case 'post-closing':
            return text
                ? { subject: '', body: `Hi ${fn}! How's life in the new home? Anything I can help with or connect you to customer care for?` }
                : {
                      subject: `How's the new home?`,
                      body: `Hi ${fn},\n\nI hope you're settling in and enjoying your new home!\n\nA quick reminder: if anything comes up, our customer care team is ready to help. Submitting a warranty request through [warranty process] keeps everything tracked.\n\nIs there anything I can help with right now? I'm always just a reply away.\n\nWarmly,\n${sig(s)}`
                  };
        case 'referral':
            return text
                ? { subject: '', body: `Hi ${fn}, it was a joy helping you find your home! If you know anyone thinking about a move, I'd be grateful for an introduction. And a quick review would mean a lot: [review link]` }
                : {
                      subject: `Thank you, ${fn}`,
                      body: `Hi ${fn},\n\nHelping you find your home was a real highlight for me. Thank you for your trust.\n\nIf you had a great experience, two things would mean a lot:\n• A short review: [review link]\n• An introduction to anyone you know who's thinking about a move\n\nI'll take great care of anyone you send my way. And I'm still here for you anytime.\n\nWith gratitude,\n${sig(s)}`
                  };
    }
    return { subject: '', body: '' };
}

export function milestoneUpdate(channel: Channel, { b, s }: Ctx) {
    const fn = b ? firstName(b.name) : '[First name]';
    const { cur, next } = currentMilestone(b);
    const info = cur ? MILESTONE_INFO[cur.key] : undefined;
    const timing = next?.date && next.confirmed ? `currently scheduled for ${fmtLongDate(next.date)}` : `I'll confirm timing as soon as the construction team locks it in`;
    if (channel === 'text')
        return {
            subject: '',
            body: `Hi ${fn}! Build update: your home is in the ${cur?.label.toLowerCase() ?? '[current stage]'} stage. Next up is ${next?.label.toLowerCase() ?? info?.next.toLowerCase() ?? '[next stage]'}. ${next?.date && next.confirmed ? `Scheduled ${fmtDate(next.date)}.` : "I'll share timing once confirmed."} 🏡`
        };
    return {
        subject: `Construction update: ${cur?.label ?? '[stage]'}`,
        body: `Hi ${fn},\n\nHere's your latest construction update.\n\nCurrent stage: ${cur?.label ?? '[current stage]'}\n${info?.why ?? ''}\n\nWhat's next: ${next?.label ?? info?.next ?? '[next stage]'} — ${timing}.\n\n${info?.buyerAction ? `Your action: ${info.buyerAction}\n\n` : 'No action needed from you right now.\n\n'}Construction timing can shift with weather and inspections, so I'll always share confirmed dates rather than estimates. Questions? Just reply.\n\nBest,\n${sig(s)}`
    };
}

/* -------------------------------- Internal coordination -------------------------------- */

export const INTERNAL_RECIPIENTS = ['Sales manager', 'Project manager', 'Construction team', 'Design center', 'Lender', 'Title', 'Customer care', 'Marketing'];

export function internalMessage(to: string, ctx: Ctx & { objective: string; action: string; deadline: string; context: string }) {
    const { b, s } = ctx;
    const ref = b ? `${b.name}${b.plan || b.homeId ? ` — ${b.plan ?? ''} ${ctx.homes.find((h) => h.id === b.homeId)?.address ?? ''}`.trimEnd() : ''}` : '';
    return {
        subject: `${ref ? `${ref}: ` : ''}${ctx.objective || '[Objective]'}${ctx.deadline ? ` (by ${fmtDate(ctx.deadline)})` : ''}`,
        body: `Hi ${to} team,\n\nObjective: ${ctx.objective || '[what you need to accomplish]'}\nRequired action: ${ctx.action || '[specific ask]'}\nDeadline: ${ctx.deadline ? fmtLongDate(ctx.deadline) : '[date]'}\n\nContext:\n${ctx.context || (b ? `${b.name} — ${stageLabel(b.stage)}${b.closingDate ? `, closing ${fmtDate(b.closingDate)}` : ''}. ${b.financing !== 'unknown' ? `Financing: ${FINANCING_LABEL[b.financing]}.` : ''}` : '[relevant background]')}\n\nThank you!\n${s.name}`
    };
}

/* -------------------------------- Objection library -------------------------------- */

export interface Objection {
    key: string;
    title: string;
    acknowledge: string;
    explore: string[];
    respond: string[];
    avoid: string;
}

export const OBJECTIONS: Objection[] = [
    {
        key: 'price',
        title: 'Price',
        acknowledge: "That's completely fair — this is a big investment, and you want to feel confident it's the right value.",
        explore: ['When you say it feels high, is that compared to a specific home or to your budget?', 'Is it the total price or the monthly payment that matters most?'],
        respond: ['Compare total cost of ownership: new-home energy efficiency, warranty coverage and fewer early repairs.', 'Show included features side by side with resale or competitor homes (verified data only).', 'Review current incentives and how they could apply to price, closing costs or rate.'],
        avoid: 'Defending the price before understanding what they are comparing against.'
    },
    {
        key: 'rates',
        title: 'Interest rates',
        acknowledge: 'Rates are on a lot of buyers’ minds right now — it makes sense to look closely.',
        explore: ['Have you seen what your payment looks like with a rate buydown or closing cost incentive?', 'Would a lower payment now or lower upfront cash help you more?'],
        respond: ['Have the lender model a buydown vs. price reduction so they can compare real numbers.', 'Explain that refinancing may be an option later, without promising future rates.', 'Focus on the monthly payment they are comfortable with.'],
        avoid: 'Predicting where rates will go.'
    },
    {
        key: 'payment',
        title: 'Monthly payment',
        acknowledge: 'Getting the payment right is the most important part — let’s make sure it fits comfortably.',
        explore: ['What monthly range feels comfortable, including taxes and HOA?', 'Is there flexibility on down payment or home size?'],
        respond: ['Use the payment calculator to show options across 2–3 homes.', 'Connect them with the lender for exact figures including taxes and insurance.', 'Consider a smaller plan or a different homesite to hit the target.'],
        avoid: 'Stretching them beyond a payment they named as comfortable.'
    },
    {
        key: 'competition',
        title: 'Competition / builder comparisons',
        acknowledge: 'Smart to compare — you should feel great about whichever builder you choose.',
        explore: ['What do you like most about the other community?', 'What would make the decision easy for you?'],
        respond: ['Offer an objective side-by-side on included features, warranty, timeline and incentives (verified only).', 'Point to reviews and homeowner experiences they can check themselves.', 'Highlight genuine differentiators without criticizing the other builder.'],
        avoid: 'Speaking negatively about competitors or making unverified claims.'
    },
    {
        key: 'timeline',
        title: 'Construction timeline',
        acknowledge: 'Timing matters — especially if you’re coordinating a lease or a home sale.',
        explore: ['What date do you need to be in by, and how firm is it?', 'Would a move-in ready home be worth considering?'],
        respond: ['Share the typical 4–6 month build range and what can affect it — without guaranteeing dates.', 'Explain milestone updates you will provide throughout the build.', 'Offer inventory homes as an alternative if the date is firm.'],
        avoid: 'Committing to a completion date the construction team has not confirmed.'
    },
    {
        key: 'quality',
        title: 'Quality',
        acknowledge: 'Quality is exactly what you should be asking about.',
        explore: ['Is there something specific you’ve seen or heard that concerns you?'],
        respond: ['Walk through inspections, the pre-drywall walkthrough and the warranty.', 'Offer a tour of a home under construction.', 'Encourage an independent inspection if they would like one.'],
        avoid: 'Dismissing the concern or overpromising.'
    },
    {
        key: 'location',
        title: 'Location',
        acknowledge: 'Location is something you can’t change later, so it’s worth getting right.',
        explore: ['What does your daily routine look like — work, school, activities?', 'Have you driven the commute at rush hour?'],
        respond: ['Suggest they test-drive the commute at their real times.', 'Share nearby amenities and planned area developments that are publicly confirmed.', 'Compare homesites within the community.'],
        avoid: 'Speculating on future development that isn’t confirmed.'
    },
    {
        key: 'design',
        title: 'Design choices',
        acknowledge: 'There are a lot of decisions — it’s normal to feel a little overwhelmed.',
        explore: ['Which choices feel hardest right now?', 'Which upgrades matter most to how you’ll live in the home?'],
        respond: ['Prioritize items that are hard to change later (structure, electrical, flooring).', 'Suggest a budget split between must-haves and later upgrades.', 'Share photos from completed homes.'],
        avoid: 'Pushing upgrades they did not prioritize.'
    },
    {
        key: 'availability',
        title: 'Availability',
        acknowledge: 'I understand — it’s frustrating when the right home isn’t available yet.',
        explore: ['Which features of that home were most important?', 'How flexible is your timing?'],
        respond: ['Show similar inventory or upcoming releases you can confirm.', 'Offer to notify them when a matching home is released.', 'Explain build-to-order as an option if timing allows.'],
        avoid: 'Creating urgency that isn’t real.'
    },
    {
        key: 'think',
        title: '"We need to think about it"',
        acknowledge: 'Absolutely — this is a big decision, and taking time is wise.',
        explore: ['What would you want to feel more sure about?', 'Is there anyone else who needs to see the home?'],
        respond: ['Summarize what you heard and the open questions in writing.', 'Agree on a specific, low-pressure next touchpoint.', 'Share genuine deadlines (incentive end dates) only if they exist.'],
        avoid: 'Manufacturing urgency.'
    }
];

/* -------------------------------- Discovery -------------------------------- */

export const DISCOVERY: { topic: string; questions: string[] }[] = [
    { topic: 'Lifestyle', questions: ['Walk me through a typical weekday and weekend at home.', 'How do you like to entertain or spend time together?'] },
    { topic: 'Pain points', questions: ["What's not working about your current home?", 'If you could change one thing tomorrow, what would it be?'] },
    { topic: 'Future plans', questions: ['How long do you see yourselves in this next home?', 'Any changes coming — family, work, retirement?'] },
    { topic: 'Must-haves', questions: ['What are the two or three things this home absolutely needs?'] },
    { topic: 'Nice-to-haves', questions: ["What would be a bonus but isn't a deal-breaker?"] },
    { topic: 'Budget flexibility', questions: ['What monthly payment feels comfortable?', 'Would you trade a little size for a lower payment, or the other way around?'] },
    { topic: 'Timeline', questions: ['When would you ideally like to be moved in?', 'Is that date firm or flexible?'] },
    { topic: 'Biggest concerns', questions: ["What's your biggest worry about buying right now?"] },
    { topic: 'Past experience', questions: ['Have you bought a home before? What went well, and what would you do differently?'] },
    { topic: 'Confidence level', questions: ['On a scale of 1–10, how ready do you feel? What would make it a 10?'] }
];

/* -------------------------------- Meeting prep -------------------------------- */

export function meetingPrep(type: ApptType, { b, homes }: Ctx) {
    const gaps = b ? qualificationGaps(b) : [];
    const objectives: Record<string, string[]> = {
        tour: ['Build rapport and understand their story', 'Show 1–2 homes or plans that fit', 'Agree on a clear next step'],
        discovery: ['Fill qualification gaps', 'Understand lifestyle, needs and concerns', 'Recommend a path: inventory vs. build-to-order'],
        design: ['Help them make confident selections', 'Keep upgrades aligned with budget', 'Confirm selection deadlines'],
        construction: ['Share current stage and what’s next', 'Answer questions honestly — confirmed info only', 'Note any buyer actions'],
        contract: ['Review terms clearly and answer questions', 'Confirm financing and deposit steps', 'Set expectations for next milestones'],
        closing: ['Make the walkthrough/closing smooth and celebratory', 'Document any follow-up items', 'Set up post-closing relationship'],
        'follow-up': ['Address open questions and concerns', 'Move toward a decision without pressure'],
        internal: ['Align on deadlines and owners', 'Escalate buyer risks early'],
        other: ['Clarify the purpose and desired outcome']
    };
    const likely: string[] = [];
    if (b?.concerns) likely.push(...b.concerns.split(/,|;| and /).map((x) => x.trim()).filter(Boolean));
    if (b?.saleType === 'bto') likely.push('Construction timeline');
    if (b?.saleType === 'inventory') likely.push('Monthly payment');
    if (b?.currentHome === 'own-must-sell') likely.push('Timing with selling current home');
    const talking =
        b?.saleType === 'bto'
            ? ['Personalization opportunities and design selections', 'Typical 4–6 month build and milestone updates you’ll send', 'Long-term value: efficiency, warranty, choosing their homesite']
            : ['Move-in timeline and immediate lifestyle benefits', 'Current incentives (confirmed) and their effect on payment', 'Value vs. comparable homes'];
    const outcome: Record<string, string> = {
        tour: 'Scheduled follow-up or second visit with all decision makers',
        discovery: 'Qualification complete and a recommended home/plan shortlist',
        design: 'Selections finalized or a date set to finalize',
        construction: 'Buyer feels informed and confident',
        contract: 'Signed contract or clear list of remaining questions',
        closing: 'Happy homeowner + referral/review conversation planned',
        'follow-up': 'Decision or a specific next step with a date',
        internal: 'Clear owners and deadlines',
        other: 'Clear next step'
    };
    return {
        objectives: objectives[type] ?? objectives.other,
        questions: gaps.length ? gaps.slice(0, 5).map((g) => g.question) : DISCOVERY.slice(0, 4).map((d) => d.questions[0]),
        objections: [...new Set(likely)].slice(0, 4),
        homes: b ? matchingHomes(b, homes) : [],
        talking,
        outcome: outcome[type] ?? outcome.other,
        risks: b ? risks(b, homes).map((r) => r.text) : []
    };
}

export function prepText(type: ApptType, ctx: Ctx) {
    const p = meetingPrep(type, ctx);
    const b = ctx.b;
    return [
        `MEETING PREP — ${b?.name ?? 'Appointment'} (${type})`,
        b ? `Stage: ${stageLabel(b.stage)} | ${b.saleType === 'bto' ? 'Build-to-order' : 'Move-in ready'} | Likelihood ${likelihood(b)}%` : '',
        '',
        'Objectives:',
        ...p.objectives.map((x) => `• ${x}`),
        '',
        'Questions to ask:',
        ...p.questions.map((x) => `• ${x}`),
        '',
        'Likely objections:',
        ...(p.objections.length ? p.objections.map((x) => `• ${x}`) : ['• None noted yet']),
        '',
        'Relevant homes / plans:',
        ...(p.homes.length ? p.homes.map(homeLine) : ['• [Add matching homes]']),
        '',
        'Talking points:',
        ...p.talking.map((x) => `• ${x}`),
        '',
        `Desired outcome: ${p.outcome}`,
        ...(p.risks.length ? ['', 'Watch-outs:', ...p.risks.map((x) => `• ${x}`)] : [])
    ]
        .filter((x, i, a) => !(x === '' && a[i - 1] === ''))
        .join('\n');
}

/* -------------------------------- Briefs -------------------------------- */

export const RESEARCH_SECTIONS = ['Executive Summary', 'Key Findings', 'Relevant Data', 'Risks', 'Opportunities', 'Recommendation', 'Why it matters to my sales process'];
export const DECISION_SECTIONS = ['Decision needed', 'Best option', 'Reasoning', 'Alternative approaches', 'Risks', 'Expected outcome'];
