export const banks = {
  nexus: { id: 'P629', name: 'Nexus Bank', short: 'Nexus', ifsc: 'SRIR0A4N7WX',
    project: 'nexus-bank-79767', accounts: ['ACC001', 'ACC002'], color: '#204abe',
    theme: 'nexus', peer: 'lyra', wordmark: 'NEXUS' },
  lyra: { id: 'P648', name: 'Lyra Bank', short: 'Lyra', ifsc: 'SOWN0M9C5JQ',
    project: 'lyra-bank', accounts: ['LYR001', 'LYR002'], color: '#7840b2',
    theme: 'lyra', peer: 'nexus', wordmark: 'LYRA' },
};

const initialAccounts = {
  ACC001: { bank: 'nexus', number: 'NEXUS000001', balance: 1_000_000, label: 'Primary savings' },
  ACC002: { bank: 'nexus', number: 'NEXUS000002', balance: 50_000, label: 'Secondary savings' },
  LYR001: { bank: 'lyra', number: 'LYRA000001', balance: 100_000, label: 'Primary savings' },
  LYR002: { bank: 'lyra', number: 'LYRA000002', balance: 0, label: 'Secondary savings' },
};

export const storageKey = 'x42-bank-pages-demo-v1';
const initialState = () => ({ accounts: structuredClone(initialAccounts), transfers: [] });
let inMemory = initialState();

export function readLedger() {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : initialState();
  } catch {
    return inMemory;
  }
}

function writeLedger(state) {
  inMemory = state;
  try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* Demo works in this tab. */ }
}

function lock(callback) {
  return globalThis.navigator?.locks?.request
    ? navigator.locks.request(storageKey, async () => callback()) : Promise.resolve().then(callback);
}

export function resetLedger() {
  return lock(() => {
    const state = initialState();
    writeLedger(state);
    return state;
  });
}

export function toPaise(input) {
  if (!/^\d+(\.\d{1,2})?$/.test(input.trim())) return null;
  const [whole, fraction = ''] = input.trim().split('.');
  const total = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

export function postTransfer({ bank, from, target, type, amount, key }) {
  return lock(() => {
    const state = readLedger();
    const sender = state.accounts[from], recipient = state.accounts[target];
    if (!sender || sender.bank !== bank) throw new Error('Choose a source account from this bank.');
    const matched = state.transfers.find(item => item.id === key);
    if (matched) {
      if (matched.from !== from || matched.to !== target || matched.amount !== amount || matched.type !== type) {
        throw new Error('This request ID was already used with different details.');
      }
      return { state, transfer: matched };
    }
    if (!recipient || from === target) throw new Error('Choose a different destination account.');
    if (type !== 'internal' && type !== 'interbank') throw new Error('Choose a transfer type.');
    if ((type === 'internal') !== (sender.bank === recipient.bank)) throw new Error('Choose the transfer type that matches the destination.');
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Enter a positive amount in rupees with up to two decimals.');
    if (amount > sender.balance) throw new Error('Insufficient demo balance.');
    if (!Number.isSafeInteger(recipient.balance + amount)) throw new Error('The recipient balance would be too large.');
    const transfer = { id: key, from, to: target, fromBank: sender.bank, toBank: recipient.bank,
      type, amount, completedAt: new Date().toISOString() };
    sender.balance -= amount;
    recipient.balance += amount;
    state.transfers.unshift(transfer);
    writeLedger(state);
    return { state, transfer };
  });
}
