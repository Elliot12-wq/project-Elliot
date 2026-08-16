import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  userId: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
};

export function useProfile(enabled = true) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(enabled);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("nickname, avatar_url")
      .eq("user_id", u.user.id)
      .maybeSingle();
    setProfile({
      userId: u.user.id,
      email: u.user.email ?? "",
      nickname: (data?.nickname as string | null) ?? "",
      avatarUrl: (data?.avatar_url as string | null) ?? null,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    load();
  }, [enabled, load]);

  const save = useCallback(
    async (patch: { nickname?: string; avatarUrl?: string | null }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const row = {
        user_id: u.user.id,
        updated_at: new Date().toISOString(),
        ...(patch.nickname !== undefined ? { nickname: patch.nickname } : {}),
        ...(patch.avatarUrl !== undefined ? { avatar_url: patch.avatarUrl } : {}),
      };
      const { error } = await supabase.from("profiles").upsert(row, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
      setProfile((p) => (p ? { ...p, ...("nickname" in patch ? { nickname: patch.nickname ?? "" } : {}), ...("avatarUrl" in patch ? { avatarUrl: patch.avatarUrl ?? null } : {}) } : p));
    },
    [],
  );

  const uploadAvatar = useCallback(async (file: File) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Not signed in");
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${u.user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) throw new Error(error.message);
    const { data, error: signErr } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (signErr || !data?.signedUrl) throw new Error(signErr?.message || "Couldn't prepare that picture.");
    return data.signedUrl;
  }, []);

  return { profile, loading, reload: load, save, uploadAvatar };
}
