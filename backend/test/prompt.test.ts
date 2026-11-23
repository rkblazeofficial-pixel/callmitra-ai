import { describe, expect, it } from 'vitest';
import { buildPrompt } from '../src/prompt';

const facts = { hostName: 'Kamal', recipientName: 'Rahul', occasion: 'birthday', script: 'Namaste Rahul!', language: 'Hinglish',
  details: { date: 'Sunday', time: '6 PM', venue: 'our home' }, qa: [{ q: 'Kahan?', a: 'Ghar par.' }] };

describe('buildPrompt', () => {
  const p = buildPrompt(facts);
  it('requires AI disclosure and forbids claiming to be human', () => { expect(p).toMatch(/AI calling assistant/); expect(p).toMatch(/Never claim or imply that you are a human/); });
  it('forbids inventing facts', () => expect(p).toMatch(/Never invent or guess/));
  it('handles opt-out and hang-up', () => { expect(p).toMatch(/do not want to be called again/); expect(p).toMatch(/Never keep anyone on the line/); });
  it('includes only the supplied facts', () => { expect(p).toContain('Date: Sunday'); expect(p).toContain('Venue: our home'); });
  it('marks missing facts as none rather than inventing', () => expect(buildPrompt({ ...facts, details: {} })).toContain('(none provided)'));
  it('strips control characters', () => expect(buildPrompt({ ...facts, script: 'hi\u0000there' })).not.toContain('\u0000'));
});
