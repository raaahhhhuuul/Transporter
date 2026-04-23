# Supabase Setup

1. Open Supabase SQL Editor and run `supabase/schema.sql`.
2. In Supabase Auth, create admin user:
   - Email: `transporter@admin.com`
   - Password: `admin123`
3. Confirm `.env.local` has:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Restart dev server.

## Auth Behavior Implemented

- Student signup: must end with `@srmist.edu.in`.
- Driver signup: any email works.
- Signup creates a registration record in PostgreSQL.
- First login for student/driver raises a login approval request.
- Admin sees pending login approvals and approves them.
- Only approved users are stored in the `students` or `drivers` tables.
- Driver GPS updates are written to `driver_live_tracking` for student live updates and map movement.
- Admin dashboard now uses real tables:
   - `buses` for available buses and driver assignment.
   - `operation_events` for live start/end trip queue.
   - `admin_notifications` for role-targeted notifications.

## Important After Pulling Latest Changes

- Re-run `supabase/schema.sql` so the new tables and policies are created.
