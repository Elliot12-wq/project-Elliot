CREATE TABLE public.user_instructions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  content text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_instructions TO authenticated;
GRANT ALL ON public.user_instructions TO service_role;

ALTER TABLE public.user_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own instructions select" ON public.user_instructions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own instructions insert" ON public.user_instructions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own instructions update" ON public.user_instructions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own instructions delete" ON public.user_instructions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_user_instructions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_user_instructions
  BEFORE UPDATE ON public.user_instructions
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_instructions();