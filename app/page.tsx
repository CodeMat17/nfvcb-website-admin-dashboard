import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <span className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">
          NFVCB Admin
        </span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          National Film and Video Censors Board
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          NFVCB Website
          <br />
          Admin Dashboard
        </h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          Restricted access portal for authorised administrators. Manage news,
          staff, and site content from one place.
        </p>
      </div>

      <Link
        href="/sign-in"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow transition-opacity hover:opacity-90">
        Sign In
      </Link>

      <p className="text-xs text-muted-foreground">
        Access is limited to designated administrators only.
      </p>
      </div>
    </div>
  );
}
