-- Create storage bucket for company assets
INSERT INTO storage.buckets (id, name, public) VALUES ('company-assets', 'company-assets', true) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own logos
CREATE POLICY "Users can upload company logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-assets' AND (storage.foldername(name))[1] = 'logos' AND (storage.foldername(name))[2] = auth.uid()::text);

-- Allow authenticated users to update their own logos
CREATE POLICY "Users can update their logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'company-assets' AND (storage.foldername(name))[1] = 'logos' AND (storage.foldername(name))[2] = auth.uid()::text);

-- Allow public read access to company assets
CREATE POLICY "Public read access for company assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-assets');