import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Alert, Button, Chip, CssBaseline, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Snackbar, TextField, ThemeProvider, createTheme,
} from '@mui/material';
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Building2, CircleHelp, CreditCard, Eye,
  EyeOff, Globe2, Landmark, LayoutDashboard, List, Orbit, RotateCcw, Send, Wallet,
} from 'lucide-react';
import '@fontsource-variable/inter';
import { banks, postTransfer, readLedger, resetLedger, storageKey, toPaise } from './ledger';
import bankChoice from './bank-config';
import LiveBank from './LiveBank';
import { configuredEndpoint, readStorage, saveStorage } from './live-api';
import './style.css';

const supportsDemo = typeof bankChoice === 'string';
const bank = supportsDemo ? banks[bankChoice] : bankChoice;
const peer = supportsDemo ? banks[bank.peer] : undefined;
const switchUrl = 'https://sriramtpsiog.github.io/SharedDB/';
const theme = createTheme({
  palette: { primary: { main: bank.color } },
  shape: { borderRadius: 10 },
  typography: { fontFamily: '"Inter Variable", Inter, sans-serif', button: { textTransform: 'none', fontWeight: 680 } },
  components: { MuiButton: { defaultProps: { disableElevation: true } } },
});
const money = minor => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(minor / 100);
const timestamp = iso => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
const bankKey = bank.theme;
const navigation = [
  { id: 'overview', name: 'Overview', Icon: LayoutDashboard },
  { id: 'accounts', name: 'Accounts', Icon: Wallet },
  { id: 'transfers', name: 'Transfers', Icon: ArrowLeftRight },
  { id: 'activity', name: 'Activity', Icon: List },
];
document.title = bank.name + ' | Account portal';
document.documentElement.dataset.bank = bank.theme;
const BrandIcon = bankKey === 'lyra' ? Orbit : Landmark;

function currentPage() {
  const value = location.hash.slice(1);
  return navigation.some(item => item.id === value) ? value : 'overview';
}

function AccountCard({ account, id, hidden, secondary }) {
  return <section className={'account-card ' + (secondary ? 'light-account' : 'primary-account')}>
    <div className="account-head"><span>{account.label}</span><CreditCard size={20} /></div>
    <div className="account-value">{hidden ? '₹ ••••••' : money(account.balance)}</div>
    <div className="account-foot"><span>{account.number}</span><span>{id}</span></div>
  </section>;
}

function ActivityTable({ rows, accounts }) {
  if (!rows.length) return <div className="empty"><List size={24} /><strong>No activity yet</strong><p>Completed demo transfers will appear here.</p></div>;
  return <div className="table-scroll"><table>
    <thead><tr><th>Transfer</th><th>Details</th><th>Amount</th><th>Status</th></tr></thead>
    <tbody>{rows.map(item => {
      const inbound = item.toBank === bankKey && item.fromBank !== bankKey;
      const internal = item.type === 'internal';
      const Icon = internal ? ArrowLeftRight : inbound ? ArrowDownLeft : ArrowUpRight;
      return <tr key={item.id}>
        <td><div className="transaction"><span className={'transaction-icon ' + (inbound ? 'incoming' : '')}><Icon size={17} /></span>
          <div><strong>{internal ? 'Within ' + bank.short : inbound ? 'From ' + banks[item.fromBank].short : 'To ' + banks[item.toBank].short}</strong>
          <small>{timestamp(item.completedAt)}</small></div></div></td>
        <td><strong>{accounts[item.from].number} → {accounts[item.to].number}</strong><small className="mono">{item.id}</small></td>
        <td className={inbound ? 'incoming amount' : 'amount'}>{internal ? '' : inbound ? '+' : '−'}{money(item.amount)}</td>
        <td><Chip size="small" className="completed" label="Completed" /></td>
      </tr>;
    })}</tbody>
  </table></div>;
}

function TransferForm({ ledger, onSubmit }) {
  const [type, setType] = useState('interbank');
  const [from, setFrom] = useState(bank.accounts[0]);
  const [to, setTo] = useState(peer.accounts[0]);
  const [amount, setAmount] = useState('200');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const choose = next => {
    setType(next);
    setTo(next === 'interbank' ? peer.accounts[0] : bank.accounts.find(id => id !== from));
    setError('');
  };
  const available = ledger.accounts[from].balance;
  const targets = type === 'interbank' ? peer.accounts : bank.accounts.filter(id => id !== from);
  async function submit(event) {
    event.preventDefault();
    const parsed = toPaise(amount);
    if (parsed === null) { setError('Enter a positive rupee amount with up to two decimals.'); return; }
    setBusy(true);
    setError('');
    try {
      const key = bank.id + '-' + (type === 'internal' ? 'INT-' : 'TXN-') + crypto.randomUUID();
      await onSubmit({ bank: bankKey, from, target: to, type, amount: parsed, key });
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  return <div className="transfer-layout">
    <section className="panel">
      <header className="panel-head"><div><h2>Send money</h2><p>Transfer between demo savings accounts.</p></div><Send size={21} /></header>
      <form className="transfer-form" onSubmit={submit}>
        <div className="type-switch">
          <Button variant={type === 'interbank' ? 'contained' : 'outlined'} aria-pressed={type === 'interbank'}
            startIcon={<Globe2 size={17} />} onClick={() => choose('interbank')}>Interbank</Button>
          <Button variant={type === 'internal' ? 'contained' : 'outlined'} aria-pressed={type === 'internal'}
            startIcon={<Building2 size={17} />} onClick={() => choose('internal')}>Same bank</Button>
        </div>
        <TextField select fullWidth label="From account" value={from} onChange={event => {
          const next = event.target.value;
          setFrom(next);
          if (type === 'internal') setTo(bank.accounts.find(id => id !== next));
        }}>
          {bank.accounts.map(id => <MenuItem key={id} value={id}>{ledger.accounts[id].label} · {id}</MenuItem>)}
        </TextField>
        <TextField select fullWidth label="To account" value={to} onChange={event => setTo(event.target.value)}>
          {targets.map(id => <MenuItem key={id} value={id}>{ledger.accounts[id].number}</MenuItem>)}
        </TextField>
        <TextField label="Amount in INR" required fullWidth value={amount} onChange={event => setAmount(event.target.value)}
          slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
        <p className="available">Available in source account <strong>{money(available)}</strong></p>
        {error && <Alert severity="error">{error}</Alert>}
        <div><Button type="submit" variant="contained" disabled={busy} startIcon={<Send size={16} />}>{busy ? 'Sending…' : 'Send demo transfer'}</Button></div>
      </form>
    </section>
    <section className="panel route-panel">
      <header className="panel-head"><div><h2>Transfer route</h2><p>{type === 'interbank' ? 'Via the SharedBank-Connect network' : 'Settled within ' + bank.name}</p></div></header>
      <div className="route-body">
        <div><span className="route-icon"><Landmark size={19} /></span><span><strong>{bank.name}</strong><small>{bank.ifsc}</small></span></div>
        <span className="route-line" />
        <div><span className="route-icon"><Building2 size={19} /></span><span><strong>{type === 'interbank' ? peer.name : bank.name}</strong><small>{type === 'interbank' ? peer.ifsc : bank.ifsc}</small></span></div>
        <Alert severity="info">This transfer updates demo balances in the current browser.</Alert>
      </div>
    </section>
  </div>;
}

function App({ openLive }) {
  const [ledger, setLedger] = useState(readLedger);
  const [page, setPage] = useState(currentPage);
  const [hidden, setHidden] = useState(false);
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState('');
  const [reset, setReset] = useState(false);
  const activity = ledger.transfers.filter(row => row.fromBank === bankKey || row.toBank === bankKey);

  useEffect(() => {
    const update = () => setPage(currentPage());
    const sync = event => { if (event.key === storageKey || event.key === null) setLedger(readLedger()); };
    window.addEventListener('hashchange', update);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('hashchange', update); window.removeEventListener('storage', sync); };
  }, []);
  function navigate(destination) {
    location.hash = destination;
    setPage(destination);
    window.scrollTo(0, 0);
  }
  async function submit(details) {
    const { state, transfer } = await postTransfer(details);
    setLedger(state);
    navigate('activity');
    setFilter('all');
    setToast('Demo transfer completed · ' + money(transfer.amount));
  }

  return <div className="layout">
    <aside className="sidebar">
      <button className="brand" type="button" onClick={() => navigate('overview')}>
        <span className="brand-icon"><BrandIcon size={23} /></span><span><strong>{bank.wordmark}</strong><small>BANKING PORTAL</small></span>
      </button>
      <nav aria-label="Bank navigation">
        {navigation.map(({ id, name, Icon }) => <button key={id} className={page === id ? 'active' : ''}
          onClick={() => navigate(id)} aria-current={page === id ? 'page' : undefined}><Icon size={19} />{name}</button>)}
      </nav>
      <a className="switch-link" href={switchUrl}><Globe2 size={17} /> SharedBank switch</a>
    </aside>
    <div className="main">
      <header className="topbar"><strong>{bank.name}</strong><div className="live-mode-actions"><Chip label="Demo accounts" size="small" className="demo" />
        <Button size="small" variant="outlined" onClick={openLive}>Firestore mode</Button></div></header>
      <main className="content">
        <header className="page-head"><div><h1>{navigation.find(item => item.id === page).name}</h1>
          <p>{page === 'overview' ? 'Manage your savings and transfers.' : page === 'accounts' ? 'View your account balances and routing details.' :
            page === 'transfers' ? 'Send a same-bank or interbank demo payment.' : 'Review payments into and out of your bank.'}</p></div>
          {page !== 'transfers' && <Button variant="contained" onClick={() => navigate('transfers')} startIcon={<Send size={17} />}>New transfer</Button>}
        </header>
        {['overview', 'accounts'].includes(page) && <>
          <div className="section-heading"><h2>Your accounts</h2><Button color="inherit" size="small"
            onClick={() => setHidden(!hidden)} startIcon={hidden ? <Eye size={16} /> : <EyeOff size={16} />}>{hidden ? 'Show balances' : 'Hide balances'}</Button></div>
          <div className="accounts">{bank.accounts.map((id, index) => <AccountCard key={id} account={ledger.accounts[id]} id={id} hidden={hidden} secondary={index > 0} />)}</div>
        </>}
        {page === 'overview' && <section className="panel activity-panel">
          <header className="panel-head"><div><h2>Recent activity</h2><p>Latest completed demo transactions</p></div><Button variant="outlined" onClick={() => navigate('activity')}>View activity</Button></header>
          <ActivityTable rows={activity.slice(0, 5)} accounts={ledger.accounts} />
        </section>}
        {page === 'accounts' && <section className="panel activity-panel">
          <header className="panel-head"><div><h2>Bank details</h2><p>Routing information for demo transfers</p></div><Building2 size={21} /></header>
          <dl className="bank-details"><dt>Bank ID</dt><dd>{bank.id}</dd><dt>IFSC</dt><dd>{bank.ifsc}</dd><dt>Firestore project ID</dt><dd>{bank.project}</dd></dl>
        </section>}
        {page === 'transfers' && <TransferForm ledger={ledger} onSubmit={submit} />}
        {page === 'activity' && <section className="panel"><header className="panel-head">
          <div><h2>Transaction history</h2><p>{activity.length} completed {activity.length === 1 ? 'transfer' : 'transfers'}</p></div>
          <TextField size="small" select value={filter} label="Type" onChange={event => setFilter(event.target.value)}>
            <MenuItem value="all">All transfers</MenuItem><MenuItem value="interbank">Interbank</MenuItem><MenuItem value="internal">Same bank</MenuItem>
          </TextField>
          </header><ActivityTable rows={activity.filter(item => filter === 'all' || item.type === filter)} accounts={ledger.accounts} /></section>}
        <footer><span><CircleHelp size={15} /> Demo ledger · Stored in this browser</span><Button size="small" color="inherit"
          onClick={() => setReset(true)} startIcon={<RotateCcw size={14} />}>Reset demo</Button></footer>
      </main>
    </div>
    <Dialog open={reset} onClose={() => setReset(false)}><DialogTitle>Reset demo ledger?</DialogTitle>
      <DialogContent>This restores the starting balances and clears the demo activity for both banks on this origin.</DialogContent>
      <DialogActions><Button onClick={() => setReset(false)}>Cancel</Button><Button variant="contained" onClick={async () => {
        setLedger(await resetLedger()); setReset(false); setToast('Demo ledger reset');
      }}>Reset demo</Button></DialogActions>
    </Dialog>
    <Snackbar open={Boolean(toast)} autoHideDuration={4500} onClose={() => setToast('')} message={toast} />
  </div>;
}

function Portal() {
  const key = 'x42-mode-' + bank.id;
  const [mode, setMode] = useState(() => supportsDemo
    ? readStorage(localStorage, key, configuredEndpoint ? 'live' : 'demo') : 'live');
  function select(next) {
    setMode(next);
    saveStorage(localStorage, key, next);
  }
  return mode === 'live'
    ? <LiveBank bank={bank} switchUrl={switchUrl} openDemo={supportsDemo ? () => select('demo') : undefined} />
    : <App openLive={() => select('live')} />;
}

createRoot(document.getElementById('root')).render(<ThemeProvider theme={theme}><CssBaseline /><Portal /></ThemeProvider>);
