// src/services/clients.js
// Koleksi `clients` — skema mengikuti Kontrack live (client_name, npwp, dst).

import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { cached, invalidate, CACHE_KEYS } from './cache';

const COLLECTION = 'clients';

export const getAllClients = async () =>
  cached(CACHE_KEYS.CLIENTS, async () => {
    const snap = await getDocs(collection(db, COLLECTION));
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    return list;
  });

// Map id → client untuk join cepat di halaman invoice.
export const getClientMap = async () => {
  const list = await getAllClients();
  return list.reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {});
};

export const getClient = async (id) => {
  if (!id) return null;
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const clientDisplayName = (client) =>
  client?.client_name || client?.name || client?.clientName || '';

export const addClient = async (data) => {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    search_name: (data.client_name || '').toLowerCase(),
    createdAt: now,
    updatedAt: now
  });
  invalidate(CACHE_KEYS.CLIENTS);
  return ref.id;
};

export const updateClient = async (id, data) => {
  await updateDoc(doc(db, COLLECTION, id), { ...data, updatedAt: new Date().toISOString() });
  invalidate(CACHE_KEYS.CLIENTS);
};

export const deleteClient = async (id) => {
  await deleteDoc(doc(db, COLLECTION, id));
  invalidate(CACHE_KEYS.CLIENTS);
};
