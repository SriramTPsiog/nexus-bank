const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { createService, Problem } = require('./service.cjs');
initializeApp();
const dispatch = createService(getFirestore(), () => FieldValue.serverTimestamp());
exports.nexusServices = onRequest({ region:'asia-south1', cors:['https://sriramtpsiog.github.io'], maxInstances:10 }, async (req,res) => {
  res.set('Cache-Control','private, no-store');
  let actor;
  try {
    const token = /^Bearer ([^ ]+)$/.exec(req.get('Authorization') || '');
    if (!token) throw new Error();
    actor = await getAuth().verifyIdToken(token[1], true);
  } catch { return res.status(401).json({ error:'Please sign in to Nexus again.' }); }
  try { res.json(await dispatch(actor, req.method, req.path, req.body)); }
  catch (err) {
    if (!(err instanceof Problem)) console.error('Nexus service error',err.code || err.name);
    res.status(err instanceof Problem ? err.status : 503).json({error:err instanceof Problem ? err.message : 'Nexus Firebase is unavailable. Refresh to check the result.'});
  }
});
