import { useState, useEffect, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile, setUserProfile } from '@/lib/firestore';
import type { UserProfile } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const p = await getUserProfile(firebaseUser.uid);
        setProfile(p);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      setError(getAuthErrorMessage(e.code));
      throw e;
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      const now = new Date().toISOString();
      const newProfile: UserProfile = {
        uid: cred.user.uid,
        email,
        displayName: name,
        dailyGoalQuestions: 30,
        createdAt: now,
        updatedAt: now,
      };
      await setUserProfile(cred.user.uid, newProfile);
      setProfile(newProfile);
    } catch (e: any) {
      setError(getAuthErrorMessage(e.code));
      throw e;
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const existingProfile = await getUserProfile(cred.user.uid);
      if (!existingProfile) {
        const now = new Date().toISOString();
        const newProfile: UserProfile = {
          uid: cred.user.uid,
          email: cred.user.email ?? '',
          displayName: cred.user.displayName ?? '',
          photoURL: cred.user.photoURL ?? undefined,
          dailyGoalQuestions: 30,
          createdAt: now,
          updatedAt: now,
        };
        await setUserProfile(cred.user.uid, newProfile);
        setProfile(newProfile);
      } else {
        setProfile(existingProfile);
      }
    } catch (e: any) {
      setError(getAuthErrorMessage(e.code));
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setProfile(null);
  }, []);

  const updateUserProfile = useCallback(async (data: Partial<UserProfile>) => {
    if (!user) return;
    await setUserProfile(user.uid, data);
    setProfile(prev => prev ? { ...prev, ...data } : null);
  }, [user]);

  return { user, profile, loading, error, login, register, loginWithGoogle, logout, updateUserProfile };
}

function getAuthErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    'auth/user-not-found': 'Usuário não encontrado.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/email-already-in-use': 'Este e-mail já está em uso.',
    'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
    'auth/popup-closed-by-user': 'Login cancelado.',
    'auth/invalid-credential': 'Credenciais inválidas. Verifique seu e-mail e senha.',
  };
  return messages[code] ?? 'Erro de autenticação. Tente novamente.';
}
