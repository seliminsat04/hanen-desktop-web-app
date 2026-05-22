import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc, serverTimestamp, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './lib/firebase';

interface TenantData {
  name?: string;
  doctorName?: string;
  doctorSpecialty?: string;
  cabinetName?: string;
  contactPhone?: string;
  cnamId?: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  tenantId: string | null;
  tenantData: TenantData | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string, doctorName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  tenantId: null,
  tenantData: null,
  loading: true,
  login: async () => {},
  loginWithEmail: async () => {},
  signupWithEmail: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantData, setTenantData] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setTenantData(null);
      return;
    }
    const tenantRef = doc(db, 'tenants', tenantId);
    const unsubscribe = onSnapshot(tenantRef, (snapshot) => {
      if (snapshot.exists()) {
        setTenantData(snapshot.data() as TenantData);
      }
    }, (err) => {
      console.error("Error listening to tenant snap:", err);
    });
    return () => unsubscribe();
  }, [tenantId]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          // Check if user is owner of a tenant
          const tenantsQuery = query(collection(db, 'tenants'), where('ownerId', '==', currentUser.uid));
          const querySnapshot = await getDocs(tenantsQuery);
          
          if (!querySnapshot.empty) {
            setTenantId(querySnapshot.docs[0].id);
          } else {
            // Check if they are part of a tenant's users
            // (Note: Firestore rules don't easily allow cross-tenant query for user without collection group, 
            // but since a user is usually in one, an invite flow would normally link them. 
            // For now, if no tenant is found where they are owner, we'll try to create a default one for them).
            
            const newTenantId = `tenant_${currentUser.uid}`;
            const tenantRef = doc(db, 'tenants', newTenantId);
            
            try {
              const existingTenant = await getDoc(tenantRef);
              if (!existingTenant.exists()) {
                await setDoc(tenantRef, {
                  name: `Cabinet de ${currentUser.displayName || 'Docteur'}`,
                  createdAt: serverTimestamp(),
                  ownerId: currentUser.uid,
                });

                const userRef = doc(db, 'tenants', newTenantId, 'users', currentUser.uid);
                await setDoc(userRef, {
                  email: currentUser.email || '',
                  role: 'admin',
                  createdAt: serverTimestamp(),
                });
              }
              setTenantId(newTenantId);
            } catch (createErr) {
              console.error("Error ensuring tenant:", createErr);
              // Handle gracefully
            }
          }
        } catch (err) {
            console.error("Error fetching tenant", err);
        }
      } else {
        setTenantId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error('Email login error:', error);
      throw error;
    }
  };

  const signupWithEmail = async (email: string, pass: string, doctorName: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      if (userCredential.user) {
        await updateProfile(userCredential.user, {
          displayName: doctorName
        });
        
        const newTenantId = `tenant_${userCredential.user.uid}`;
        const tenantRef = doc(db, 'tenants', newTenantId);
        await setDoc(tenantRef, {
          name: `Cabinet de ${doctorName}`,
          createdAt: serverTimestamp(),
          ownerId: userCredential.user.uid,
        });

        const userRef = doc(db, 'tenants', newTenantId, 'users', userCredential.user.uid);
        await setDoc(userRef, {
          email: email,
          role: 'admin',
          createdAt: serverTimestamp(),
        });
        
        setTenantId(newTenantId);
      }
    } catch (error) {
      console.error('Email signup error:', error);
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, tenantId, tenantData, loading, login, loginWithEmail, signupWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
