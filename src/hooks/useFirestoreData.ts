import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../AuthContext';
import { mockPatients, mockAlerts } from '../data';

export function useFirestoreData<T>(subPath: string, orderByField: string = 'createdAt') {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const { tenantId } = useAuth();

  useEffect(() => {
    if (!tenantId) {
      if (subPath === 'patients') {
        setData(mockPatients as unknown as T[]);
      } else if (subPath === 'alerts') {
        setData(mockAlerts as unknown as T[]);
      } else {
        setData([]);
      }
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'tenants', tenantId, subPath),
      orderBy(orderByField, 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbItems: any[] = [];
      snapshot.forEach((doc) => {
        dbItems.push({ id: doc.id, ...doc.data() });
      });

      let mergedItems: any[] = dbItems;

      if (subPath === 'patients') {
        const dbMap = new Map(dbItems.map(item => [item.id, item]));
        const merged = mockPatients.map(mockItem => {
          if (dbMap.has(mockItem.id)) {
            return {
              ...mockItem,
              ...dbMap.get(mockItem.id)
            };
          }
          return mockItem;
        });

        const mockIds = new Set(mockPatients.map(p => p.id));
        dbItems.forEach(dbItem => {
          if (!mockIds.has(dbItem.id)) {
            merged.push(dbItem);
          }
        });

        mergedItems = merged;
      } else if (subPath === 'alerts') {
        const dbMap = new Map(dbItems.map(item => [item.id, item]));
        const merged = mockAlerts.map(mockItem => {
          if (dbMap.has(mockItem.id)) {
            return {
              ...mockItem,
              ...dbMap.get(mockItem.id)
            };
          }
          return mockItem;
        });

        const mockIds = new Set(mockAlerts.map(a => a.id));
        dbItems.forEach(dbItem => {
          if (!mockIds.has(dbItem.id)) {
            merged.push(dbItem);
          }
        });

        mergedItems = merged;
      }

      if (orderByField) {
        mergedItems.sort((a, b) => {
          const valA = a[orderByField] || a.createdAt || a.date || a.lastCallDate || 0;
          const valB = b[orderByField] || b.createdAt || b.date || b.lastCallDate || 0;
          
          const timeA = valA instanceof Date ? valA.getTime() : typeof valA === 'object' && valA !== null && 'seconds' in valA ? valA.seconds * 1000 : new Date(valA).getTime();
          const timeB = valB instanceof Date ? valB.getTime() : typeof valB === 'object' && valB !== null && 'seconds' in valB ? valB.seconds * 1000 : new Date(valB).getTime();
          
          return timeB - timeA;
        });
      }

      setData(mergedItems as T[]);
      setLoading(false);
    }, (error) => {
        console.error("Firestore onSnapshot error:", error);
        let fallback: any[] = [];
        if (subPath === 'patients') {
          fallback = mockPatients;
        } else if (subPath === 'alerts') {
          fallback = mockAlerts;
        }
        setData(fallback as T[]);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId, subPath, orderByField]);

  return { data, loading };
}
