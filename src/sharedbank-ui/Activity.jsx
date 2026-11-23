import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Download, ListFilter, ReceiptText, Search } from 'lucide-react';
import { bankName, direction, downloadFile, filterActivity, money, routeType, statementCsv, statusText, when } from './banking';

export function Status({ value }) {
  return <span className={'status status-' + value}><i aria-hidden="true" />{statusText(value)}</span>;
}

export function Receipt({ row, directory, bank, demo, close }) {
  if (!row) return null;
  const fields = [
    ['Reference', row.transferId], ['Status', statusText(row.status)], ['From bank', bankName(directory, row.sourceBankId)],
    ['To bank', bankName(directory, row.destinationBankId)], ['Transfer type', routeType(row)],
    ['Created', when(row.createdAt)], ['Last updated', when(row.updatedAt || row.createdAt)],
  ];
  if (row.completedAt) fields.push(['Completed', when(row.completedAt)]);
  if (row.code) fields.push(['Reason', row.code.toLowerCase().replaceAll('_', ' ')]);
  const title = row.status === 'COMPLETED' ? 'Transfer receipt' : 'Transfer details';
  const download = () => downloadFile(row.transferId + '.txt',
    [bank.name, demo ? 'Browser demo' : 'SharedBank test network', title, money(row.amountMinor), ...fields.map(([k, v]) => k + ': ' + v)].join('\n'), 'text/plain;charset=utf-8');
  return <Dialog open onClose={close} fullWidth maxWidth="xs" aria-labelledby="receipt-title">
    <DialogTitle id="receipt-title">{title}</DialogTitle><DialogContent>
      <div className="receipt-total">{money(row.amountMinor)} <Status value={row.status} /></div>
      <dl className="details">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </DialogContent><DialogActions><Button startIcon={<Download size={16} />} onClick={download}>Download</Button><Button onClick={close}>Close</Button></DialogActions>
  </Dialog>;
}

export default function Activity({ bank, rows, directory, openReceipt, full, viewAll, demo }) {
  const [query, search] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const filtered = full ? filterActivity(rows, directory, query, status, type) : rows.slice(0, 5);
  const reset = () => { search(''); setStatus('all'); setType('all'); };
  return <section className="box activity"><div className="box-head">
    <div><h2>{full ? 'Transaction history' : 'Recent activity'}</h2>
      <p>{full ? (demo ? 'Transfers in this browser’s demo ledger.' : 'Up to 50 transfers from your account dashboard.') : 'Your latest transfers across the network.'}</p></div>
    {full ? <Button variant="outlined" startIcon={<Download size={16} />} disabled={!filtered.length} onClick={() =>
      downloadFile(bank.id + '-' + (demo ? 'demo-' : '') + 'transactions.csv', statementCsv(filtered, directory), 'text/csv;charset=utf-8')}>Export CSV</Button>
      : <Button onClick={viewAll}>View all</Button>}
  </div>
    {full && <div className="filters"><TextField size="small" type="search" label="Search by bank or reference" value={query} onChange={e => search(e.target.value)}
      slotProps={{ input: { startAdornment: <Search size={17} aria-hidden="true" className="field-icon" /> } }} />
      <TextField select size="small" label="Status" value={status} onChange={e => setStatus(e.target.value)}>
        <MenuItem value="all">All statuses</MenuItem>{['COMPLETED','PENDING','PROCESSING','REJECTED','MANUAL_REVIEW'].map(s => <MenuItem key={s} value={s}>{statusText(s)}</MenuItem>)}</TextField>
      <TextField select size="small" label="Route" value={type} onChange={e => setType(e.target.value)}>
        <MenuItem value="all">All routes</MenuItem><MenuItem value="INTERNAL">Same bank</MenuItem><MenuItem value="INTERBANK">Interbank</MenuItem></TextField>
    </div>}
    {filtered.length ? <ul className="transactions">{filtered.map(row => {
      const internal = row.type === 'INTERNAL';
      const credit = row.direction === 'CREDIT';
      const Icon = internal ? ArrowLeftRight : credit ? ArrowDownLeft : ArrowUpRight;
      const line = internal ? 'Within ' + bankName(directory, row.sourceBankId) :
        (credit ? 'From ' : 'To ') + bankName(directory, credit ? row.sourceBankId : row.destinationBankId);
      return <li key={row.transferId}><button className="transaction-row" onClick={() => openReceipt(row)}>
        <span className={'tx-icon ' + (credit ? 'credit' : '')}><Icon size={20} /></span>
        <span className="tx-title"><strong>{line}</strong><small>{when(row.createdAt)}</small></span>
        <Status value={row.status} /><span className="tx-amount">{money(row.amountMinor)}<small>{direction(row)}</small></span>
      </button></li>;
    })}</ul> : <div className="empty-state">{rows.length ? <ListFilter /> : <ReceiptText />}
      <h3>{rows.length ? 'No matching transfers' : 'No transfers yet'}</h3>
      <p>{rows.length ? 'Try a different reference, bank, or filter.' : 'Your first transfer will appear here.'}</p>
      {rows.length > 0 && <Button onClick={reset}>Clear filters</Button>}</div>}
  </section>;
}
