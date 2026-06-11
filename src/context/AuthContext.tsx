import React, { createContext, useContext, useEffect, useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({
           uid: currentUser.uid,
           email: currentUser.email,
           displayName: currentUser.displayName,
           photoURL: currentUser.photoURL,
           isGuest: false
        });
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          try {
            await setDoc(userRef, {
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              role: 'editor',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } catch (e) {
            console.error('Error creating user document', e);
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Logado com sucesso (Nuvem)');
    } catch (e: any) {
      console.error(e);
      toast.error('Falha na autenticação');
    }
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
      toast.success('Entrou como visitante. Dados salvos localmente.');
  };

  const logOut = async () => {
    try {
      if (user?.isGuest) {
          localStorage.removeItem('guest_session');
          setUser(null);
      } else {
          await signOut(auth);
      }
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
