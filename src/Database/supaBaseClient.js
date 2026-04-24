import "expo-sqlite/localStorage/install";
import { createClient } from '@supabase/supabase-js';

import {
  isValidUsernameBase,
  normalizeUsernameBaseInput,
} from "../Utils/socialUsername";

const supabaseUrl = 'https://tgfeedchhogerswntuvy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnZmVlZGNoaG9nZXJzd250dXZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODAwMjcsImV4cCI6MjA4OTk1NjAyN30.yKXLdHRx64c_TqY9dmZPFjG2tYRlOx_t4QDrlBc9WfQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: globalThis.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function registerWithEmail({ email, password, usernameBase }) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsernameBase = normalizeUsernameBaseInput(usernameBase);

  if (!isValidUsernameBase(normalizedUsernameBase)) {
    throw new Error(
      "Username must be 3-20 characters and use only lowercase letters, numbers or underscores."
    );
  }

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        username_base: normalizedUsernameBase,
        username: normalizedUsernameBase,
        display_name: normalizedUsernameBase,
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function loginWithEmail({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
