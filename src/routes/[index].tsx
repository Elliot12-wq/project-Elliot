import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";

export const Route = createFileRoute("/index")({
  head: () => ({ meta: [{ title: "Elliot" }] }),
  component: IndexAlias,
});

function IndexAlias() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/", replace: true });
  }, [navigate]);

  return (
    <div className="flex h-[100dvh] items-center justify-center">
      <AmbientBackground />
    </div>
  );
}