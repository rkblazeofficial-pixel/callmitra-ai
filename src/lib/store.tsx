import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Gender, LanguageId, OccasionId, Speed, Style } from './data';

export type User = { id: string; name: string; email: string; password: string; phone?: string; profileDone: boolean };
export type Contact = {
  id: string; name: string; phone: string; relation: string; group: string;
  consent: boolean; consentAt?: string;
};
export type CallRecord = {
  id: string; recipient: string; phone: string; occasion: OccasionId; language: LanguageId;
  voiceName: string; gender: Gender; createdAt: string; durationSec: number;
  status: 'demo_completed' | 'demo_cancelled'; outcome: string; script: string;
};
export type Draft = { id: string; occasion: OccasionId; text: string; script: string; updatedAt: string };
export type Prefs = { language: LanguageId; gender: Gender; style: Style; speed: Speed; notifications: boolean };

type State = {
  introSeen: boolean;
  user: User | null;
  loggedIn: boolean;
  contacts: Contact[];
  calls: CallRecord[];
  drafts: Draft[];
  optOuts: { phone: string; at: string }[];
  prefs: Prefs;
};

const KEY = 'callmitra:v1';
const initial: State = {
  introSeen: false, user: null, loggedIn: false, contacts: [], calls: [], drafts: [], optOuts: [],
  prefs: { language: 'hinglish', gender: 'female', style: 'Friendly', speed: 'Normal', notifications: true },
};

export const normPhone = (p: string) => p.replace(/[^\d+]/g, '');
export const isValidPhone = (p: string) => /^\+?\d{10,13}$/.test(normPhone(p));
export const maskPhone = (p: string) => {
  const n = normPhone(p);
  return n.length < 6 ? n : `${n.slice(0, n.length > 10 ? 3 : 0)}•••••${n.slice(-3)}`;
};
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

type Ctx = {
  ready: boolean; s: State;
  finishIntro: () => void;
  signUp: (name: string, email: string, password: string) => string | null;
  logIn: (email: string, password: string) => string | null;
  resetPassword: (email: string, password: string) => string | null;
  logOut: () => void;
  updateUser: (patch: Partial<User>) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  saveContact: (c: Omit<Contact, 'id'> & { id?: string }) => string | null;
  deleteContact: (id: string) => void;
  importContacts: (list: { name: string; phone: string }[]) => number;
  addCall: (c: Omit<CallRecord, 'id'>) => string;
  saveDraft: (d: Omit<Draft, 'id' | 'updatedAt'> & { id?: string }) => void;
  deleteDraft: (id: string) => void;
  addOptOut: (phone: string) => void;
  removeOptOut: (phone: string) => void;
  isOptedOut: (phone: string) => boolean;
  resetAll: () => void;
};

const StoreCtx = createContext<Ctx | null>(null);
export const useStore = () => {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('StoreProvider missing');
  return c;
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<State>(initial);
  const [ready, setReady] = useState(false);
  const ref = useRef(s);
  ref.current = s;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) setS({ ...initial, ...JSON.parse(raw), prefs: { ...initial.prefs, ...(JSON.parse(raw).prefs ?? {}) } });
      } catch {}
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
  }, [s, ready]);

  const up = useCallback((fn: (p: State) => State) => setS((p) => fn(p)), []);

  const value = useMemo<Ctx>(() => ({
    ready, s,
    finishIntro: () => up((p) => ({ ...p, introSeen: true })),
    signUp: (name, email, password) => {
      const e = email.trim().toLowerCase();
      if (!name.trim()) return 'Please enter your name.';
      if (!/^\S+@\S+\.\S+$/.test(e)) return 'Please enter a valid email.';
      if (password.length < 6) return 'Password must be at least 6 characters.';
      if (ref.current.user && ref.current.user.email === e) return 'An account with this email already exists on this device. Please log in.';
      up((p) => ({ ...p, loggedIn: true, user: { id: uid(), name: name.trim(), email: e, password, profileDone: false } }));
      return null;
    },
    logIn: (email, password) => {
      const u = ref.current.user;
      if (!u || u.email !== email.trim().toLowerCase() || u.password !== password) return 'Email or password is incorrect.';
      up((p) => ({ ...p, loggedIn: true }));
      return null;
    },
    resetPassword: (email, password) => {
      const u = ref.current.user;
      if (!u || u.email !== email.trim().toLowerCase()) return 'No account with this email was found on this device.';
      if (password.length < 6) return 'Password must be at least 6 characters.';
      up((p) => ({ ...p, user: p.user ? { ...p.user, password } : p.user }));
      return null;
    },
    logOut: () => up((p) => ({ ...p, loggedIn: false })),
    updateUser: (patch) => up((p) => ({ ...p, user: p.user ? { ...p.user, ...patch } : p.user })),
    setPrefs: (pp) => up((p) => ({ ...p, prefs: { ...p.prefs, ...pp } })),
    saveContact: (c) => {
      const phone = normPhone(c.phone);
      if (!c.name.trim()) return 'Please enter a name.';
      if (!isValidPhone(phone)) return 'Enter a valid phone number (10–13 digits).';
      const dup = ref.current.contacts.find((x) => normPhone(x.phone).slice(-10) === phone.slice(-10) && x.id !== c.id);
      if (dup) return `This number is already saved as ${dup.name}.`;
      up((p) => {
        const contact: Contact = { ...c, id: c.id ?? uid(), name: c.name.trim(), phone,
          consentAt: c.consent ? c.consentAt ?? new Date().toISOString() : undefined };
        const exists = p.contacts.some((x) => x.id === contact.id);
        return { ...p, contacts: exists ? p.contacts.map((x) => (x.id === contact.id ? contact : x)) : [contact, ...p.contacts] };
      });
      return null;
    },
    deleteContact: (id) => up((p) => ({ ...p, contacts: p.contacts.filter((c) => c.id !== id) })),
    importContacts: (list) => {
      let added = 0;
      up((p) => {
        const have = new Set(p.contacts.map((c) => normPhone(c.phone).slice(-10)));
        const out = [...p.contacts];
        for (const it of list) {
          const ph = normPhone(it.phone);
          if (!isValidPhone(ph) || have.has(ph.slice(-10))) continue;
          have.add(ph.slice(-10));
          out.unshift({ id: uid(), name: it.name, phone: ph, relation: '', group: 'Imported', consent: false });
          added++;
        }
        return { ...p, contacts: out };
      });
      return added;
    },
    addCall: (c) => {
      const id = uid();
      up((p) => ({ ...p, calls: [{ ...c, id }, ...p.calls] }));
      return id;
    },
    saveDraft: (d) => up((p) => {
      const id = d.id ?? uid();
      const dr: Draft = { ...d, id, updatedAt: new Date().toISOString() };
      return { ...p, drafts: [dr, ...p.drafts.filter((x) => x.id !== id)].slice(0, 20) };
    }),
    deleteDraft: (id) => up((p) => ({ ...p, drafts: p.drafts.filter((d) => d.id !== id) })),
    addOptOut: (phone) => up((p) => p.optOuts.some((o) => o.phone === normPhone(phone)) ? p
      : ({ ...p, optOuts: [{ phone: normPhone(phone), at: new Date().toISOString() }, ...p.optOuts] })),
    removeOptOut: (phone) => up((p) => ({ ...p, optOuts: p.optOuts.filter((o) => o.phone !== phone) })),
    isOptedOut: (phone) => ref.current.optOuts.some((o) => o.phone.slice(-10) === normPhone(phone).slice(-10)),
    resetAll: () => setS({ ...initial, introSeen: true }),
  }), [ready, s, up]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
