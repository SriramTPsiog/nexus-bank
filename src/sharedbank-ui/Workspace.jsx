import { useEffect, useState } from 'react';
import { Alert, Button, IconButton } from '@mui/material';
import { ArrowLeftRight, Copy, Eye, EyeOff, Globe2, History, LayoutDashboard, LogOut, RefreshCw, RotateCcw, Send, Wallet } from 'lucide-react';
import Activity, { Receipt } from './Activity';
import TransferForm from './TransferForm';
import { money, when } from './banking';

export const switchUrl = 'https://sriramtpsiog.github.io/SharedDB/';
export function Brand({ bank }) {
  return <span className="brand"><span className="mark" aria-hidden="true">{bank.name.trim().charAt(0).toUpperCase()}</span><strong>{bank.name}</strong></span>;
}
const pages = [
  ['overview', 'Overview', LayoutDashboard], ['accounts', 'Accounts', Wallet],
  ['transfers', 'Send money', ArrowLeftRight], ['activity', 'Activity', History],
];
function currentPage() {
  const hash = location.hash.slice(1);
  return pages.some(([key]) => key === hash) ? hash : 'overview';
}
function Balance({ bank, accounts, hidden, toggle }) {
  const total = accounts.reduce((sum, a) => sum + a.availableMinor, 0);
  const held = accounts.reduce((sum, a) => sum + a.heldMinor, 0);
  return <section className="balance"><div className="intaglio" aria-hidden="true"/><div className="balance-content">
    <div className="balance-top"><span>Total available balance</span><IconButton size="small" aria-label={hidden ? 'Show balances' : 'Hide balances'} onClick={toggle}>
      {hidden ? <Eye size={18}/> : <EyeOff size={18}/>}</IconButton></div>
    <strong className="balance-number">{hidden ? '₹ ••••••' : money(total)}</strong>
    <div className="balance-foot"><span>{accounts.length} linked {accounts.length === 1 ? 'account' : 'accounts'}</span><span>On hold &nbsp; {hidden ? '••••' : money(held)}</span></div>
  </div><span className="balance-bank">{bank.wordmark}</span></section>;
}
function Accounts({ accounts, hidden, bank }) {
  const [copyState, setCopyState] = useState('');
  async function copy(number) {
    try { await navigator.clipboard.writeText(number); setCopyState('Account number copied.'); }
    catch { setCopyState('Select the account number to copy it manually.'); }
  }
  return <section className="box"><div className="box-head"><div><h2>Your accounts</h2><p>{bank.name} · IFSC {bank.ifsc}</p></div></div>
    <div className="account-list">{accounts.map(a => <div key={a.accountId} className="account">
      <div className="account-heading"><span className="tx-icon"><Wallet size={20}/></span><div><strong>{a.label}</strong><small>{a.accountId} · {a.status}</small></div></div>
      <div className="account-details"><div><span>Account number</span><strong><code>{a.accountNumber}</code>
        <IconButton size="small" aria-label={'Copy account number ' + a.accountNumber} onClick={() => copy(a.accountNumber)}><Copy size={15}/></IconButton></strong></div>
        <div><span>Available</span><strong>{hidden ? '••••' : money(a.availableMinor)}</strong></div>
        <div><span>On hold</span><strong>{hidden ? '••••' : money(a.heldMinor)}</strong></div>
      </div></div>)}</div><div role="status" className="copy-message">{copyState}</div>
  </section>;
}

export default function Workspace({ bank, email, demo, accounts, transfers, directory, directoryError, retryDirectory,
  loadingDirectory, demoAccounts, ready, error, updated, refreshing, refresh, send, leave, reset, connection }) {
  const [page, setPage] = useState(currentPage);
  const [hidden, setHidden] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  useEffect(() => {
    const onChange = () => { setPage(currentPage()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  function navigate(next) { location.hash = next; setPage(next); }
  const toggle = () => setHidden(value => !value);
  const title = ({ overview: 'Account overview', accounts: 'Accounts', transfers: 'Send money', activity: 'Activity' })[page];
  async function submit(data) { const row = await send(data); navigate('activity'); setReceipt(row); }
  const receiptRow = transfers.find(row => row.transferId === receipt?.transferId);
  const currentReceipt = receiptRow && (!receipt.updatedAt || !receiptRow.updatedAt || Date.parse(receiptRow.updatedAt) >= Date.parse(receipt.updatedAt)) ? receiptRow : receipt;
  return <div className="shell"><header className="masthead"><div className="mast-inner"><Brand bank={bank}/>
    <div className="header-actions"><span className="network-label">{demo ? 'Browser demo' : 'Test network'}</span>
      <Button color="inherit" startIcon={<LogOut size={16}/>} onClick={leave}>{demo ? 'Live sign-in' : 'Sign out'}</Button></div></div></header>
    <div className="app-layout"><aside className="sidebar"><nav aria-label="Bank navigation">{pages.map(([key,label,Icon]) =>
      <a key={key} href={'#' + key} aria-current={key === page ? 'page' : undefined}><Icon size={18}/>{label}</a>)}</nav>
      <a className="network-link" href={switchUrl}><Globe2 size={16}/> SharedBank switch</a></aside>
      <main className="workspace"><div className="page-title"><div><h1>{title}</h1><p>{demo ? 'Local demo account' : email}</p></div>
        {refresh && <Button variant="outlined" disabled={refreshing} startIcon={<RefreshCw size={16}/>} onClick={refresh}>{refreshing ? 'Refreshing…' : 'Refresh'}</Button>}</div>
        {error && <Alert severity="warning">{error}{ready ? ' Showing the last loaded dashboard.' : ''}</Alert>}
        {!ready && !error && <p role="status">Loading your accounts and transfers…</p>}
        {ready && <>
          {!accounts.length && <Alert severity="info">No synthetic accounts are linked to this login. Ask the {bank.name} owner to attach your Firebase UID to a bank account.</Alert>}
          {(page === 'overview' || page === 'accounts') && <>
            <div className="overview-grid"><Balance bank={bank} accounts={accounts} hidden={hidden} toggle={toggle}/>
              <section className="box quick"><h2>Quick actions</h2>
                <button onClick={() => navigate('transfers')}><span className="shortcut-icon"><Send size={18}/></span> Send money</button>
                <button onClick={() => navigate(page === 'accounts' ? 'activity' : 'accounts')}><span className="shortcut-icon">
                  {page === 'accounts' ? <History size={18}/> : <Wallet size={18}/>}</span>{page === 'accounts' ? 'View activity' : 'Account details'}</button>
              </section></div>
            {page === 'accounts' && <Accounts accounts={accounts} bank={bank} hidden={hidden}/>}
          </>}
          {page === 'transfers' && <TransferForm bank={bank} accounts={accounts} directory={directory} send={submit} demoAccounts={demoAccounts}
            directoryError={directoryError} retryDirectory={retryDirectory} loadingDirectory={loadingDirectory}/>}
          {(page === 'activity' || page === 'overview') && <Activity bank={bank} key={page} full={page === 'activity'} rows={transfers} demo={demo} directory={directory}
            openReceipt={setReceipt} viewAll={() => navigate('activity')} />}
        </>}
        <div className="workspace-foot"><span>{demo ? 'Demo balances are stored in this browser.' : updated ? 'Dashboard updated ' + when(updated) : 'SharedBank test network'}</span>
          {reset && <Button size="small" startIcon={<RotateCcw size={14}/>} onClick={() => setResetOpen(true)}>Reset demo</Button>}
          {connection}<a className="mobile-switch" href={switchUrl}>SharedBank switch</a></div>
        {resetOpen && <Alert severity="warning">Restore the starting balances and clear both banks’ browser demo history?
          <div><Button onClick={() => setResetOpen(false)}>Cancel</Button><Button onClick={async () => { await reset(); setResetOpen(false); setReceipt(null); }}>Restore demo</Button></div></Alert>}
      </main></div><Receipt row={currentReceipt} bank={bank} demo={demo} directory={directory} close={() => setReceipt(null)}/>
  </div>;
}
