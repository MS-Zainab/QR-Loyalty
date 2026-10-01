CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  role text not null,
  status text default 'pending' check (status in ('pending', 'completed')),
  created_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Admins can view and update password reset requests
CREATE POLICY "Admins can view and update password reset requests"
  ON public.password_reset_requests
  FOR ALL
  USING (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );
