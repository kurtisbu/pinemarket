# Support Ticket System

Build an in-app ticketing system so users can submit support requests from a footer link, with email notifications to `capitalcodersllc@gmail.com` and a full admin reply interface.

## What we'll build

### 1. Database
New tables:
- **`support_tickets`** — subject, message, category (Billing / TradingView Access / Bug Report / Account / Other), status (open / in_progress / waiting_user / resolved / closed), priority, user_id (nullable so guests can submit), email, related_purchase_id, created_at, updated_at, last_message_at.
- **`support_ticket_messages`** — ticket_id, author_id, author_type (user / admin), body, is_internal_note, created_at, attachments[].

RLS:
- Users can view/create their own tickets and messages.
- Admins (`has_role(... 'admin')`) can view and reply to all.
- Guests can insert a ticket if they provide an email.

### 2. Email infrastructure (Lovable Emails)
- Set up a sender domain (notify.pinemarket.io) via the email setup dialog.
- Two transactional emails:
  - **New ticket → admin** (`capitalcodersllc@gmail.com`) with ticket details + deep link.
  - **Reply notification → user** when an admin responds.
- Uses the queued `send-transactional-email` function.

### 3. User-facing pages
- **`/support`** — list of the current user's tickets + "New ticket" button. Guests see only the new-ticket form.
- **`/support/new`** — form: subject, category, message, (optional) related purchase dropdown. If logged out, also email + name fields.
- **`/support/:ticketId`** — thread view: messages chronologically, reply box, status badge, "Mark resolved" button.

### 4. Admin dashboard
- New tab in `/admin` → **Support Tickets**: filterable list (status, category, priority), open ticket → same thread view with admin reply box, status changer, internal-notes toggle, assign-priority control.

### 5. Entry points
- Add **Contact Support** link to `Footer.tsx` under a new "Support" column (or in the Account column).
- Auto-link from purchase rows in `/my-purchases` ("Need help with this order?") that pre-fills the related purchase.

### 6. Polish
- Validation with zod (subject 1–200, message 1–5000, email format).
- Empty state: "No tickets yet — questions are welcome."
- Toast confirmations on submit/reply.
- SEO: `<title>Support – PineMarket</title>`, single H1.

## Technical notes

- All ticket/message writes go through RLS; admin replies use the existing `has_role` pattern.
- Email send is non-blocking: insert ticket → call `send-transactional-email` edge function → return success even if email queueing is slow (queue handles retries).
- Reuse existing shadcn components (Card, Badge, Textarea, Select, Tabs) and design tokens — no new colors.
- No third-party chat widget; entirely self-hosted to keep data in your DB.

## Out of scope (can add later)

- File attachments on tickets (would need a `support-attachments` storage bucket).
- SLA timers / auto-close after N days.
- Canned responses / macros.
- Public knowledge-base / FAQ pages.
