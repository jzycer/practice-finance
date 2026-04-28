export const PRACTICE_CATEGORIES = [
  'Medical Supplies',
  'Equipment',
  'Medications / Samples',
  'Office Supplies',
  'Rent / Lease',
  'Utilities',
  'Insurance',
  'Payroll',
  'Marketing',
  'Software / Subscriptions',
  'Professional Services',
  'Lab / Testing',
  'Cleaning / Maintenance',
  'Travel',
  'Meals / Entertainment',
  'Education / Training',
  'Taxes / Fees',
  'Banking Fees',
  'Other',
];

// Map Plaid categories → practice categories
export function mapPlaidCategory(plaidCategory) {
  const cat = (plaidCategory || '').toLowerCase();
  if (cat.includes('medical') || cat.includes('pharmacy') || cat.includes('health')) return 'Medical Supplies';
  if (cat.includes('rent') || cat.includes('lease')) return 'Rent / Lease';
  if (cat.includes('utilities') || cat.includes('electric') || cat.includes('gas') || cat.includes('water')) return 'Utilities';
  if (cat.includes('insurance')) return 'Insurance';
  if (cat.includes('payroll') || cat.includes('paycheck')) return 'Payroll';
  if (cat.includes('software') || cat.includes('subscription') || cat.includes('saas')) return 'Software / Subscriptions';
  if (cat.includes('office') || cat.includes('staples') || cat.includes('supply')) return 'Office Supplies';
  if (cat.includes('travel') || cat.includes('airline') || cat.includes('hotel')) return 'Travel';
  if (cat.includes('restaurant') || cat.includes('food') || cat.includes('dining')) return 'Meals / Entertainment';
  if (cat.includes('education') || cat.includes('training') || cat.includes('conference')) return 'Education / Training';
  if (cat.includes('bank') || cat.includes('fee') || cat.includes('service charge')) return 'Banking Fees';
  if (cat.includes('tax')) return 'Taxes / Fees';
  return 'Other';
}

export const CATEGORY_COLORS = {
  'Medical Supplies': '#0EA5E9',
  'Equipment': '#6366F1',
  'Medications / Samples': '#8B5CF6',
  'Office Supplies': '#F59E0B',
  'Rent / Lease': '#EF4444',
  'Utilities': '#10B981',
  'Insurance': '#F97316',
  'Payroll': '#EC4899',
  'Marketing': '#14B8A6',
  'Software / Subscriptions': '#A78BFA',
  'Professional Services': '#64748B',
  'Lab / Testing': '#06B6D4',
  'Cleaning / Maintenance': '#84CC16',
  'Travel': '#F43F5E',
  'Meals / Entertainment': '#FBBF24',
  'Education / Training': '#34D399',
  'Taxes / Fees': '#FB7185',
  'Banking Fees': '#94A3B8',
  'Other': '#CBD5E1',
};

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Math.abs(amount));
}

export function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function groupByCategory(transactions) {
  const groups = {};
  transactions.forEach(t => {
    const cat = t.practiceCategory || t.category || 'Other';
    if (!groups[cat]) groups[cat] = { total: 0, count: 0 };
    groups[cat].total += Math.abs(t.amount);
    groups[cat].count += 1;
  });
  return Object.entries(groups)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total);
}

export function groupByMonth(transactions) {
  const groups = {};
  transactions.forEach(t => {
    const month = t.date.substring(0, 7); // YYYY-MM
    if (!groups[month]) groups[month] = 0;
    groups[month] += Math.abs(t.amount);
  });
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      total,
    }));
}
