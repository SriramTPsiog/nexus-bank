# Bank portal

React and Material UI. The portal uses synthetic accounts and a demo ledger saved in the current browser. Open both bank pages under the same origin to see both sides of an interbank demo transfer.

Run locally with Node.js 22 using `npm ci` and `npm run dev`. Build with `npm run build`.

To publish, push the contents of this folder to the root of its GitHub repository. Choose **Settings → Pages → GitHub Actions** as the source and run the **Deploy bank page** workflow. The portal links back to the existing SharedBank switch dashboard.
