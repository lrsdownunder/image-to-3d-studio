CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TYPE public.job_kind AS ENUM ('image_to_3d','text_to_3d');
CREATE TYPE public.job_status AS ENUM ('queued','processing','done','failed');

CREATE TABLE public.generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind public.job_kind NOT NULL DEFAULT 'image_to_3d',
  status public.job_status NOT NULL DEFAULT 'queued',
  progress int NOT NULL DEFAULT 0,
  input_image_path text,
  prompt text,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  backend_job_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.generation_jobs TO authenticated;
GRANT ALL ON public.generation_jobs TO service_role;
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own jobs read" ON public.generation_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own jobs delete" ON public.generation_jobs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX generation_jobs_user_idx ON public.generation_jobs(user_id, created_at DESC);

CREATE TABLE public.models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id uuid REFERENCES public.generation_jobs(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Untitled model',
  glb_path text,
  obj_path text,
  stl_path text,
  thumbnail_path text,
  face_count int,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.models TO authenticated;
GRANT ALL ON public.models TO service_role;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own models read" ON public.models FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own models update" ON public.models FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own models delete" ON public.models FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER generation_jobs_touch BEFORE UPDATE ON public.generation_jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.generation_jobs;

CREATE POLICY "own inputs upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inputs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own inputs read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('inputs','models') AND (storage.foldername(name))[1] = auth.uid()::text);