// Run in the Nexus project owner's Cloud Shell with Application Default Credentials.
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
async function main() {
  const [uid, expectedEmail] = process.argv.slice(2);
  if (!uid || !expectedEmail) throw new Error('Usage: node grant-admin.cjs FIREBASE_UID EXPECTED_EMAIL');
  initializeApp({projectId:'nexus-bank-79767'});
  const auth = getAuth();
  const user = await auth.getUser(uid);
  if (user.disabled || !user.emailVerified || user.email?.toLowerCase() !== expectedEmail.toLowerCase()) {
    throw new Error('Use an enabled, email-verified Nexus staff login matching the supplied address.');
  }
  await auth.setCustomUserClaims(uid,{...user.customClaims,nexusAdmin:true});
  console.log('Granted Nexus administrator access. Sign in again for the new claim.');
}
main().catch(err => { console.error(err.message); process.exitCode=1; });
