import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { usePlaid, fetchTransactions } from '../hooks/usePlaid';
import {
  PRACTICE_CATEGORIES, CATEGORY_COLORS, mapPlaidCategory,
  formatCurrency, formatDate, groupByCategory, groupByMonth
} from '../utils/categories';
import { format, subDays, startOfMonth } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [bankConnected, setBankConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterMonth, setFilterMonth] = useState('');
  const [editingTx, setEditingTx] = useState(null);
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualForm, setManualForm] = useState({ date: format(new Date(), 'yyyy-MM-dd'), name: '', amount: '', category: 'Other', note: '' });
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });

  // Check if bank is connected
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'plaidAccounts', currentUser.uid), snap => {
      setBankConnected(snap.exists());
    });
    return unsub;
  }, [currentUser]);

  // Load transactions from Firestore (real-time)
  useEffect(() => {
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', currentUser.uid),
      orderBy('date', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      const txs = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
      setTransactions(txs);
      setLoading(false);
    });
    return unsub;
  }, [currentUser]);

  // Plaid: sync transactions from bank
  const handlePlaidSuccess = useCallback(() => {
    syncTransactions();
  }, []);

  const { createLinkToken, open, ready, linkToken } = usePlaid(handlePlaidSuccess);

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  async function syncTransactions() {
    setSyncing(true);
    try {
      const data = await fetchTransactions(currentUser.uid, dateRange.start, dateRange.end);
      // Save each transaction to Firestore
      const batch = data.transactions.map(async t => {
        await setDoc(doc(db, 'transactions', t.id), {
          ...t,
          userId: currentUser.uid,
          practiceCategory: mapPlaidCategory(t.category),
          source: 'plaid',
          synced_at: new Date().toISOString(),
        });
      });
      await Promise.all(batch);
    } catch (err) {
      alert('Sync error: ' + err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function saveManualTransaction(e) {
    e.preventDefault();
    const id = 'manual_' + Date.now();
    await setDoc(doc(db, 'transactions', id), {
      id,
      userId: currentUser.uid,
      date: manualForm.date,
      name: manualForm.name,
      amount: parseFloat(manualForm.amount),
      practiceCategory: manualForm.category,
      note: manualForm.note,
      source: 'manual',
      created_at: new Date().toISOString(),
    });
    setManualForm({ date: format(new Date(), 'yyyy-MM-dd'), name: '', amount: '', category: 'Other', note: '' });
    setShowAddManual(false);
  }

  async function updateCategory(tx, newCategory) {
    await setDoc(doc(db, 'transactions', tx.firestoreId), { practiceCategory: newCategory }, { merge: true });
    setEditingTx(null);
  }

  async function deleteTransaction(tx) {
    if (window.confirm(`Delete "${tx.name}"?`)) {
      await deleteDoc(doc(db, 'transactions', tx.firestoreId));
    }
  }

  // Filtered transactions
  const filtered = transactions.filter(t => {
    const catMatch = filterCategory === 'All' || t.practiceCategory === filterCategory;
    const monthMatch = !filterMonth || t.date.startsWith(filterMonth);
    return catMatch && monthMatch;
  });

  const totalSpend = filtered.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const byCategory = groupByCategory(filtered);
  const byMonth = groupByMonth(transactions);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload?.length) {
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{payload[0].name || payload[0].payload.name}</p>
          <p className="tooltip-value">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">♥</span>
          <span className="brand-name">Practice<br/>Finance</span>
        </div>
        <nav className="sidebar-nav">
          {['overview', 'transactions', 'connect'].map(tab => (
            <button
              key={tab}
              className={`nav-item ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'overview' && '📊'}
              {tab === 'transactions' && '📋'}
              {tab === 'connect' && '🏦'}
              <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{currentUser.email[0].toUpperCase()}</div>
            <div className="user-email">{currentUser.email}</div>
          </div>
          <button className="logout-btn" onClick={logout}>Sign out</button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            <div className="page-header">
              <div>
                <h2>Overview</h2>
                <p className="page-subtitle">Practice financial summary</p>
              </div>
              <div className="header-actions">
                <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="month-filter" />
                {bankConnected && (
                  <button className="btn-secondary" onClick={syncTransactions} disabled={syncing}>
                    {syncing ? '⟳ Syncing…' : '⟳ Sync Bank'}
                  </button>
                )}
              </div>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid">
              <div className="kpi-card accent">
                <div className="kpi-label">Total Spend</div>
                <div className="kpi-value">{formatCurrency(totalSpend)}</div>
                <div className="kpi-sub">{filtered.length} transactions</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Top Category</div>
                <div className="kpi-value kpi-value-sm">{byCategory[0]?.name || '—'}</div>
                <div className="kpi-sub">{byCategory[0] ? formatCurrency(byCategory[0].total) : 'No data'}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Bank Status</div>
                <div className="kpi-value kpi-value-sm">{bankConnected ? '✓ Connected' : '✗ Not Connected'}</div>
                <div className="kpi-sub">{bankConnected ? 'Auto-sync active' : 'Connect to auto-sync'}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Categories Used</div>
                <div className="kpi-value">{byCategory.length}</div>
                <div className="kpi-sub">of {PRACTICE_CATEGORIES.length} available</div>
              </div>
            </div>

            {/* Charts */}
            <div className="charts-grid">
              <div className="chart-card wide">
                <h3>Monthly Spend</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byMonth} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <h3>By Category</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={byCategory.slice(0, 8)}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={85}
                      paddingAngle={2}
                      dataKey="total"
                    >
                      {byCategory.slice(0, 8).map((entry, i) => (
                        <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#64748B'} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pie-legend">
                  {byCategory.slice(0, 5).map(cat => (
                    <div key={cat.name} className="legend-item">
                      <span className="legend-dot" style={{ background: CATEGORY_COLORS[cat.name] || '#64748B' }} />
                      <span className="legend-name">{cat.name}</span>
                      <span className="legend-value">{formatCurrency(cat.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Category breakdown table */}
            <div className="table-card">
              <h3>Category Breakdown</h3>
              <table className="data-table">
                <thead>
                  <tr><th>Category</th><th>Transactions</th><th>Total</th><th>% of Spend</th></tr>
                </thead>
                <tbody>
                  {byCategory.map(cat => (
                    <tr key={cat.name}>
                      <td>
                        <span className="cat-dot" style={{ background: CATEGORY_COLORS[cat.name] || '#64748B' }} />
                        {cat.name}
                      </td>
                      <td>{cat.count}</td>
                      <td>{formatCurrency(cat.total)}</td>
                      <td>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${(cat.total / totalSpend * 100).toFixed(0)}%` }} />
                          <span>{(cat.total / totalSpend * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="tab-content">
            <div className="page-header">
              <div>
                <h2>Transactions</h2>
                <p className="page-subtitle">{filtered.length} records</p>
              </div>
              <div className="header-actions">
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="cat-filter">
                  <option value="All">All Categories</option>
                  {PRACTICE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="month-filter" />
                <button className="btn-primary" onClick={() => setShowAddManual(true)}>+ Add Manual</button>
              </div>
            </div>

            {/* Manual entry modal */}
            {showAddManual && (
              <div className="modal-overlay" onClick={() => setShowAddManual(false)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                  <h3>Add Transaction</h3>
                  <form onSubmit={saveManualTransaction} className="modal-form">
                    <div className="field">
                      <label>Date</label>
                      <input type="date" value={manualForm.date} onChange={e => setManualForm({ ...manualForm, date: e.target.value })} required />
                    </div>
                    <div className="field">
                      <label>Description</label>
                      <input type="text" value={manualForm.name} onChange={e => setManualForm({ ...manualForm, name: e.target.value })} placeholder="Medical supplies - Medline" required />
                    </div>
                    <div className="field">
                      <label>Amount ($)</label>
                      <input type="number" step="0.01" value={manualForm.amount} onChange={e => setManualForm({ ...manualForm, amount: e.target.value })} placeholder="0.00" required />
                    </div>
                    <div className="field">
                      <label>Category</label>
                      <select value={manualForm.category} onChange={e => setManualForm({ ...manualForm, category: e.target.value })}>
                        {PRACTICE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Note (optional)</label>
                      <input type="text" value={manualForm.note} onChange={e => setManualForm({ ...manualForm, note: e.target.value })} placeholder="Any notes…" />
                    </div>
                    <div className="modal-actions">
                      <button type="button" className="btn-secondary" onClick={() => setShowAddManual(false)}>Cancel</button>
                      <button type="submit" className="btn-primary">Save</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="table-card">
              {loading ? (
                <div className="loading-state">Loading transactions…</div>
              ) : filtered.length === 0 ? (
                <div className="empty-state">
                  <p>No transactions yet.</p>
                  <p>Connect your bank or add manually.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Date</th><th>Description</th><th>Category</th><th>Source</th><th>Amount</th><th></th></tr>
                  </thead>
                  <tbody>
                    {filtered.map(tx => (
                      <tr key={tx.firestoreId}>
                        <td className="date-cell">{formatDate(tx.date)}</td>
                        <td>{tx.name}</td>
                        <td>
                          {editingTx === tx.firestoreId ? (
                            <select
                              defaultValue={tx.practiceCategory}
                              onChange={e => updateCategory(tx, e.target.value)}
                              onBlur={() => setEditingTx(null)}
                              autoFocus
                            >
                              {PRACTICE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                            </select>
                          ) : (
                            <span
                              className="category-badge"
                              style={{ borderColor: CATEGORY_COLORS[tx.practiceCategory] || '#64748B' }}
                              onClick={() => setEditingTx(tx.firestoreId)}
                              title="Click to edit"
                            >
                              {tx.practiceCategory || 'Other'}
                            </span>
                          )}
                        </td>
                        <td><span className={`source-badge source-${tx.source}`}>{tx.source}</span></td>
                        <td className="amount-cell">{formatCurrency(tx.amount)}</td>
                        <td>
                          <button className="icon-btn delete-btn" onClick={() => deleteTransaction(tx)}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Connect Tab */}
        {activeTab === 'connect' && (
          <div className="tab-content">
            <div className="page-header">
              <h2>Bank Connection</h2>
            </div>
            <div className="connect-card">
              {bankConnected ? (
                <div className="connect-status connected">
                  <div className="connect-icon">✓</div>
                  <h3>Bank Account Connected</h3>
                  <p>Your transactions sync automatically. Use the Sync button on the Overview tab to pull the latest.</p>
                  <div className="date-range-row">
                    <div className="field">
                      <label>Sync from</label>
                      <input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>to</label>
                      <input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
                    </div>
                    <button className="btn-primary" onClick={syncTransactions} disabled={syncing}>
                      {syncing ? 'Syncing…' : 'Sync Now'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="connect-status">
                  <div className="connect-icon">🏦</div>
                  <h3>Connect Your Bank</h3>
                  <p>Securely link your practice's bank account or credit card to automatically import transactions. No manual entry needed.</p>
                  <ul className="connect-features">
                    <li>✓ Bank-level 256-bit encryption</li>
                    <li>✓ Read-only access — we can never move money</li>
                    <li>✓ Works with 12,000+ US banks</li>
                    <li>✓ Transactions auto-categorized for your practice</li>
                  </ul>
                  <button className="btn-primary btn-large" onClick={createLinkToken}>
                    Connect Bank Account
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
