# 738 Afties

A simple point-of-sale app for parties. Track bottles, drinks and hookah sales, see who sold what, count the cash at the end of the night, and keep stock up to date. Built for iPhone (add it to your Home Screen) and for a small team of 4.

**Stack:** Next.js 16 · Clerk (sign in) · Supabase (database) · Vercel (hosting)

## What's inside

| Screen | What it does |
| --- | --- |
| **Sell** | Tap items to add them (tap − on a tile to remove one). Tap **Review order**, change a price if needed, then pick **Pay now** (Cash / Cash App / Zelle / Other) or **Tab · pay later**. Mis-tap? Hit **Undo**. |
| **Tabs** | Everyone who still owes. Tap a person to see their whole tab with the time each item was added. From there: **+ Add items**, remove one item (×), **Collect**, or void. Tabs from past nights show in red. |
| **Stats** | Tonight, last night, 7 days, 30 days. Total sales, paid vs unpaid, discounts given, estimated profit, sales by staff, top items, low stock. |
| **Audit** | Pick any day. Each person's paid and unpaid sales, money collected (Cash / Cash App / Zelle / Other), every sale with time. Count the cash drawer and close the day. Void a wrong sale (stock goes back). |
| **Inventory** | Add / edit items, price, cost and photo. Restock when a delivery comes in. Admin can set a shelf count. Low stock warnings. |
| **Staff** | Everyone's sales tonight and this week. Admin adds people by email, makes admins, or turns people off. |

**Cash drawer:** the expected cash only counts money actually collected that day. A tab opened Friday and paid Saturday counts in Saturday's drawer.

**Party nights run past midnight.** A sale at 2 AM or 10 AM counts for the night before. The new day starts at 11 AM (change with `NEXT_PUBLIC_BUSINESS_DAY_START_HOUR`).

**Who can do what**

- **Admin:** everything.
- **Staff:** sell, restock, close the day, void their own sales (only while the day is open).
- The **first person to sign in becomes admin.** After that, only emails added on the Staff page can get in.

## Setup (about 15 minutes)

### 1. Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project (or use one you have).
2. Open **SQL Editor → New query**, paste everything in `supabase/schema.sql`, and click **Run**.
3. Run `supabase/738-menu.sql` to add the 738 menu.
   - Already set up? Run the newest `supabase/update.sql` after each app update. It is safe to run again.
4. Go to **Project Settings → API Keys** and copy the **Secret key** (`sb_secret_...`). Also copy your **Project URL**.

### 2. Clerk

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) and create an application. Turn on **Email** sign in (email code works best on iPhone).
2. Copy the **Publishable key** and **Secret key** from **API Keys**.

### 3. Run it on your computer (optional)

```bash
cp .env.example .env.local   # then fill in the keys
npm install
npm run dev
```

Open http://localhost:3000 and sign in. You are now the admin.

### 4. Put it on Vercel

1. Push this folder to a GitHub repo.
2. In [vercel.com](https://vercel.com) click **Add New → Project** and import the repo.
3. Under **Environment Variables**, add every line from `.env.example` with your real values.
4. Click **Deploy**.
5. In Clerk, switch to a **Production** instance when you are ready, and add your Vercel domain.

### 5. Add it to the iPhone Home Screen

1. Open your Vercel link in **Safari**.
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Open it from the Home Screen. It runs full screen like a real app.

### 6. Add your team

1. On the **Staff** tab, add each person's name and email.
2. They open the link, tap **Sign up**, and use that same email.
3. Their sales show up under their name.

## Files

```
app/(app)/page.tsx          Sell screen
app/(app)/dashboard/        Dashboard
app/(app)/audit/            Day audit
app/(app)/inventory/        Inventory
app/(app)/staff/            Staff
app/actions.ts              All saves (sales, voids, stock, staff, close day)
lib/auth.ts                 Clerk user -> staff member, roles
lib/data.ts                 Database reads and report math
supabase/schema.sql         Tables + sale / void / stock functions
proxy.ts                    Clerk sign-in protection
```

## Security notes

- The Supabase secret key is only used on the server. It never goes to the phone.
- Row Level Security is on with no public policies, so the public anon key can't read anything.
- Prices are read from the database when a sale is saved, so nobody can change a price from the phone.
