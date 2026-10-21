# Worklio Pro – quotes, jobs, invoices and online payments

Run it (Node 18+, no `npm install` needed):

    node server.js          # http://workliopro.com

Data is stored in `data/db.json` (created with demo data on first start). Uploaded logos, app icons and photos go in `data/uploads/`. Set the app's browser-tab icon under **App Settings → App icon**.

## Pages
/business-overview, /calendar, /staff-schedules, /clients, /quotes, /jobs, /invoices, /payments, /payments/settings, /services, /expenses,
/reports, /tax-summary, /project-gallery, /notifications, /settings/company, /settings

Clients get public links (no login): `/p/quote/<token>` to approve a quote, `/pay/<token>` to pay an invoice,
and `/client-portal?c=<token>` for their portal. Copy each client's portal link from their record.

## Going live (environment variables)
Put these in the `.env` file next to `server.js` (loaded automatically at startup) or set them in the environment.
Check them in the platform console under **Settings → Integrations**, which shows what's connected and can send a test email or text.
Each business can instead send through its own email (Gmail, SendGrid or an SMTP server) under **Settings → Account Connections**, and must connect its own Twilio account there to send texts; the email settings here are used for any business that doesn't connect its own email, and always for platform emails such as sign-up alerts and owner invites.

| Feature | Variables | Without them |
|---|---|---|
| Email (Gmail) | `GMAIL_USER`, `GMAIL_APP_PASSWORD` (a Google app password); used first when set | Falls back to SendGrid |
| Email (SendGrid) | `SENDGRID_API_KEY`, `EMAIL_FROM` | Messages are logged as "simulated", not delivered |
| Text messages (Twilio) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`: only for the platform console's test text. Every business, including yours, texts clients through its own Twilio account (Settings → Account Connections) | Texts are logged as "simulated" |
| Stripe (your account) | `BILLING_STRIPE_SECRET_KEY` or `STRIPE_SECRET_KEY` (sk_test_… or sk_live_…). Turn on **Connect** in your Stripe dashboard | Sign-up checkout and invoice pay pages run demo payments that charge nobody, and businesses can't connect Stripe |
| Card payment confirmations | `STRIPE_CONNECT_WEBHOOK_SECRET`, a Connect webhook at `<platform address>/api/site/stripe-connect-webhook` | Payments are still confirmed when the client returns from Stripe |
| Self-service plans (Settings → Account and Billing) | Uses your billing key above. Add `customer.subscription.updated` and `customer.subscription.deleted` to the plan-payments webhook | Plan changes, cancelling and card updates still work; a cancelled account is paused the day after its paid period ends |
| Plan payment confirmations | `BILLING_STRIPE_WEBHOOK_SECRET` (see *Taking payment at sign-up*) | Plan payments are still confirmed when the business returns from Stripe |
| Links in messages | `BASE_URL` (your public address) | Links point at http://localhost:3000 |

## Before real customers use it
- Staff log in at `/login`. The first visit creates the owner account, so do that before the app is reachable by others.
  Client pages (`/p/quote/…`, `/pay/…`, `/client-portal?c=…`) stay public. Forgot-password emails need email set up.
  Invite team members from Manage Team. Access levels: Technician (view jobs, clients and the schedule; no prices),
  Manager (jobs, quotes, invoices and the Money section), Admin (everything). The server enforces these.
  Locked out with no email? Stop the server and run `node server.js --reset-password you@example.com NewPassword`.
  Locked out of the platform console? Run `node server.js --reset-platform-password you@example.com NewPassword`.
- Card payments are confirmed when the client returns from Stripe Checkout and, once the Connect webhook is set up, directly by Stripe.
- The JSON file store suits a small business; move to a real database if volume grows.

## Selling it to other businesses (accounts, plans and features)
One server hosts many businesses. Each **account** has its own data (`data/tenants/<id>/`), uploads, logins and web address.
Your original business is the default account and keeps using `data/db.json` and `data/uploads/`.

**Alpha** (the platform console) at `/alpha` (on `PLATFORM_DOMAIN` once it's set; on any address while developing). The first visit creates
your platform owner login; that login is separate from any account's logins.
- **Accounts:** create an account (the owner gets an emailed link to choose a password), change its plan, pause it, rename its address,
  approve or remove its custom domains, get a new owner invite/reset link, or delete it (a copy is kept in `data/deleted/`).
- **Plans & features:** a grid of plans × features. Tick what each plan includes, set the name, price, description and the number of
  team logins (0 = unlimited). Starts with Core, Advanced and Expert; add or remove plans as you like. Changes apply as soon as you save.
- **Settings:** product name, contact email, whether businesses can sign themselves up on the pricing page (`/pricing`), and
  **Integrations**: the status of email, text messages, AI and Stripe, webhook addresses to copy, test email/text, and your platform fee on card payments.
- **Reset to demo data** for an account is under Accounts → Manage (logins and Stripe connection are kept).

Locked features disappear from the account's menus and are refused by the server. Lists such as expenses come back empty, so pages still load.
Each account's **App Settings** shows its plan, web address, custom domains, branding and number prefixes. Server setup isn't shown there.
With Online card payments, a business clicks **Connect with Stripe**, sets up its own Stripe account on Stripe's pages (Stripe Connect, Standard
accounts), and comes back connected: clients' card payments go straight to that business, not to you. If you set a platform fee, Stripe sends
that percentage of each payment to your account. Email, text messages and AI use your `.env` keys for every account.
Your own (default) account can connect Stripe the same way, or keep using `STRIPE_SECRET_KEY` directly. Businesses that pasted Stripe API keys
before Connect existed keep working until they switch or remove them.

### Web addresses
| Setting | What it does |
|---|---|
| `PLATFORM_DOMAIN` | e.g. `yourapp.com`. Accounts open at `<address>.yourapp.com`; `yourapp.com` shows the guest home page (features), `/pricing` and `/alpha`. Unset (developing): the home page is at `/home`; this server answers as your own account on every address, and other accounts open at `<address>.localhost:<port>` |
| `BASE_URL` | `https://yourapp.com` (makes links and cookies use https) |
| `SERVER_IP` | optional: your server's public IP, shown to customers who connect a root domain with an A record |

**Custom domains:** on a plan with *Custom domain*, the owner adds e.g. `app.theirbusiness.com` under App Settings → Web address and creates a
CNAME to `<address>.yourapp.com`. **Check now** verifies the DNS, and the domain starts working and becomes the address used in links.
You can also approve one by hand in the console. A custom domain only works while the account's plan includes Custom domain.

**Help center** at `help.<PLATFORM_DOMAIN>` (e.g. `https://help.workliopro.com`; `help.localhost:<port>` while developing): public
articles grouped by topic, search, "Was this article helpful?" votes, and a contact form whose messages join the console's Contact
requests. Edit articles, topics and the home page in the console's **Help Center** tab, which also shows each article's yes/no
counts and what people said was missing (all saved in `platform.json`). The first run starts from `lib/help-content.js`;
`{product}` in articles becomes the product name. The app's help panel links to it with **Visit Help Center**.
`help` is a reserved address, so no account can take it.

**DNS + HTTPS:** point `yourapp.com` and `*.yourapp.com` at the server (the wildcard also covers `help.yourapp.com`). A wildcard certificate covers the subdomains; for custom domains
use a proxy that gets certificates on demand. Caddy example:

    {
      on_demand_tls {
        ask http://localhost:4000/api/site/domain-allowed
      }
    }
    https:// {
      tls {
        on_demand
      }
      reverse_proxy localhost:4000
    }

`/api/site/domain-allowed?domain=…` answers 200 only for addresses this server hosts, so certificates are never issued for strangers' domains.

### Taking payment at sign-up
When sign-ups are on, a business picks a plan on `/pricing` and creates its account. If the plan has a price, it goes on to
**checkout** (`/checkout/<link>`): a summary of the account and plan, where it can still switch plans, then **Pay** opens Stripe Checkout
for a monthly subscription (yearly if the price says `/year`). The account stays **Awaiting payment** (nobody can log in) until the payment
goes through; then the owner lands on their login page. Plans with no `$` amount (e.g. “Free” or “Contact us”) start right away.

| Setting | What it does |
|---|---|
| `BILLING_STRIPE_SECRET_KEY` | Your Stripe key for plan subscriptions. Falls back to `STRIPE_SECRET_KEY`. Without either, checkout is a demo that starts the account without charging |
| `STRIPE_PUBLISHABLE_KEY` | Optional: your publishable key (pk_…), needed only if businesses set up card payments inside the app (Alpha → Settings → Integrations → Stripe). It can also be saved there |
| `BILLING_STRIPE_WEBHOOK_SECRET` | Optional. Add a webhook at `<platform address>/api/site/stripe-webhook` for `checkout.session.completed`, `customer.subscription.updated` and `customer.subscription.deleted`. Confirms payments when someone closes the tab, and pauses an account whose subscription is cancelled or unpaid (and resumes it once it's paid up) |

The price charged comes from the plan's price text (`$29/month`, `$290/year`). In the console, accounts show *Awaiting payment*, *Paid by card*
or *Demo checkout*. **Resume account** lets one in without paying. Customers manage or cancel subscriptions in your Stripe dashboard (or
turn on Stripe's customer portal).
Locked out of an account: `node server.js --reset-password you@example.com NewPassword <account-address>`.
