// Local drafts in IndexedDB. Only unsent drafts live on the device, and only temporarily:
// - deleted as soon as the server confirms receipt (see wizard send)
// - expire a fixed time after creation (CONFIG.draftTtlMs), the app warns before that
// - tied to the signed-in user and deleted on sign-out
// If IndexedDB is unavailable (e.g. some embedded previews), drafts are kept in memory only.

import { CONFIG } from '../../config.js';
import { clock, uuid } from '../../lib/dom.js';

const DB_NAME = 'pulsenote';
const STORE = 'drafts';
const memStore = new Map();
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' }).createIndex('userId', 'userId');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}

function idbReq(r) {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}

async function store(mode) {
  const db = await openDb();
  return db ? db.transaction(STORE, mode).objectStore(STORE) : null;
}

export const drafts = {
  create(user, form, questionnaire) {
    const now = clock.now();
    return {
      id: uuid(), // generated on the device: re-sending after a dropped connection cannot create a duplicate
      userId: user.id,
      formId: form.id,
      questionnaire: `${questionnaire.url}|${questionnaire.version}`,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + CONFIG.draftTtlMs,
      answers: {},
    };
  },

  // Returns the user's live drafts and deletes expired ones.
  async list(userId) {
    const s = await store('readonly');
    const all = s ? await idbReq(s.index('userId').getAll(userId)) : [...memStore.values()].filter((d) => d.userId === userId);
    const now = clock.now();
    const expired = all.filter((d) => d.expiresAt <= now);
    for (const d of expired) await this.remove(d.id);
    return { drafts: all.filter((d) => d.expiresAt > now).sort((a, b) => b.updatedAt - a.updatedAt), expired: expired.length };
  },

  async get(id) {
    const s = await store('readonly');
    return s ? idbReq(s.get(id)) : structuredClone(memStore.get(id));
  },

  async put(d) {
    d.updatedAt = clock.now();
    const s = await store('readwrite');
    if (s) await idbReq(s.put(structuredClone(d)));
    else memStore.set(d.id, structuredClone(d));
  },

  async remove(id) {
    const s = await store('readwrite');
    if (s) await idbReq(s.delete(id));
    else memStore.delete(id);
  },

  async removeAllForUser(userId) {
    const { drafts: list } = await this.list(userId);
    for (const d of list) await this.remove(d.id);
    return list.length;
  },
};
