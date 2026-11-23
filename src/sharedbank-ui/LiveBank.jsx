import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, IconButton, TextField } from '@mui/material';
import { Eye, EyeOff, Globe2, KeyRound, Layers3 } from 'lucide-react';
import Workspace, { Brand, switchUrl } from './Workspace';
import { configuredEndpoint, liveApi, parseEndpoint, readStorage, saveStorage } from './live-api';

function SignedIn({ bank, base, session, logout, connection }) {
  const prefix = '/banks/' + bank.id;
  const [data, setData] = useState(null);
  const [updated, setUpdated] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [directory, setDirectory] = useState([]);
  const [directoryError, setDirectoryError] = useState('');
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [directoryAttempt, setDirectoryAttempt] = useState(0);
  const request = useRef(null);
  const lifetime = useRef(null);
  const pending = useRef(new Map());
  const refresh = useCallback(() => {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return;
    if (request.current) return request.current;
    setRefreshing(true);
    request.current = liveApi(base, prefix + '/dashboard', { token: session.token, signal })
      .then(value => {
        if (signal.aborted) return;
        if (!Array.isArray(value.accounts) || !Array.isArray(value.transfers)) throw new Error('Could not read the account dashboard.');
        setData(value); setUpdated(new Date().toISOString()); setError('');
      }).catch(failure => {
        if (signal.aborted) return;
        if (failure.status === 401) logout(failure.message);
        else setError(failure.message);
      }).finally(() => { if (!signal.aborted) { setRefreshing(false); request.current = null; } });
    return request.current;
  }, [base, prefix, session.token, logout]);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    refresh();
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, 60_000);
    return () => { controller.abort(); clearInterval(timer); request.current = null; };
  }, [refresh]);
  useEffect(() => {
    const controller = new AbortController();
    setLoadingDirectory(true); setDirectoryError('');
    liveApi(base, '/directory/banks', { signal: controller.signal })
      .then(value => { if (!Array.isArray(value.banks)) throw new Error('Could not read the bank directory.');
        if (!controller.signal.aborted) setDirectory(value.banks); })
      .catch(failure => { if (!controller.signal.aborted) setDirectoryError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoadingDirectory(false); });
    return () => controller.abort();
  }, [base, directoryAttempt]);

  async function send(transfer) {
    const signal = lifetime.current.signal;
    const raw = JSON.stringify([bank.id, base, session.uid, transfer]);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)));
    const keyName = 'x42-pending-' + Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
    const key = pending.current.get(keyName) || readStorage(sessionStorage, keyName, null) || crypto.randomUUID();
    pending.current.set(keyName, key); saveStorage(sessionStorage, keyName, key);
    let row;
    try { row = await liveApi(base, prefix + '/transfers', { token: session.token, data: transfer, key, signal }); }
    catch (failure) {
      if (failure.status === 401 && !signal.aborted) logout(failure.message);
      throw failure;
    }
    if (!row.transferId || !row.status) throw new Error('The service returned an incomplete response. Check activity before retrying with the same details.');
    pending.current.delete(keyName); saveStorage(sessionStorage, keyName, null);
    if (!signal.aborted) {
      if (request.current) await request.current;
      refresh();
    }
    if (signal.aborted) throw new Error('Your session has ended.');
    return { ...row, direction: 'DEBIT' };
  }
  const routeBank = { ...bank, ifsc: data?.bank?.ifsc || bank.ifsc };
  const known = directory.length ? directory : [{ bankId: bank.id, bankName: bank.name }];
  return <Workspace bank={routeBank} accounts={data?.accounts || []} transfers={data?.transfers || []} email={session.email}
    directory={known} directoryError={directoryError} loadingDirectory={loadingDirectory} retryDirectory={() => setDirectoryAttempt(n => n + 1)}
    ready={Boolean(data)} refresh={refresh} refreshing={refreshing} updated={updated} error={error} send={send} leave={() => logout('')} connection={connection}/>;
}

export default function LiveBank({ bank, openDemo }) {
  const urlKey = 'x42-cloudflare-worker-url';
  const [base, setBase] = useState(() => configuredEndpoint || readStorage(localStorage, urlKey, ''));
  const [url, setUrl] = useState(base);
  const [editing, setEditing] = useState(!base);
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const logout = useCallback(message => { setSession(null); setShow(false); setPassword(''); setError(message); }, []);
  async function signIn(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const value = await liveApi(base, '/banks/' + bank.id + '/sign-in', { data: { email: email.trim(), password } });
      if (!value.token || !value.uid) throw new Error('The service returned an incomplete sign-in response.');
      setSession(value);
    }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); setPassword(''); }
  }
  function connect(event) {
    event.preventDefault();
    try {
      const endpoint = parseEndpoint(url); saveStorage(localStorage, urlKey, endpoint); setBase(endpoint); setError(''); setEditing(false);
    } catch (failure) { setError(failure.message); }
  }
  const connection = !configuredEndpoint && <Button onClick={() => { logout(''); setUrl(base); setEditing(true); }}>Worker connection</Button>;
  if (session) return <SignedIn bank={bank} session={session} base={base} logout={logout} connection={connection}/>;
  return <div className="entry"><header className="masthead"><div className="mast-inner"><Brand bank={bank}/>
    <a className="switch-anchor" href={switchUrl}><Globe2 size={17}/>SharedBank switch</a></div></header>
    <main className="entry-main"><div className="entry-grid">
      <section className="art-panel" aria-label={bank.name + ' routing details'}>
        <div className="art-lines" aria-hidden="true"/><div className="art-label"><span className="network-glyph" aria-hidden="true"/>SharedBank network</div>
        <div className="book-stack"><div className="book-under" aria-hidden="true"/><div className="passbook">
          <div className="passbook-lines" aria-hidden="true"/><div className="book-head"><span className="book-mark" aria-hidden="true">{bank.name.trim().charAt(0).toUpperCase()}</span><span>Account services</span></div>
          <div className="book-title" data-long={bank.name.length > 16}>{bank.name}</div><div className="book-bottom"><span>PERSONAL BANKING</span><span>{bank.id}</span></div>
        </div></div>
        <div className="art-foot"><div><span>Bank identifier</span><strong>{bank.id}</strong></div><div><span>IFSC</span><strong>{bank.ifsc}</strong></div></div>
      </section>
      <section className="entry-form"><div className="form-symbol"><KeyRound size={24}/></div>
        <h1>{editing ? 'Connect your Worker' : 'Welcome back.'}</h1>
        <p>{editing ? 'Enter the Cloudflare Worker URL for this bank.' : 'Sign in to your ' + bank.name + ' account.'}</p>
        {error && <Alert severity="error">{error}</Alert>}
        {editing ? <form className="fields" onSubmit={connect}><TextField label="Cloudflare Worker URL" required value={url} onChange={e => setUrl(e.target.value)}/>
          <Button type="submit" variant="contained">Save connection</Button></form>
          : <form className="fields" onSubmit={signIn}><TextField label="Email address" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)}/>
            <TextField label="Password" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}
              slotProps={{ input: { endAdornment: <IconButton aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(v => !v)}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</IconButton> } }}/>
            <Button type="submit" variant="contained" size="large" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          </form>}
        {openDemo && <div className="demo-choice"><Button startIcon={<Layers3 size={17}/>} color="inherit" onClick={openDemo} disabled={busy}>Explore browser demo</Button>
          <small>Try transfers with local sample accounts.</small></div>}{!editing && connection}
      </section></div>
      <div className="entry-foot"><span>{bank.name} · Personal banking</span><span>SharedBank test network</span></div>
    </main></div>;
}
