import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX = 2000;

export const getMyInstructions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_instructions")
      .select("content")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { content: (data?.content as string | undefined) ?? "" };
  });

export const saveMyInstructions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = (input as { content?: unknown })?.content;
    const content = typeof raw === "string" ? raw.slice(0, MAX) : "";
    return { content };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_instructions")
      .upsert(
        { user_id: context.userId, content: data.content, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { content: data.content };
  });
