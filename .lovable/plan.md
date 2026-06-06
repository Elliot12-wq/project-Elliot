## Problem

The chat-images storage bucket was never actually created — the previous attempt used a SQL migration, but Supabase requires the dedicated storage bucket tool. So uploads fail with "Bucket not found".

## Fix

1. Create the `chat-images` storage bucket (public read) via the storage bucket tool.
2. Add RLS policies on `storage.objects` so authenticated users can upload/read/delete files only under their own `{userId}/...` folder, while public reads of the bucket are allowed (so Elliot can fetch the image URL).

No frontend changes needed — the upload code in `ChatView.tsx` already targets the `chat-images` bucket.