import { LanguageId, OCCASIONS, OccasionId } from './data';

export type Facts = {
  who?: string; // sender / host name
  date?: string;
  time?: string;
  venue?: string;
};

export type Generated = {
  script: string;
  facts: Facts;
  missing: string[];
  qa: { q: string; a: string }[];
  closing: string;
  notice?: string;
};

const DAYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'somvar', 'mangalvar', 'budhvar', 'guruvar', 'shukravar', 'shanivar', 'ravivar',
  'kal', 'parso', 'tomorrow', 'today', 'aaj',
];

const TIME_RE = /\b(\d{1,2}(?::\d{2})?)\s*(am|pm|baje|o'?clock)\b/i;

export function extractFacts(text: string): Facts {
  const f: Facts = {};
  const t = text.trim();
  const low = t.toLowerCase();

  const day = DAYS.find((d) => new RegExp(`\\b${d}\\b`).test(low));
  const dateNum = t.match(/\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)\b/i);
  if (day || dateNum) {
    const d = day ? day.charAt(0).toUpperCase() + day.slice(1) : '';
    f.date = [d, dateNum?.[0]].filter(Boolean).join(' ');
  }

  const tm = t.match(TIME_RE);
  if (tm) f.time = `${tm[1]} ${tm[2].toLowerCase() === 'baje' ? 'baje' : tm[2].toUpperCase()}`;

  if (/\b(home|house|ghar)\b/i.test(t)) f.venue = low.includes('ghar') ? 'ghar par' : 'our home';
  const v = t.match(/(?:venue(?:\s+is)?|location(?:\s+is)?|at the|held at|hosted at)\s*[:\-]?\s*([^.,\n]{3,60})/i);
  if (v && !TIME_RE.test(v[1])) f.venue = v[1].trim();

  const w = t.match(/(?:from|on behalf of|se|by)\s+([A-Z][a-zA-Z]+(?:\s+(?:ji|Ji))?)/);
  if (w) f.who = w[1];
  return f;
}

export type GenInput = {
  occasion: OccasionId;
  hostName: string;
  recipientName: string;
  relation?: string;
  language: LanguageId;
  text: string;
  notes?: string;
};

export function generate(input: GenInput): Generated {
  const facts = extractFacts(`${input.text} ${input.notes ?? ''}`);
  facts.who = facts.who || input.hostName || undefined;
  const occ = OCCASIONS.find((o) => o.id === input.occasion)!;
  const missing: string[] = [];
  if (!facts.who) missing.push('Your name (who the call is from)');
  if (occ.invite) {
    if (!facts.date) missing.push('Date or day of the event');
    if (!facts.time) missing.push('Time of the event');
    if (!facts.venue) missing.push('Venue / location');
  }
  if (input.text.trim().length < 10) missing.push('A few words about what you want to say');

  const hindi = input.language === 'hinglish' || input.language === 'hi';
  const who = facts.who ?? '[your name]';
  const rcpt = input.recipientName || (hindi ? 'aap' : 'you');
  const detail = [facts.date, facts.time].filter(Boolean).join(hindi ? ' ko ' : ' at ');
  const place = facts.venue
    ? hindi
      ? facts.venue === 'ghar par' ? 'Venue unka ghar hai.' : `Venue: ${facts.venue}.`
      : facts.venue === 'our home' ? `It will be held at ${who}'s home.` : `Venue: ${facts.venue}.`
    : '';

  let script: string;
  let qa: Generated['qa'];
  let closing: string;
  if (hindi) {
    script =
      `Namaste ${rcpt}! Main CallMitra AI hoon, ek AI calling assistant. Main ${who} ki taraf se aapko ${occ.label.toLowerCase()} ke baare mein call kar raha hoon.\n\n` +
      `${input.text.trim()}${detail ? `\n\nSamay: ${detail}.` : ''} ${place}\n\n` +
      `Kya aap aa paayenge? Aur kya is baare mein aap kuch aur jaanna chahenge?`;
    qa = [
      { q: 'Kahan hai?', a: facts.venue ? place : 'Iski exact information mere paas abhi available nahi hai. Main aapko galat information nahi dena chahunga.' },
      { q: 'Kitne baje?', a: facts.time ? `${detail}. Main ek baar confirm kar doon, ${detail}.` : 'Iski exact information mere paas abhi available nahi hai.' },
      { q: 'Aur koi detail?', a: 'Mere paas sirf wahi jaankari hai jo mujhe di gayi hai. Baaki ${who} ji se seedhe pooch lijiye.'.replace('${who}', who) },
    ];
    closing = `Bahut achha! ${who} ki taraf se aapka dhanyavaad. Namaste!`;
  } else {
    script =
      `Hello ${rcpt}! This is CallMitra AI, an AI calling assistant. I'm calling on behalf of ${who} about a ${occ.label.toLowerCase()}.\n\n` +
      `${input.text.trim()}${detail ? `\n\nWhen: ${detail}.` : ''} ${place}\n\n` +
      `Will you be able to make it? And is there anything else you would like to know?`;
    qa = [
      { q: 'Where is it?', a: facts.venue ? place : "I don't have the exact details right now, and I don't want to give you wrong information." },
      { q: 'What time?', a: facts.time ? `${detail}. Let me confirm that once more: ${detail}.` : "I don't have the exact time right now." },
      { q: 'Anything else?', a: `I only have the details I was given. Please check directly with ${who} for anything else.` },
    ];
    closing = `Wonderful! Thank you, and ${who} sends their regards. Goodbye!`;
  }

  const notice = ['hinglish', 'hi', 'en'].includes(input.language)
    ? undefined
    : 'DEMO generator writes Hinglish/English only. The live AI will write this in the language you selected.';
  return { script: script.replace(/ {2,}/g, ' ').trim(), facts, missing, qa, closing, notice };
}
