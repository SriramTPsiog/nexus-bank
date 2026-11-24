# Enable Nexus services

GitHub Pages publishes the portal. Account applications, document review, portfolio tracking and loan applications use the nexusServices HTTPS function in the Nexus Firebase project. The shared Worker continues to handle transfers. Bank contacts maintained here are private to Nexus. Portfolio entries are customer estimates. Approval of a loan records a decision without posting funds.

## Nexus project owner · Google Cloud Shell

Use the Firebase project nexus-bank-79767. Deploying functions requires an eligible billing plan. In Firebase Authentication enable Email/Password. Add sriramtpsiog.github.io to authorized domains for email actions. Use a working mailbox for the verification link. Use only synthetic customer details and documents.

Check existing Firestore rules before enabling this API. All new collections (nexus_applications including documents, nexus_customers including positions, nexus_partners and nexus_loans) and mail require server-only access. Keep direct client writes to accounts and transfer_limits restricted. A broad client allow rule overrides any overlapping deny. With the Worker and this function as the only database clients, a default deny-all client ruleset is sufficient; their service identities use IAM. Preserve any existing authorized integrations when adjusting rules. No Firestore rules are automatically deployed by this repository.

1. In Firebase Console → Extensions, install **Trigger Email from Firestore** in the Nexus project, choose the default database and the collection **mail**, and configure an authorized SMTP sender. Account decisions enqueue one email per application revision and decision. Check the mail document's delivery state and the test inbox to verify delivery.
2. From the checkout, deploy the HTTPS function. Use a Node 22-compatible environment and a project owner or authorized deployer. Enable the required Google APIs if prompted.

   ```bash
   git clone https://github.com/SriramTPsiog/nexus-bank.git
   cd nexus-bank
   npm ci --prefix functions
   npx firebase-tools deploy --only functions:nexusServices --project nexus-bank-79767
   ```

   The HTTPS function needs public invocation for the Pages client. Its handler verifies the Nexus Firebase ID token on every service request. The function runtime identity needs Firestore read/write and Firebase Auth user-read permissions for token revocation checks.

3. Create a separate staff login in Nexus Authentication. Verify its email, copy its UID and enter its email when running the grant command. Run once per staff member from the repository root, using credentials authorized to set Firebase Auth custom claims.

   ```bash
   gcloud auth application-default login
   gcloud auth application-default set-quota-project nexus-bank-79767
   read -rp 'Nexus staff UID: ' STAFF_UID
   read -rp 'Verified staff email: ' STAFF_EMAIL
   node functions/grant-admin.cjs "$STAFF_UID" "$STAFF_EMAIL"
   ```

## Verify with two separate browser profiles

* Customer: open Nexus → Account applications, loans and portfolio → Create new login. Verify the email, sign in again and submit a mock document. Check that the application says PENDING.
* Staff: sign in to Nexus services again after granting the claim. Under Administration, download the mock proof and hold the request with a reason. Confirm the customer gets the email, resubmits and sees the new status. Approve the revision. Check the Nexus accounts collection for the customer's UID. A new account opens at ₹0. Existing account balances are preserved.
* Customer: add, edit and remove a holding. Submit a loan, change its term while pending, and withdraw it. Submit another loan and have staff review it. Confirm a second customer sees only their own holdings and loans.
* Staff: set limits using the account document ID. With a funded synthetic account, use the normal banking transfer form to verify below-limit and above-limit cases. Directory edits only affect Nexus's local partner records.
* If Firebase services have not yet been deployed, the new screens report a connection error. The live transfer and browser demo entry points remain available.

## Local verification

Run `npm ci && npm run build && npm run build:offline`. Run the integration test against a local Firestore emulator, using only the demo project. It never uses production data.

```bash
npm ci --prefix functions
npx firebase-tools emulators:exec --only firestore --project demo-nexus-bank 'node --test functions/service.test.cjs'
```
