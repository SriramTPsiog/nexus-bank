import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import '@fontsource-variable/inter';
import { banks, postTransfer, readLedger, resetLedger, storageKey } from './ledger';
import bankChoice from '../bank-config';
import LiveBank from './LiveBank';
import Workspace from './Workspace';
import { configuredEndpoint, readStorage, saveStorage } from './live-api';
import './style.css';

const supportsDemo = typeof bankChoice === 'string';
const bank = supportsDemo ? banks[bankChoice] : bankChoice;
const primary = bank.color || '#234cca';
document.documentElement.style.setProperty('--blue', primary);
const theme = createTheme({
  palette: { primary: { main: primary }, text: { primary: '#19263e', secondary: '#53627b' } },
  shape: { borderRadius: 10 },
  typography: { fontFamily: '"Inter Variable", Inter, sans-serif', button: { textTransform: 'none', fontWeight: 650 } },
  components: { MuiButton: { defaultProps: { disableElevation: true } } },
});
document.title = bank.name + ' | Personal banking';
const demoDirectory = Object.values(banks).map(b => ({ bankId: b.id, bankName: b.name, ifsc: b.ifsc, status: 'ACTIVE' }));
function demoRow(t) {
  return { transferId: t.id, createdAt: t.completedAt, updatedAt: t.completedAt, completedAt: t.completedAt, amountMinor: t.amount,
    status: 'COMPLETED', sourceBankId: banks[t.fromBank].id, destinationBankId: banks[t.toBank].id, type: t.type.toUpperCase(),
    direction: t.fromBank === t.toBank ? 'OWN' : t.fromBank === bank.theme ? 'DEBIT' : 'CREDIT' };
}
function Demo({ leave }) {
  const [ledger, setLedger] = useState(readLedger);
  useEffect(() => {
    const sync = e => { if (e.key === storageKey || e.key === null) setLedger(readLedger()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const accounts = Object.entries(ledger.accounts).map(([accountId, a]) => ({
    accountId, accountNumber: a.number, label: a.label, status: 'ACTIVE', availableMinor: a.balance,
    heldMinor: 0, ifsc: banks[a.bank].ifsc,
  }));
  async function send(data) {
    const to = accounts.find(a => a.ifsc === data.destinationIfsc && a.accountNumber === data.destinationAccountNumber);
    const type = data.destinationIfsc === bank.ifsc ? 'internal' : 'interbank';
    const result = await postTransfer({ bank: bank.theme, from: data.fromAccountId, target: to?.accountId,
      type, amount: data.amountMinor, key: bank.id + (type === 'internal' ? '-INT-' : '-TXN-') + crypto.randomUUID() });
    setLedger(result.state); return demoRow(result.transfer);
  }
  return <Workspace bank={bank} demo accounts={accounts.filter(a => a.ifsc === bank.ifsc)} demoAccounts={accounts}
    directory={demoDirectory} transfers={ledger.transfers.filter(t => t.fromBank === bank.theme || t.toBank === bank.theme).map(demoRow)}
    ready send={send} leave={leave} reset={async () => setLedger(await resetLedger())}/>;
}
function Portal() {
  const key = 'x42-mode-' + bank.id;
  const [mode, setMode] = useState(() => supportsDemo ? readStorage(localStorage, key, configuredEndpoint ? 'live' : 'demo') : 'live');
  function select(next) { saveStorage(localStorage, key, next); setMode(next); }
  return mode === 'demo' && supportsDemo ? <Demo leave={() => select('live')}/> :
    <LiveBank bank={bank} openDemo={supportsDemo ? () => select('demo') : undefined}/>;
}
createRoot(document.getElementById('root')).render(<ThemeProvider theme={theme}><CssBaseline/><Portal/></ThemeProvider>);
