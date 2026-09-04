import {
  loginWithEmail,
  logout as logoutFromSupabase,
  registerWithEmail,
} from "../Database/supaBaseClient";

// The login, register and profile screens were the only three places in
// src/Pages that reached into src/Database directly, against the layer rule in
// src/AGENTS.md. This is the seam they go through now.

export function login({ email, password }) {
  return loginWithEmail({ email, password });
}

export function register({ email, password, usernameBase }) {
  return registerWithEmail({ email, password, usernameBase });
}

export function logout() {
  return logoutFromSupabase();
}
