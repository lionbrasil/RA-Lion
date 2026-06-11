import React, { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isGuest: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signInAsGuest: async () => {},
  logOut: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const guestData = localStorage.getItem('guest_session');
    if (guestData) {
        setUser(JSON.parse(guestData));
        setLoading(false);
        return;
    }
    setLoading(false);
  }, []);

  const signIn = async () => {
    // Just map to guest since we are removing Firebase
    await signInAsGuest();
  };

  const signInAsGuest = async () => {
      const guestUser: AuthUser = {
          uid: 'guest_' + Date.now(),
          email: 'guest@local',
          displayName: 'Visitante (Offline)',
          photoURL: null,
          isGuest: true
      };
      localStorage.setItem('guest_session', JSON.stringify(guestUser));
      setUser(guestUser);
      toast.success('Entrou. Dados salvos localmente.');
  };

  const logOut = async () => {
    try {
      localStorage.removeItem('guest_session');
      setUser(null);
      toast.success('Desconectado com sucesso');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInAsGuest, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
