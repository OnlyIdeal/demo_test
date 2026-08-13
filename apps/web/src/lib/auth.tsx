import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getCurrentUser, login as loginApi } from '../services/auth';
import type { User } from '../types/api';

interface AuthContextValue { user: User | null; loading: boolean; signIn: (username: string, password: string) => Promise<void>; signOut: () => void; }
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { if (!localStorage.getItem('ai_ems_token')) { setLoading(false); return; } getCurrentUser().then(setUser).catch(() => localStorage.removeItem('ai_ems_token')).finally(() => setLoading(false)); }, []);
  const value = useMemo(() => ({ user, loading, signIn: async (username: string, password: string) => { const data = await loginApi(username, password); localStorage.setItem('ai_ems_token', data.token); setUser(data.user); }, signOut: () => { localStorage.removeItem('ai_ems_token'); setUser(null); } }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used within AuthProvider'); return value; }
