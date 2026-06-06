
CREATE POLICY "chat-images user upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "chat-images user read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "chat-images user delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);
