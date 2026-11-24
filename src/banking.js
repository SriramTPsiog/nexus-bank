const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const clock = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
export const money = paise => rupees.format(paise / 100);
export const when = value => value && Number.isFinite(Date.parse(value)) ? clock.format(new Date(value)) + ' IST' : '—';
export const statusText = status => ({
  PENDING: 'Pending', PROCESSING: 'Processing', COMPLETED: 'Completed',
  REJECTED: 'Rejected', MANUAL_REVIEW: 'Manual review',
})[status] || status || 'Unknown';
export const bankName = (directory, id) => directory.find(bank => bank.bankId === id)?.bankName || id;
export const routeType = row => row.type === 'INTERNAL' ? 'Same bank' : 'Interbank';
export const direction = row => row.direction === 'CREDIT' ? 'Incoming' : row.direction === 'DEBIT' ? 'Outgoing' : row.direction === 'OWN' ? 'Between your accounts' : 'Transfer';

export function filterActivity(rows, directory, search, status, type) {
  const query = search.trim().toLowerCase();
  return rows.filter(row => (status === 'all' || row.status === status) && (type === 'all' || row.type === type) &&
    [row.transferId, row.sourceBankId, row.destinationBankId, bankName(directory, row.sourceBankId),
      bankName(directory, row.destinationBankId), direction(row)].some(value => value?.toLowerCase().includes(query)));
}

export function statementCsv(rows, directory) {
  const escape = value => {
    const safe = String(value ?? '').replace(/^(\s*[=+@-]|[\t\r\n])/, "'$1");
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const cells = rows.map(row => [row.transferId, row.createdAt, bankName(directory, row.sourceBankId),
    bankName(directory, row.destinationBankId), routeType(row), direction(row), (row.amountMinor / 100).toFixed(2), statusText(row.status)]);
  return '\uFEFF' + [['Reference', 'Created (ISO)', 'From bank', 'To bank', 'Type', 'Direction', 'Amount (INR)', 'Status'], ...cells]
    .map(line => line.map(escape).join(',')).join('\r\n');
}

export function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
