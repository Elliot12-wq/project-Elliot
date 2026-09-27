import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import logo from "@/assets/elliot-logo.png";

export function LegalPage({
  label,
  title,
  intro,
  children,
}: {
  label: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
        <header className="flex items-center justify-between gap-4 border-b border-border pb-6">
          <Link to="/" className="inline-flex items-center gap-3 font-display text-2xl text-foreground" aria-label="Elliot home">
            <img src={logo} alt="" className="h-9 w-9 rounded-full" /> Elliot
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Elliot
          </Link>
        </header>

        <main className="pt-12 sm:pt-16">
          <p className="text-xs font-medium uppercase text-primary">{label}</p>
          <h1 className="mt-3 font-display text-5xl leading-tight sm:text-6xl">{title}</h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">{intro}</p>
          <p className="mt-5 border-b border-border pb-8 text-xs text-muted-foreground">Effective September 27, 2026 · Last updated September 27, 2026</p>
          <div className="space-y-10 pt-10 text-sm leading-7 text-muted-foreground [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:leading-tight [&_h2]:text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-primary-glow [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
            {children}
          </div>
        </main>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground">
          <span>Made by Charlie Nathaniel P. Sagun</span>
          <nav aria-label="Legal pages" className="flex gap-5">
            <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}