ALTER FUNCTION public.touch_user_instructions() SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.touch_user_instructions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_user_instructions() TO service_role;