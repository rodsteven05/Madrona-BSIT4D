# Campus Store Touchscreen POS

A touchscreen-oriented self-service Point of Sale kiosk built with React, Vite, and TypeScript. It supports product selection, quantity controls, order review, Cash/QR/Card payment simulations, transaction confirmation, digital receipts, and complete new-transaction reset behavior.

## Requirements

- Node.js 20 or newer
- npm
- A Supabase project is optional; the application uses local browser storage when Supabase is not configured.

## Run locally

```bash
npm install
npm run dev
```

Open the local address shown by Vite. The application starts in **Local demo mode** and can complete every required flow without a backend.

## Verification commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Storage choice

The current cart is kept in React state so unfinished or rejected payments never create transaction records. Completed transactions use a repository abstraction:

- Without environment variables, successful transactions are stored in `localStorage` under `campus-pos-transactions`.
- With Supabase configured, successful transactions and item snapshots are inserted atomically through the `create_pos_transaction` database function.

Money is represented as integer centavos to avoid floating-point calculation errors. Receipt lines snapshot product names and prices, preventing later catalog changes from altering completed receipts.

## Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and apply both files in `supabase/migrations` in filename order. The second migration validates catalog prices and makes transaction retries idempotent.
3. Copy `.env.example` to `.env.local`.
4. Add the project URL and public publishable key (legacy anon keys are also supported):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key
```

5. Restart `npm run dev`. The menu will load active products from Supabase.

The migrations create products, transactions, immutable transaction items, validation constraints, Row Level Security, seed products, and an atomic transaction function. Never place the Supabase service-role key in this frontend project.

## Instructor test path

1. Add Brewed Coffee twice, Club Sandwich once, and Soft Drink once. Total: ₱175.00.
2. Increase Coffee once. Total: ₱220.00. Decrease it once. Total: ₱175.00.
3. Remove Soft Drink. Total: ₱140.00.
4. Review the order, return to the menu, and verify the cart remains intact.
5. Select Cash and enter ₱100.00. The application rejects the payment.
6. Enter ₱200.00. Payment succeeds with ₱60.00 change.
7. View the receipt and start a new transaction. The new cart and payment state are empty.
8. Repeat with QR Payment and Credit/Debit Card. Both use exact payment and ₱0.00 change.

## Project structure

- `src/data` — built-in product catalog
- `src/state` — reducer-driven kiosk state
- `src/utils` — currency, totals, validation, and references
- `src/repositories` — localStorage/Supabase persistence
- `src/components` — reusable order components
- `supabase/migrations` — database schema, policies, seed data, and RPC

## Group contributions

| Member | Name | GitHub username | Contribution | Feature branch | Commit SHA(s) | PR URL | Reviewer / merge status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M1 | | | Initial project configuration and core POS system | | | | |
| M2 | | | Supabase integration, checkout validation, persistence, and logic cleanup | | | | |
| M3 | | | UI/UX enhancement, touchscreen accessibility, navigation, and interface verification | | | | |

Names and evidence fields are intentionally blank until actual member and GitHub records are supplied. Record the final integration commit SHA used for the instructor demonstration. Three members share the work; the checklist's requirement for seven genuine development stages still applies to the group history.

## Git and group workflow

1. Develop each member's assigned work on an identifiable feature branch.
2. Commit meaningful changes with descriptive messages and push to the shared repository.
3. Open a pull request targeting the integration branch.
4. Have another member review it and address requested changes before merge.
5. Fill the three-member contribution register with actual commit, PR, review, and merge evidence.

## AI development evidence

For each real AI-assisted task, record:

| Member | Date | Goal and prompt summary | AI suggestion | Evaluation or changes made | Related commit/PR |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

Include examples of generation, debugging, testing, and refactoring. Members should explain why suggestions were accepted, modified, or rejected and connect them to actual code and Git evidence.


## Database behavior and verification

Configured deployments load active products from Supabase; a failed catalog request does not silently substitute demo prices. Without configuration, the built-in catalog and local storage remain available. Public access is restricted by database grants and RLS. Transaction tables cannot be read or changed directly by anonymous clients; completed checkouts use the atomic RPC. This is a simulated-payment kiosk, not a payment gateway.

The database checks active products, catalog names/prices, positive quantities, subtotals, totals, cash change, and exact QR/card payment. Repeating an identical transaction ID returns the existing transaction; conflicting reuse is rejected. The frontend retains the ID on a failed save so a lost response can be retried without creating a second record.

After applying migrations, run `supabase/tests/checkout.sql` in the SQL editor. It rolls back its sample records. Then complete Cash, QR, and Card checkouts in the application. Verify one transaction row and matching item rows per receipt in the dashboard. Live database verification requires a configured project.

The current AI-assisted implementation record is in `docs/ai-development-evidence.md`.

## Touchscreen interface

The kiosk uses large product cards, category tabs, 48-pixel or larger touch controls, readable totals, and visible checkout progress. The cart supports quantity changes and removal. Back controls preserve the order. Cash shortcuts reduce typing; the QR placeholder is clearly labeled as a simulation. Catalog loading failures offer a retry control, payment errors stay beside the payment controls, and screen changes move keyboard focus to the new heading. Responsive layouts retain progress labels on phones; reduced-motion preferences are respected.

## Replacing product illustrations with photos

Place your photos in `public/images/products/` using the filenames listed in `public/images/products/README.md`. The app uses each photo automatically and keeps illustrations as fallbacks. Update `imageUrl` in `src/data/products.ts` for other filenames or extensions. Commit the photos and redeploy to update the hosted kiosk.
