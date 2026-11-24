import { useState } from 'react';
import { Clock3, Layers3 } from 'lucide-react';
import { money } from './banking';

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const istOffset = 330 * 60_000;
const dayMs = 86_400_000;

export function AccountMix({ accounts, hidden, openAccounts }) {
  const [selected, setSelected] = useState('');
  const account = accounts.find(item => item.accountId === selected) || accounts[0];
  if (!account) return null;
  return <section className="passbook-panel"><header><div><Layers3 size={20}/><h2>Account passbook</h2></div>
    <button className="text-action" onClick={openAccounts}>View accounts</button></header>
    <label className="passbook-select"><span>Account</span><select value={account.accountId} onChange={e => setSelected(e.target.value)}>
      {accounts.map(item => <option key={item.accountId} value={item.accountId}>{item.label} · {item.accountNumber.slice(-4)}</option>)}
    </select></label>
    <div className="book-figures"><div><small>Available</small><strong>{hidden ? '••••' : money(account.availableMinor)}</strong></div>
      <div><small>On hold</small><strong>{hidden ? '••••' : money(account.heldMinor)}</strong></div></div>
    <div className="passbook-strip"><span>Account number</span><code>{account.accountNumber}</code></div></section>;
}

export function ActivityRhythm({ rows }) {
  const [days, setDays] = useState(7);
  const [selected, setSelected] = useState(null);
  const today = Math.floor((Date.now() + istOffset) / dayMs);
  const start = today - days + 1;
  const buckets = Array.from({ length: days }, (_, index) => ({ day: start + index, count: 0 }));
  for (const row of rows) {
    const index = Math.floor((Date.parse(row.createdAt) + istOffset) / dayMs) - start;
    if (buckets[index]) buckets[index].count++;
  }
  const total = buckets.reduce((sum, item) => sum + item.count, 0);
  const max = Math.max(1, ...buckets.map(item => item.count));
  const active = buckets.find(item => item.day === selected) || buckets.at(-1);
  const date = day => dayFormat.format(new Date(day * dayMs));
  return <section className="rhythm-panel"><header><div><Clock3 size={20}/><h2>Transfer activity</h2></div>
    <div className="range-switch" aria-label="Activity period">{[7,14].map(n => <button key={n} aria-pressed={days === n} onClick={() => setDays(n)}>{n}d</button>)}</div></header>
    <p><strong>{total}</strong> {total === 1 ? 'transfer' : 'transfers'} in loaded history</p>
    <div className="rhythm-bars">{buckets.map(item => <button key={item.day} aria-pressed={active.day === item.day}
      aria-label={date(item.day) + ', ' + item.count + ' transfers'} onClick={() => setSelected(item.day)}>
      <i style={{height: item.count ? (item.count / max * 100) + '%' : 2}}/></button>)}</div>
    <div className="chart-dates"><span>{date(start)}</span><span>{date(today)}</span></div>
    <div className="chart-readout" aria-live="polite">{date(active.day)} · {active.count} {active.count === 1 ? 'transfer' : 'transfers'} · IST</div></section>;
}
