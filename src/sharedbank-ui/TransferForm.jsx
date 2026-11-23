import { useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { Building2, Globe2, MapPin } from 'lucide-react';
import { money } from './banking';
import { toPaise } from './ledger';

export default function TransferForm({ bank, accounts, directory, send, demoAccounts, directoryError, retryDirectory, loadingDirectory }) {
  const [internal, setInternal] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const sources = accounts.filter(a => a.status === 'ACTIVE');
  const source = sources.find(a => a.accountId === sourceId) || sources[0];
  const routes = directory.filter(b => b.bankId !== bank.id && b.status === 'ACTIVE');
  const target = internal ? { bankName: bank.name, ifsc: bank.ifsc } : routes.find(b => b.ifsc === ifsc);
  const demoTargets = demoAccounts?.filter(a => a.ifsc === target?.ifsc && a.accountNumber !== source?.accountNumber);

  function chooseType(value) { setInternal(value); setNumber(''); setError(''); }
  function prepare(event) {
    event.preventDefault();
    const amountMinor = toPaise(amount);
    const accountNumber = number.trim();
    let message = '';
    if (!source || !target) message = 'Select a source account and destination bank.';
    else if (!/^[A-Za-z0-9-]{4,40}$/.test(accountNumber)) message = 'Enter a 4–40 character account number using letters, digits, or hyphens.';
    else if (internal && accountNumber === source.accountNumber) message = 'Choose a different destination account.';
    else if (amountMinor === null) message = 'Enter a positive amount with up to two decimal places.';
    else if (amountMinor > source.availableMinor) message = 'The amount exceeds the available balance.';
    setError(message);
    if (message) return;
    setReview({ source: source.accountNumber, target: target.bankName, data: {
      fromAccountId: source.accountId, destinationIfsc: target.ifsc, destinationAccountNumber: accountNumber, amountMinor, currency: 'INR',
    } });
  }

  async function confirm() {
    if (submitting.current || !review) return;
    submitting.current = true;
    setBusy(true); setError('');
    try {
      await send(review.data);
      setNumber(''); setAmount(''); setReview(null);
    } catch (failure) { setError(failure.message); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <div className="send-layout"><section className="box transfer"><div className="box-head"><div><h2>Payment details</h2><p>Use the recipient’s bank and account number.</p></div></div>
    <form className="fields" onSubmit={prepare}>
      <div className="toggle-group" aria-label="Transfer type">
        <button type="button" aria-pressed={!internal} onClick={() => chooseType(false)}><Globe2 size={16} /> Interbank</button>
        <button type="button" aria-pressed={internal} onClick={() => chooseType(true)}><Building2 size={16} /> Same bank</button>
      </div>
      <TextField select required label="From account" value={source?.accountId || ''} disabled={!sources.length}
        helperText={source ? money(source.availableMinor) + ' available' : 'No active account available.'}
        onChange={e => { setSourceId(e.target.value); if (internal) setNumber(''); }}>
        {sources.map(a => <MenuItem key={a.accountId} value={a.accountId}>{a.label} · {a.accountNumber}</MenuItem>)}</TextField>
      {!internal && <>
        <TextField select required label="Destination bank" value={target?.ifsc || ''} disabled={!routes.length}
          helperText={loadingDirectory ? 'Loading bank directory…' : !routes.length && !directoryError ? 'No other active banks available.' : undefined}
          onChange={e => { setIfsc(e.target.value); setNumber(''); }}>
          {routes.map(b => <MenuItem key={b.ifsc} value={b.ifsc}>{b.bankName} · {b.ifsc}</MenuItem>)}</TextField>
        {directoryError && <Alert severity="warning" action={<Button onClick={retryDirectory}>Retry</Button>}>{directoryError}</Alert>}
      </>}
      {demoAccounts ? <TextField select label="Recipient account number" required value={number} disabled={!demoTargets?.length} onChange={e => setNumber(e.target.value)}>
        {(demoTargets || []).map(a => <MenuItem key={a.accountNumber} value={a.accountNumber}>{a.accountNumber}</MenuItem>)}</TextField>
        : <TextField required label="Recipient account number" autoComplete="off" value={number} onChange={e => setNumber(e.target.value)} />}
      <TextField required label="Amount in INR" placeholder="0.00" value={amount}
        onChange={e => setAmount(e.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
      {error && !review && <Alert severity="error">{error}</Alert>}
      <Button type="submit" variant="contained" disabled={!target || !source}>Review transfer</Button>
    </form></section>
    <aside className="box route"><div className="box-head"><div><h2>Transfer route</h2><p>{internal ? 'Within your bank' : 'Across the SharedBank network'}</p></div><MapPin size={19}/></div>
      <ol>{[{ bankName: bank.name, ifsc: bank.ifsc }, target].map((b, i) => <li key={i}><span>{i ? 'Destination' : 'Source'}</span>
        <strong>{b?.bankName || 'Select a bank'}</strong>{b && <code>{b.ifsc}</code>}</li>)}</ol>
    </aside>
    <Dialog open={Boolean(review)} onClose={() => { if (!busy) setReview(null); }} fullWidth maxWidth="xs" aria-labelledby="review-title">
      <DialogTitle id="review-title">Review transfer</DialogTitle>{review && <DialogContent><div className="receipt-total">{money(review.data.amountMinor)}</div>
        <dl className="details">{[['From account', review.source], ['To bank', review.target], ['IFSC', review.data.destinationIfsc],
          ['To account', review.data.destinationAccountNumber]].map(([k,v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>}<DialogActions><Button disabled={busy} onClick={() => setReview(null)}>Edit</Button>
        <Button variant="contained" onClick={confirm} disabled={busy}>{busy ? 'Submitting…' : 'Confirm transfer'}</Button></DialogActions>
    </Dialog>
  </div>;
}
