// Profile storage, ported from Room (database/Profile.kt + ProfileDao.kt).
// Backed by localStorage — profiles are small and few. Same shape/operations.

export interface Profile {
  id: number;
  profileName: string;
  serverUrl: string;   // Xtream DNS, or M3U playlist link
  username: string;
  password: string;
  isM3u: boolean;
}

const KEY = 'sx_profiles';
const SEQ = 'sx_profile_seq';

function read(): Profile[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as Profile[]; }
  catch { return []; }
}

function write(list: Profile[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

function nextId(): number {
  const n = (parseInt(localStorage.getItem(SEQ) || '0', 10) || 0) + 1;
  localStorage.setItem(SEQ, String(n));
  return n;
}

export const Profiles = {
  /** All profiles, sorted by name (matches ProfileDao ORDER BY profile_name ASC). */
  all(): Profile[] {
    return read().sort((a, b) => a.profileName.localeCompare(b.profileName, 'tr'));
  },
  byId(id: number): Profile | null {
    return read().find((p) => p.id === id) ?? null;
  },
  insert(p: Omit<Profile, 'id'>): Profile {
    const list = read();
    const created: Profile = { ...p, id: nextId() };
    list.push(created);
    write(list);
    return created;
  },
  update(p: Profile): void {
    write(read().map((x) => (x.id === p.id ? p : x)));
  },
  remove(id: number): void {
    write(read().filter((p) => p.id !== id));
  },
  count(): number {
    return read().length;
  },
};
