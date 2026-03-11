INSERT INTO storage.buckets (id, name, public) VALUES ('invoice-attachments', 'invoice-attachments', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload invoice attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'invoice-attachments');

CREATE POLICY "Authenticated users can view invoice attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'invoice-attachments');

CREATE POLICY "Authenticated users can delete invoice attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'invoice-attachments');