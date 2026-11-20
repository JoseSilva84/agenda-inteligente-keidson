import axios from 'axios';
import { UserProfile } from '../types/agenda';

const TOKEN_KEY = 'agenda-inteligente-jwt';
const USER_KEY = 'agenda-inteligente-user';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getStoredAuth(): { token: string | null; user: UserProfile | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    return {
      token,
      user: rawUser ? JSON.parse(rawUser) : null
    };
  } catch {
    return { token: null, user: null };
  }
}

export function setStoredAuth(token: string, user: UserProfile) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
}

export function clearStoredAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {}
}

export async function loginApi(email: string, password: string): Promise<{ token: string; user: UserProfile }> {
  try {
    const { data } = await api.post('/auth/login', { email, password });
    setStoredAuth(data.token, data.user);
    return data;
  } catch (err: any) {
    // Se a resposta vier do servidor (401/400), propaga o erro real
    if (err?.response?.data?.error) {
      throw new Error(err.response.data.error);
    }
    // Fallback offline PWA caso o backend ainda não esteja rodando no momento do login
    if (
      (email.toLowerCase() === 'keidson@agendainteligente.com' || email.toLowerCase() === 'admin@agendainteligente.com') &&
      password === '123456'
    ) {
      const offlineUser: UserProfile = {
        id: 'usr_keidson_owner',
        name: 'Keidson',
        email: email.toLowerCase(),
        role: 'owner',
        theme: 'dark'
      };
      const token = 'offline-pwa-jwt-' + Date.now();
      setStoredAuth(token, offlineUser);
      return { token, user: offlineUser };
    }
    throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão ou use o acesso padrão.');
  }
}

export async function registerApi(name: string, email: string, password: string): Promise<{ token: string; user: UserProfile }> {
  try {
    const { data } = await api.post('/auth/register', { name, email, password });
    setStoredAuth(data.token, data.user);
    return data;
  } catch (err: any) {
    if (err?.response?.data?.error) {
      throw new Error(err.response.data.error);
    }
    const offlineUser: UserProfile = {
      id: 'usr_' + Date.now().toString(36),
      name,
      email: email.toLowerCase(),
      role: 'user',
      theme: 'dark'
    };
    const token = 'offline-pwa-jwt-' + Date.now();
    setStoredAuth(token, offlineUser);
    return { token, user: offlineUser };
  }
}
