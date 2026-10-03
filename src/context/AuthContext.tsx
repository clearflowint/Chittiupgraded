import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Tenant } from '../types';
import { localDb } from '../services/localDb';

export type AuthState = 
  | 'AUTH_LOADING'
  | 'AUTHENTICATING'
  | 'VERIFYING_CLEARFLOW_ACCESS'
  | 'AUTHORIZED'
  | 'ACCESS_PENDING'
  | 'ACCESS_DENIED'
  | 'SUSPENDED'
  | 'REVOKED';

interface AuthContextType {
  currentUser: User | null;
  tenant: Tenant | null;
  loading: boolean;
  authState: AuthState;
  isDemoMode: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithDemoManager: (name: string, email: string, phone: string) => Promise<void>;
  submitAccessRequest: (phone: string) => Promise<void>;
  signOut: () => Promise<void>;
  verifyAccess: (user: User) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [authState, setAuthState] = useState<AuthState>('AUTH_LOADING');
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Sync or create tenant profile from Firestore or local cache
  const syncTenantProfile = async (uid: string, fallbackName?: string, fallbackEmail?: string) => {
    try {
      const tenantRef = doc(db, 'tenants', uid);
      let tenantSnap;
      try {
        tenantSnap = await getDoc(tenantRef);
      } catch (err) {
        console.warn('Network notice fetching tenant, checking local DB:', err);
      }

      if (tenantSnap && tenantSnap.exists()) {
        const data = tenantSnap.data() as Tenant;
        setTenant(data);
        await localDb.put(uid, 'app_cache', { id: 'current_tenant', ...data });
      } else {
        const newTenant: Tenant = {
          managerId: uid,
          authUid: uid,
          name: fallbackName || 'Operations Manager',
          email: fallbackEmail || `${uid}@clearflow.internal`,
          phone: '+91 98450 12345',
          currency: '₹',
          defaultCommissionPercent: 5,
          createdAt: new Date().toISOString(),
          status: 'active',
        };
        try {
          await setDoc(tenantRef, newTenant);
        } catch (err) {
          console.warn('Writing tenant locally in offline mode:', err);
        }
        setTenant(newTenant);
        await localDb.put(uid, 'app_cache', { id: 'current_tenant', ...newTenant });
      }
    } catch (error) {
      console.warn('Tenant sync notice:', error);
      const cached = await localDb.getForTenant<Tenant>(uid, 'app_cache', 'current_tenant');
      if (cached) {
        setTenant(cached);
      }
    }
  };

  const verifyAccess = async (user: User) => {
    if (!user) {
      setAuthState('ACCESS_DENIED');
      return;
    }

    setAuthState('AUTHORIZED');
    const normalizedEmail = user.email ? user.email.toLowerCase().trim() : '';
    await syncTenantProfile(user.uid, user.displayName || 'Operations Manager', normalizedEmail);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        setIsDemoMode(false);
        setCurrentUser(user);
        await verifyAccess(user);
      } else {
        // Only allow demo manager session in DEV mode
        const demoUid = localStorage.getItem('clearflow_demo_uid');
        if (demoUid && import.meta.env.DEV) {
          setIsDemoMode(true);
          const cached = await localDb.getForTenant<Tenant>(demoUid, 'app_cache', 'current_tenant');
          if (cached) {
            setTenant(cached);
          }
          setAuthState('AUTHORIZED');
        } else {
          setCurrentUser(null);
          setTenant(null);
          setIsDemoMode(false);
          setAuthState('ACCESS_DENIED');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setAuthState('AUTHENTICATING');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        localStorage.removeItem('clearflow_demo_uid');
        setIsDemoMode(false);
        setCurrentUser(result.user);
        await verifyAccess(result.user);
      }
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      setAuthState('ACCESS_DENIED');
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthState('AUTHENTICATING');
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      setCurrentUser(result.user);
      await verifyAccess(result.user);
    } catch (error) {
      setAuthState('ACCESS_DENIED');
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    setAuthState('AUTHENTICATING');
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      setCurrentUser(result.user);
      try {
        await sendEmailVerification(result.user);
      } catch (err) {
        console.warn('Verification email send skipped/failed:', err);
      }
      await verifyAccess(result.user);
    } catch (error) {
      setAuthState('ACCESS_DENIED');
      throw error;
    }
  };

  const submitAccessRequest = async (phone: string) => {
    if (!currentUser) throw new Error('You must be signed in to submit an access request.');
    const email = currentUser.email ? currentUser.email.toLowerCase().trim() : '';
    if (!email) throw new Error('Email identity is missing from current credentials.');

    const requestRef = doc(db, 'manager_access_requests', email);
    const newRequest = {
      requestId: email,
      email,
      firebaseUid: currentUser.uid,
      phone: phone.trim(),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(requestRef, newRequest);
    setAuthState('ACCESS_PENDING');
  };

  // Development Only Demo Sign-In
  const signInWithDemoManager = async (name: string, email: string, phone: string) => {
    if (!import.meta.env.DEV) {
      throw new Error('Demo Manager Mode is restricted to development environments.');
    }

    const demoUid = 'demo_' + btoa(email).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
    localStorage.setItem('clearflow_demo_uid', demoUid);
    setIsDemoMode(true);

    const demoTenant: Tenant = {
      managerId: demoUid,
      authUid: demoUid,
      name,
      email,
      phone,
      currency: '₹',
      defaultCommissionPercent: 5,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    setTenant(demoTenant);
    await localDb.put(demoUid, 'app_cache', { id: 'current_tenant', ...demoTenant });
    setAuthState('AUTHORIZED');
  };

  const signOut = async () => {
    const prevManagerId = tenant?.managerId;
    localStorage.removeItem('clearflow_demo_uid');
    setIsDemoMode(false);

    if (prevManagerId) {
      await localDb.clearTenantCache(prevManagerId);
    }

    try {
      await fbSignOut(auth);
    } catch (e) {
      // ignore
    }
    setCurrentUser(null);
    setTenant(null);
    setAuthState('ACCESS_DENIED');
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        tenant,
        loading: loading || authState === 'AUTH_LOADING',
        authState,
        isDemoMode,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signInWithDemoManager,
        submitAccessRequest,
        signOut,
        verifyAccess,
        sendPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
