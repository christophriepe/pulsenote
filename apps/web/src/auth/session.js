// Login & session (mocked). In production this is the hospital login (open question: AD/LDAP or OIDC via Keycloak).
// The web app only keeps an access token and the user's id, name and role in memory for the session.
//
// Roles (draft):
//   physician  – creates cases, sees and edits own cases
//   attending  – additionally sees and edits all cases of the department

import { CONFIG } from '../config.js';
import { clock } from '../lib/dom.js';

export const DEMO_USERS = [
  { id: 'u-weber', username: 'weber', email: 'lena.weber@klinikum.example', name: 'Dr. Lena Weber', role: 'physician', title: 'Assistenzärztin' },
  { id: 'u-klein', username: 'klein', email: 'jonas.klein@klinikum.example', name: 'Dr. Jonas Klein', role: 'physician', title: 'Assistenzarzt' },
  { id: 'u-schmidt', username: 'schmidt', email: 'miriam.schmidt@klinikum.example', name: 'Dr. Miriam Schmidt', role: 'attending', title: 'Oberärztin' },
];


let current = null;

export const session = {
  get user() { return current?.user || null; },
  get token() { return current?.token || null; },
  get expiresAt() { return current?.expiresAt || 0; },
  isValid() { return !!current && current.expiresAt > clock.now(); },

  async signIn(username, password) {
    await new Promise((r) => setTimeout(r, 250));
    const login = username.trim().toLowerCase();
    const user = DEMO_USERS.find((u) => u.username === login || u.email === login);
    if (!user || !password) throw new Error('login.error');
    current = { user, token: `demo-token-${user.id}`, expiresAt: clock.now() + CONFIG.sessionMs };
    return user;
  },

  signOut() { current = null; },
};
