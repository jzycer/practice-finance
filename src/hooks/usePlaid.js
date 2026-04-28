import { useState, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

export function usePlaid(onSuccess) {
  const { currentUser } = useAuth();
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createLinkToken = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/plaid/create-link-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.uid }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLinkToken(data.link_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const handleSuccess = useCallback(async (publicToken, metadata) => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/plaid/exchange-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token: publicToken, userId: currentUser.uid }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Store access token in Firestore (only accessible by authenticated users)
      await setDoc(doc(db, 'plaidAccounts', currentUser.uid), {
        access_token: data.access_token,
        item_id: data.item_id,
        institution: metadata.institution?.name || 'Unknown',
        connected_at: new Date().toISOString(),
      }, { merge: true });

      if (onSuccess) onSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser, onSuccess]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
  });

  return { createLinkToken, open, ready, linkToken, loading, error };
}

export async function fetchTransactions(userId, startDate, endDate) {
  // Get access token from Firestore
  const snap = await getDoc(doc(db, 'plaidAccounts', userId));
  if (!snap.exists()) throw new Error('No bank account connected');
  const { access_token } = snap.data();

  const res = await fetch(`${BACKEND_URL}/api/plaid/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token, start_date: startDate, end_date: endDate }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function fetchBalances(userId) {
  const snap = await getDoc(doc(db, 'plaidAccounts', userId));
  if (!snap.exists()) throw new Error('No bank account connected');
  const { access_token } = snap.data();

  const res = await fetch(`${BACKEND_URL}/api/plaid/balances`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}
