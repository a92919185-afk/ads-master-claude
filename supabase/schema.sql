-- Create Accounts Table
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  google_ads_account_id text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Campaign Metrics Table
CREATE TABLE IF NOT EXISTS public.campaign_metrics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  campaign_name text NOT NULL,
  budget numeric(12,2) DEFAULT 0,
  status text,
  impressions integer DEFAULT 0 NOT NULL,
  clicks integer DEFAULT 0 NOT NULL,
  cost numeric(12,2) DEFAULT 0 NOT NULL,
  conversions numeric(12,2) DEFAULT 0 NOT NULL,
  conversion_value numeric(12,2) DEFAULT 0 NOT NULL,
  profit numeric(12,2) DEFAULT 0 NOT NULL,
  search_absolute_top_impression_share numeric(5,2) DEFAULT 0,
  search_top_impression_share numeric(5,2) DEFAULT 0,
  search_impression_share numeric(5,2) DEFAULT 0,
  target_cpa numeric(12,2) DEFAULT 0,
  avg_target_cpa numeric(12,2) DEFAULT 0,
  date date NOT NULL,
  hour integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Prevent duplicate entries for the same campaign on the same day and hour
  UNIQUE(account_id, campaign_name, date, hour)
);

-- Note: Profit calculation (conversion_value - cost) should typically be handled
-- either by a database trigger or in the application logic before insertion.
-- For this application, it will be handled in the Next.js API Route webhook.

-- Enable Row Level Security (RLS)
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_metrics ENABLE ROW LEVEL SECURITY;

-- Create basic policies (Assuming simple API key auth for the webhook, 
-- but dashboard might need authenticated reads later. Adjust as needed)
-- For now, allowing all reading if authenticated with standard roles
CREATE POLICY "Allow read access to authenticated users" ON public.accounts FOR SELECT USING (true);
CREATE POLICY "Allow read access to authenticated users" ON public.campaign_metrics FOR SELECT USING (true);
