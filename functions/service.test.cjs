const test = require('node:test');
const assert = require('node:assert/strict');
const { createService, documentUpload } = require('./service.cjs');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { randomUUID } = require('node:crypto');

test('review and limit routes require a server-issued admin claim', async () => {
  const stub = { collection: () => ({ doc: () => stub, collection: () => stub }) };
  const service = createService(stub, Date.now);
  for (const path of ['/admin/review','/admin/limits','/admin/queue','/admin/document/any']) {
    await assert.rejects(service({uid:'customer'},'POST',path,{nexusAdmin:true}), {status:403});
  }
});
test('upload rejects mislabeled documents', () => {
  assert.throws(() => documentUpload({type:'application/pdf',data:'dGVzdA=='}), {status:400});
});
test('application, email, account, limits, loan lifecycle and portfolio isolation', {skip:!process.env.FIRESTORE_EMULATOR_HOST}, async t => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST,/^(localhost|127\.0\.0\.1):\d+$/);
  const firebase = initializeApp({projectId:'demo-nexus-bank'},randomUUID());
  t.after(() => deleteApp(firebase));
  const db = getFirestore(firebase);
  const service = createService(db,() => FieldValue.serverTimestamp());
  const customer = {uid:randomUUID(), email:'applicant@example.test',email_verified:true};
  const other = {uid:randomUUID()};
  const admin = {uid:'officer',nexusAdmin:true};
  const application = {name:'Sample Applicant',address:'Synthetic address',document:{type:'application/pdf',data:Buffer.from('%PDF-1.4 synthetic').toString('base64')}};
  const decision = {id:customer.uid,revision:1,status:'HOLD',note:'Replace proof'};
  const post = (user,path,input) => service(user,'POST',path,input);
  await assert.rejects(post({...customer,email_verified:false},'/application',application),{status:403});
  await post(customer,'/application',application);
  await post(admin,'/admin/review',decision);
  await post(customer,'/application',application);
  await assert.rejects(post(admin,'/admin/review',decision),{status:409});
  decision.revision=2; decision.status='APPROVED';
  await Promise.all([post(admin,'/admin/review',decision),post(admin,'/admin/review',decision)]);
  const accounts = await db.collection('accounts').where('customerUid','==',customer.uid).get();
  assert.equal(accounts.size,1);
  const account = accounts.docs[0];
  assert.equal(account.data().postedBalanceMinor,0);
  assert.ok((await db.doc('mail/'+customer.uid+'-2-APPROVED').get()).exists);
  assert.equal((await service(admin,'GET','/admin/document/'+customer.uid)).type,'application/pdf');
  await post(admin,'/admin/limits',{accountId:account.id,perTransferMinor:10000,dailyMinor:30000});
  assert.equal((await db.doc('transfer_limits/'+account.id).get()).data().dailyMinor,30000);
  await post(admin,'/admin/partners',{id:'P648',ifsc:'SOWN0M9C5JQ',name:'Lyra',address:'Sample'});
  await service(admin,'DELETE','/admin/partners/P648');
  assert.equal((await db.doc('nexus_partners/P648').get()).exists,false);
  const position = '/positions/sample';
  await service(customer,'PUT',position,{name:'Savings',valueMinor:40000});
  await service(other,'DELETE',position);
  assert.equal((await service(customer,'GET','/me')).positions[0].valueMinor,40000);
  await service(customer,'DELETE',position);
  const loanId = randomUUID(), path='/loans/'+loanId;
  const loan = {purpose:'Study',months:12,amountMinor:100000,version:0};
  await service(customer,'PUT',path,loan);
  await assert.rejects(post(other,'/loans/withdraw',{id:loanId,version:1}),{status:404});
  await service(customer,'PUT',path,{...loan,version:1,months:18});
  await assert.rejects(post(admin,'/admin/loans',{id:loanId,version:1,status:'APPROVED'}),{status:409});
  await post(admin,'/admin/loans',{id:loanId,version:2,status:'APPROVED'});
  assert.equal((await service(customer,'GET','/me')).loans[0].status,'APPROVED');
  await assert.rejects(post(customer,'/loans/withdraw',{id:loanId,version:2}),{status:409});
});
