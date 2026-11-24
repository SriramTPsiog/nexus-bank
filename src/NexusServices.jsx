import { useEffect, useState } from 'react';
import { Alert, Button, Paper, Stack, TextField } from '@mui/material';
import { callService, identity, paise, upload } from './nexus-services';

const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(n/100);
function Field({label,name,type='text',value='',...rest}) {
  return <TextField label={label} name={name} type={type} defaultValue={value} required size="small" {...rest}/>;
}
function Form({children,run,submit,label}) {
  const [busy,setBusy] = useState(false);
  return <Stack component="form" spacing={1.5} onSubmit={async e => {
    e.preventDefault(); if (busy) return;
    const form = e.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    setBusy(true);
    try { if (await run(() => submit(fields))) form.reset(); } finally { setBusy(false); }
  }}>{children}<Button disabled={busy} type="submit" variant="contained">{busy ? 'Please wait…' : label}</Button></Stack>;
}
function Card({title,children}) {
  return <Paper variant="outlined" sx={{p:3,mb:2}}><h2>{title}</h2>{children}</Paper>;
}
function Loan({row,admin,write,run}) {
  const [edit,setEdit] = useState(false);
  return <article><strong>{row.purpose}</strong> · {money(row.amountMinor)} · {row.months} months · {row.status}
    {row.status === 'PENDING' && (admin ? <div>{['APPROVED','REJECTED'].map(status =>
      <Button key={status} onClick={() => run(() => write('/admin/loans','POST',{id:row.id,version:row.version,status}))}>{status === 'APPROVED' ? 'Approve loan' : 'Reject loan'}</Button>)}</div> :
      <div><Button onClick={() => setEdit(!edit)}>Edit</Button>
        <Button onClick={() => run(() => write('/loans/withdraw','POST',{id:row.id,version:row.version}))}>Withdraw</Button></div>)}
    {edit && row.status === 'PENDING' && <LoanForm row={row} run={run} write={write} done={() => setEdit(false)}/>}</article>;
}
function LoanForm({row,run,write,done}) {
  const [id,setId] = useState(() => row?.id || crypto.randomUUID());
  return <Form label={row ? 'Save loan changes' : 'Apply for loan'} run={run} submit={async f => {
    await write('/loans/'+id,'PUT',{purpose:f.purpose,amountMinor:paise(f.amount),months:Number(f.months),version:row?.version || 0});
    if (done) done(); else setId(crypto.randomUUID());
  }}><Field name="purpose" label="Loan purpose" value={row?.purpose}/><Field name="amount" label="Amount (₹)" value={row && row.amountMinor/100}/>
    <Field name="months" label="Term in months" type="number" value={row?.months} slotProps={{htmlInput:{min:1,max:360}}}/></Form>;
}
function Holding({row,run,write}) {
  const [edit,setEdit] = useState(false);
  return <article>{row.name} · {money(row.valueMinor)} <Button onClick={() => setEdit(!edit)}>Edit</Button>
    <Button onClick={() => run(() => write('/positions/'+row.id,'DELETE'))}>Remove</Button>
    {edit && <PositionForm row={row} run={run} write={write} done={() => setEdit(false)}/>}</article>;
}
function PositionForm({row,run,write,done}) {
  const [id,setId] = useState(() => row?.id || crypto.randomUUID());
  return <Form run={run} label={row ? 'Save holding' : 'Add holding'} submit={async f => {
    await write('/positions/'+id,'PUT',{name:f.name,valueMinor:paise(f.value)});
    if (done) done(); else setId(crypto.randomUUID());
  }}><Field label="Holding name" name="name" value={row?.name}/><Field label="Estimated value (₹)" name="value" value={row && row.valueMinor/100}/></Form>;
}
function Review({row,run,write,token}) {
  const review = (status,note='') => write('/admin/review','POST',{id:row.id,revision:row.revision,status,note});
  return <article><h3>{row.name}</h3><p>{row.email} · {row.address} · {row.status}</p>
    <Button onClick={() => run(async () => {
      const file = await callService(token,'/admin/document/'+row.id);
      const bytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
      const a = document.createElement('a'); a.href=url; a.download='mock-proof.'+({'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'}[file.type]); a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
    })}>Download submitted document</Button>
    {['PENDING','HOLD'].includes(row.status) && <><Button onClick={() => run(() => review('APPROVED'))}>Approve account</Button>
      <Form run={run} label="Send decision" submit={f => review(f.status,f.note)}><label>Decision <select name="status"><option value="HOLD">Hold for corrections</option><option value="REJECTED">Reject</option></select></label><Field name="note" label="Reason for customer"/></Form></>}</article>;
}
function Admin({queue,run,write,token}) {
  return <><Card title="Account applications">{queue.applications.length === 0 && 'No applications.'}{queue.applications.map(row => <Review key={row.id} {...{row,run,write,token}}/>)}</Card>
    <Card title="Loan decisions">{queue.loans.length === 0 && 'No loans.'}{queue.loans.map(row => <Loan key={row.id} admin {...{row,run,write}}/>)}</Card>
    <Card title="Account transfer limits"><Form run={run} label="Save limits" submit={f => write('/admin/limits','POST',{accountId:f.id,perTransferMinor:paise(f.single),dailyMinor:paise(f.daily)})}>
      <Field name="id" label="Nexus account ID"/><Field name="single" label="Per transfer (₹)"/><Field name="daily" label="Daily total (₹)"/></Form></Card>
    <Card title="Partner directory"><p>Nexus keeps these contact details locally. SharedBank manages network routing.</p>
      {queue.partners.map(p => <article key={p.id}>{p.id} · {p.name} · {p.ifsc} · {p.address}<Button onClick={() => run(() => write('/admin/partners/'+p.id,'DELETE'))}>Remove</Button></article>)}
      <Form run={run} label="Add or update partner" submit={f => write('/admin/partners','POST',{...f,ifsc:f.ifsc.trim().toUpperCase()})}>
        <Field name="id" label="Partner bank ID"/><Field name="name" label="Bank name"/><Field name="ifsc" label="IFSC"/><Field name="address" label="Branch address"/></Form></Card></>;
}
export default function NexusServices({session,close}) {
  const [token,setToken] = useState(session?.token || '');
  const [signup,setSignup] = useState(false);
  const [me,setMe] = useState(null);
  const [queue,setQueue] = useState(null);
  const [tab,setTab] = useState('Account');
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const [revision,setRevision] = useState(0);
  const refresh = () => setRevision(n => n+1);
  async function run(action) {
    setError(''); setMessage('');
    try { await action(); return true; } catch (err) { setError(err.message); return false; }
  }
  useEffect(() => {
    let active=true;
    if (token) (async () => {
      const data = await callService(token,'/me');
      if (active) setMe(data);
      if (data.admin && tab === 'Administration') {
        const result = await callService(token,'/admin/queue');
        if (active) setQueue(result);
      }
    })().catch(err => { if (active) setError(err.message); });
    return () => { active=false; };
  },[token,revision,tab]);
  async function write(path,method,data) {
    await callService(token,path,method,data); setMessage('Saved to Nexus Bank.'); refresh();
  }
  const verify = () => identity('sendOobCode',{requestType:'VERIFY_EMAIL',idToken:token});
  return <main style={{maxWidth:800,margin:'auto',padding:'24px 16px'}}><Button onClick={close}>← Return to banking</Button><h1>Nexus services</h1>
    {error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success">{message}</Alert>}
    {!token ? <Card title={signup ? 'Create a customer login' : 'Sign in to Nexus services'}><Form run={run} label={signup ? 'Create login' : 'Sign in'} submit={async f => {
      const login = await identity(signup ? 'signUp':'signInWithPassword',{...f,returnSecureToken:true});
      setToken(login.idToken);
      if (signup) { await identity('sendOobCode',{requestType:'VERIFY_EMAIL',idToken:login.idToken}); setMessage('Verification email sent. Verify your address, then sign in again.'); }
    }}><Field name="email" label="Nexus email" type="email"/><Field name="password" label="Password" type="password"/></Form>
      <Button onClick={() => setSignup(!signup)}>{signup ? 'Use existing login' : 'Create new login'}</Button></Card> :
    <><Button onClick={refresh}>Refresh</Button><Button onClick={() => {setToken('');setMe(null);setQueue(null);setTab('Account');setError('');setMessage('');}}>Sign out of services</Button>
      <nav aria-label="Nexus services">{['Account','Portfolio','Loans',...(me?.admin ? ['Administration']:[])].map(item => <Button key={item} variant={tab === item?'contained':'text'} onClick={() => setTab(item)}>{item}</Button>)}</nav>
      {me && tab === 'Account' && <Card title="Account application">{me.application && <p>Status · <strong>{me.application.status}</strong> {me.application.note}</p>}
        {(!me.application || me.application.status === 'HOLD') && <><p>Use fictional details and one mock supporting document (PDF, PNG or JPEG, up to 256 KiB).</p>
          <Button onClick={() => run(async () => {await verify(); setMessage('Verify your email, then sign out of services and sign in again.');})}>Send verification email</Button>
          <Form run={run} label="Submit application" submit={async f => write('/application','POST',{name:f.name,address:f.address,document:await upload(f.proof)})}>
            <Field name="name" label="Applicant name"/><Field name="address" label="Address"/><label>Mock supporting document <input type="file" required name="proof" accept="application/pdf,image/png,image/jpeg"/></label></Form></>}</Card>}
      {me && tab === 'Portfolio' && <Card title="Portfolio"><p>Total estimated value · {money(me.positions.reduce((s,p) => s+p.valueMinor,0))}</p>
        {me.positions.map(row => <Holding key={row.id} {...{row,run,write}}/>)}<PositionForm {...{run,write}}/></Card>}
      {me && tab === 'Loans' && <Card title="Loan applications"><p>Track applications and decisions here. Approval records a decision only.</p>
        {me.loans.map(row => <Loan key={row.id} {...{row,run,write}}/>)}<LoanForm {...{run,write}}/></Card>}
      {me?.admin && tab === 'Administration' && queue && <Admin {...{run,write,token,queue}}/>}</>}
  </main>;
}
