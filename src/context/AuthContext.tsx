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
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  submitAccessRequest: (phone: string) => Promise<void>;
  signOut: (force?: boolean) => Promise<boolean>;
  hasPendingSyncs: () => Promise<number>;
  verifyAccess: (user: User) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updateManagerProfile: (data: { name: string; phone: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [authState, setAuthState] = useState<AuthState>('AUTH_LOADING');

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
        // Keep authoritative email updated if authenticated email is present
        const resolvedTenant: Tenant = {
          ...data,
          email: fallbackEmail || data.email || `${uid}@clearflow.internal`,
        };
        setTenant(resolvedTenant);
        await localDb.put(uid, 'app_cache', { id: 'current_tenant', ...resolvedTenant });
      } else {
        const newTenant: Tenant = {
          managerId: uid,
          authUid: uid,
          name: fallbackName || '',
          email: fallbackEmail || `${uid}@clearflow.internal`,
          phone: '',
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
    if (!user || !user.email) {
      setTenant(null);
      setAuthState('ACCESS_DENIED');
      throw new Error('Manager access not authorized. User credentials missing email.');
    }

    setAuthState('VERIFYING_CLEARFLOW_ACCESS');
    const normalizedEmail = user.email.toLowerCase().trim();

    try {
      const whitelistRef = doc(db, 'manager_whitelist', normalizedEmail);
      const whitelistSnap = await getDoc(whitelistRef);

      if (whitelistSnap.exists() && whitelistSnap.data()?.status === 'APPROVED') {
        setAuthState('AUTHORIZED');
        await syncTenantProfile(user.uid, user.displayName || 'Operations Manager', normalizedEmail);
      } else {
        console.warn(`Manager access not authorized: ${normalizedEmail} is not on the approved whitelist.`);
        setTenant(null);
        setAuthState('ACCESS_DENIED');
        throw new Error('Manager access not authorized. Your account is not on the approved manager whitelist.');
      }
    } catch (err: any) {
      setTenant(null);
      setAuthState('ACCESS_DENIED');
      throw err;
    }
  };

  useEffect(() => {
    let isInitial = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (isInitial) {
        setLoading(true);
      }
      if (user) {
        setCurrentUser(user);
        try {
          await verifyAccess(user);
        } catch (err) {
          console.warn('Initial auth verification notice:', err);
        }
      } else {
        setCurrentUser(null);
        setTenant(null);
        setAuthState('ACCESS_DENIED');
      }
      if (isInitial) {
        setLoading(false);
        isInitial = false;
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setAuthState('AUTHENTICATING');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
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

  const hasPendingSyncs = async (): Promise<number> => {
    if (!tenant?.managerId) return 0;
    const pending = await localDb.getPendingMutations(tenant.managerId);
    return pending.length;
  };

  const signOut = async (force = false): Promise<boolean> => {
    const prevManagerId = tenant?.managerId;

    if (prevManagerId) {
      const pendingCount = await hasPendingSyncs();
      if (pendingCount > 0 && !force) {
        return false; // Indicate that logout was blocked by pending syncs
      }
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
    return true;
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const updateManagerProfile = async (data: { name: string; phone: string }) => {
    if (!tenant) throw new Error('No active manager session found.');
    const updatedTenant: Tenant = {
      ...tenant,
      name: data.name.trim(),
      phone: data.phone.trim(),
    };

    try {
      const tenantRef = doc(db, 'tenants', tenant.managerId);
      await setDoc(tenantRef, updatedTenant, { merge: true });
    } catch (err) {
      console.warn('Network notice updating tenant profile, cached locally:', err);
    }

    setTenant(updatedTenant);
    await localDb.put(tenant.managerId, 'app_cache', { id: 'current_tenant', ...updatedTenant });
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        tenant,
        loading: loading || authState === 'AUTH_LOADING',
        authState,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        submitAccessRequest,
        signOut,
        hasPendingSyncs,
        verifyAccess,
        sendPasswordReset,
        updateManagerProfile,
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
