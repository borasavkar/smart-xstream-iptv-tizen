// Device-based 7-day trial, ported from utils/TrialManager.kt.
// Uses Firebase Anonymous Auth + Firestore REST against the same project as the
// Android app (trials/{deviceId}). Fail-OPEN: on any error (no config, network,
// rules, auth) it grants access — never locks a user out due to setup issues,
// exactly like the Android version.
import { CONFIG } from '../config/app-config';
import { getDeviceId } from './device';

export interface TrialResult {
  active: boolean;
  message: string;
  daysLeft?: number;
}

const TRIAL_MS = CONFIG.trialDays * 24 * 60 * 60 * 1000;
let cached: TrialResult | null = null;

export async function checkTrial(force = false): Promise<TrialResult> {
  if (cached && !force) return cached;
  cached = await compute();
  return cached;
}

async function compute(): Promise<TrialResult> {
  const { projectId, apiKey } = CONFIG.firebase;
  if (!projectId || !apiKey) return { active: true, message: '' };

  try {
    const token = await anonToken(apiKey);
    const deviceId = getDeviceId();
    const doc = await getTrialDoc(projectId, token, deviceId);
    const now = Date.now();

    if (doc) {
      if (doc.isVip) return { active: true, message: 'VIP' };
      const first = doc.firstRunTime || now;
      const elapsed = now - first;
      if (elapsed < TRIAL_MS) {
        return { active: true, message: 'active', daysLeft: Math.ceil((TRIAL_MS - elapsed) / 86400000) };
      }
      return { active: false, message: 'expired' };
    }

    await createTrialDoc(projectId, token, deviceId, now);
    return { active: true, message: 'started', daysLeft: CONFIG.trialDays };
  } catch {
    return { active: true, message: '' }; // fail-open
  }
}

async function anonToken(apiKey: string): Promise<string> {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!res.ok) throw new Error('auth');
  const json = (await res.json()) as { idToken?: string };
  if (!json.idToken) throw new Error('token');
  return json.idToken;
}

interface TrialDoc { firstRunTime?: number; isVip?: boolean; }

function docUrl(projectId: string, deviceId: string): string {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/trials/${encodeURIComponent(deviceId)}`;
}

async function getTrialDoc(projectId: string, token: string, deviceId: string): Promise<TrialDoc | null> {
  const res = await fetch(docUrl(projectId, deviceId), { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('get');
  const json = (await res.json()) as { fields?: Record<string, { integerValue?: string; doubleValue?: number; booleanValue?: boolean }> };
  const f = json.fields || {};
  return {
    firstRunTime: f.firstRunTime ? Number(f.firstRunTime.integerValue ?? f.firstRunTime.doubleValue ?? 0) : undefined,
    isVip: f.isVip ? Boolean(f.isVip.booleanValue) : false,
  };
}

async function createTrialDoc(projectId: string, token: string, deviceId: string, firstRunTime: number): Promise<void> {
  await fetch(docUrl(projectId, deviceId), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        firstRunTime: { integerValue: String(firstRunTime) },
        deviceModel: { stringValue: 'Tizen TV' },
      },
    }),
  });
}
