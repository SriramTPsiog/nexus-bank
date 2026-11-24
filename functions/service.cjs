const { createHash } = require('node:crypto');
class Problem extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function requireThat(condition, status, message) {
  if (!condition) throw new Problem(status, message);
}
function field(value, name, max = 120) {
  requireThat(typeof value === 'string' && value.trim() && value.trim().length <= max, 400, 'Invalid ' + name);
  return value.trim();
}
function positive(value, name, max = 100000000000) {
  requireThat(Number.isSafeInteger(value) && value > 0 && value <= max, 400, 'Invalid ' + name);
  return value;
}
function identifier(value) {
  requireThat(typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value), 400, 'Invalid identifier');
  return value;
}
function documentUpload(input) {
  const formats = { 'application/pdf': '255044462d', 'image/png': '89504e470d0a1a0a', 'image/jpeg': 'ffd8ff' };
  const type = input?.type;
  requireThat(Object.hasOwn(formats, type) && typeof input.data === 'string' && input.data.length <= 350000, 400, 'Upload a PDF, PNG or JPEG up to 256 KiB.');
  const bytes = Buffer.from(input.data, 'base64');
  requireThat(bytes.length <= 262144 && bytes.toString('base64') === input.data && bytes.subarray(0,8).toString('hex').startsWith(formats[type]), 400, 'Invalid document.');
  return { type, data: input.data };
}
function createService(db, now) {
  const ref = (collection, id) => db.collection(collection).doc(identifier(id));
  const rows = async query => (await query.get()).docs.map(doc => ({ ...doc.data(), id: doc.id }));
  return async function dispatch(actor, method, path, body = {}) {
    const uid = identifier(actor.uid);
    const admin = actor.nexusAdmin === true;
    const customer = db.collection('nexus_customers').doc(uid);
    const entries = customer.collection('positions');
    const app = ref('nexus_applications', uid);
    const loans = db.collection('nexus_loans');
    if (path.startsWith('/admin/')) requireThat(admin, 403, 'Nexus administrator access required.');
    if (method === 'GET' && path === '/me') {
      const [application, positions, myLoans] = await Promise.all([app.get(), rows(entries), rows(loans.where('uid', '==', uid))]);
      return { admin, application: application.data() || null, positions, loans: myLoans };
    }
    if (method === 'POST' && path === '/application') {
      requireThat(actor.email_verified && actor.email, 403, 'Verify your email and sign in again before submitting.');
      const name = field(body.name, 'customer name');
      const address = field(body.address, 'address', 300);
      const document = documentUpload(body.document);
      await db.runTransaction(async tx => {
        const previous = (await tx.get(app)).data();
        requireThat(!previous || previous.status === 'HOLD', 409, 'An application already exists. Refresh its status.');
        tx.set(app, { uid, email: actor.email, name, address, status: 'PENDING', revision: (previous?.revision || 0) + 1, updatedAt: now() });
        tx.set(app.collection('documents').doc('proof'), document);
      });
      return { status: 'PENDING' };
    }
    if (method === 'GET' && path === '/admin/queue') {
      const [applications, loanRequests, partners] = await Promise.all([rows(db.collection('nexus_applications')), rows(loans), rows(db.collection('nexus_partners'))]);
      return { applications, loans: loanRequests, partners };
    }
    if (method === 'GET' && path.startsWith('/admin/document/')) {
      const doc = await ref('nexus_applications', path.slice(16)).collection('documents').doc('proof').get();
      requireThat(doc.exists, 404, 'Document unavailable.'); return doc.data();
    }
    if (method === 'POST' && path === '/admin/review') {
      const application = ref('nexus_applications', body.id);
      const status = body.status;
      requireThat(['APPROVED','HOLD','REJECTED'].includes(status), 400, 'Invalid decision.');
      const note = status === 'APPROVED' ? '' : field(body.note, 'decision reason', 300);
      await db.runTransaction(async tx => {
        const record = (await tx.get(application)).data();
        requireThat(record, 404, 'Application unavailable.');
        requireThat(record.revision === body.revision, 409, 'The application has changed. Refresh before reviewing.');
        if (record.status === status) return;
        requireThat(['PENDING','HOLD'].includes(record.status), 409, 'Application already closed.');
        if (status === 'APPROVED') {
          const suffix = createHash('sha256').update(record.uid).digest('hex').slice(0,24).toUpperCase();
          const accountId = 'P629-' + suffix;
          const accountNumber = 'NX' + suffix;
          const existing = await tx.get(db.collection('accounts').where('customerUid','==',record.uid).limit(1));
          if (existing.empty) tx.create(ref('accounts',accountId), { accountId, accountNumber, customerUid: record.uid, currency: 'INR', status: 'ACTIVE', isSynthetic: true, heldMinor: 0, postedBalanceMinor: 0, createdAt: now(), updatedAt: now() });
        }
        tx.update(application, { status, note, reviewedBy: uid, updatedAt: now() });
        tx.create(ref('mail', record.uid + '-' + record.revision + '-' + status), { to: [record.email], message: { subject: 'Nexus Bank application: ' + status, text: 'Your test account application status is ' + status + '.' + (note ? ' ' + note : '') } });
      });
      return { status };
    }
    if (method === 'POST' && path === '/admin/limits') {
      const account = ref('accounts', body.accountId);
      const perTransferMinor = positive(body.perTransferMinor, 'per-transfer limit');
      const dailyMinor = positive(body.dailyMinor, 'daily limit');
      requireThat(dailyMinor >= perTransferMinor, 400, 'Daily limit must cover a single transfer.');
      await db.runTransaction(async tx => {
        requireThat((await tx.get(account)).exists, 404, 'Nexus account ID unavailable.');
        tx.set(ref('transfer_limits',account.id), { perTransferMinor, dailyMinor, updatedBy: uid, updatedAt: now() }, {merge:true});
      });
      return { perTransferMinor, dailyMinor };
    }
    if (method === 'POST' && path === '/admin/partners') {
      const id = identifier(body.id);
      requireThat(/^P[0-9]{3}$/.test(id) && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(body.ifsc), 400, 'Invalid bank ID or IFSC.');
      await ref('nexus_partners',id).set({ name: field(body.name,'bank name'), address: field(body.address,'address',300), ifsc: body.ifsc });
      return { id };
    }
    if (method === 'DELETE' && path.startsWith('/admin/partners/')) {
      await ref('nexus_partners',path.slice(16)).delete(); return {};
    }
    if (method === 'PUT' && path.startsWith('/positions/')) {
      const position = entries.doc(identifier(path.slice(11)));
      await position.set({ name: field(body.name,'holding name'), valueMinor: positive(body.valueMinor,'holding value'), updatedAt: now() });
      return { id: position.id };
    }
    if (method === 'DELETE' && path.startsWith('/positions/')) {
      await entries.doc(identifier(path.slice(11))).delete(); return {};
    }
    if (method === 'PUT' && path.startsWith('/loans/')) {
      const loan = loans.doc(identifier(path.slice(7)));
      const amountMinor = positive(body.amountMinor,'loan amount');
      const months = positive(body.months,'term in months',360);
      const purpose = field(body.purpose,'purpose');
      await db.runTransaction(async tx => {
        const prev = (await tx.get(loan)).data();
        requireThat(!prev || (prev.uid === uid && prev.status === 'PENDING'), 409, 'Loan unavailable for editing.');
        requireThat((prev?.version || 0) === body.version,409,'Loan changed. Refresh before saving.');
        tx.set(loan,{ uid, amountMinor, months, purpose, status:'PENDING', version:(prev?.version || 0)+1, updatedAt:now() });
      });
      return { id: loan.id };
    }
    if (method === 'POST' && ['/loans/withdraw','/admin/loans'].includes(path)) {
      const loan = loans.doc(identifier(body.id));
      const status = path === '/loans/withdraw' ? 'WITHDRAWN' : body.status;
      requireThat(path === '/loans/withdraw' || ['APPROVED','REJECTED'].includes(status),400,'Invalid loan decision.');
      await db.runTransaction(async tx => {
        const data = (await tx.get(loan)).data();
        requireThat(data && (path === '/admin/loans' || data.uid === uid),404,'Loan unavailable.');
        requireThat(data.version === body.version && data.status === 'PENDING',409,'Loan has changed. Refresh before continuing.');
        tx.update(loan,{ status, updatedAt:now() });
      });
      return { status };
    }
    throw new Problem(404,'Unknown service route.');
  };
}
module.exports = { createService, Problem, documentUpload };
