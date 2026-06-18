"use client";

import { useClerk } from "@clerk/nextjs";
import Link from "next/link";

export default function NotAdminPage() {
  const { signOut } = useClerk();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-black tracking-tight">Access Denied</h1>
        <p className="max-w-sm text-muted-foreground">
          Your account does not have administrator privileges. Contact a
          super-admin to request access.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="rounded-md border px-5 py-2 text-sm font-semibold transition-colors hover:bg-accent">
          Sign Out
        </button>
        <Link
          href="/"
          className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow transition-opacity hover:opacity-90">
          Go Home
        </Link>
      </div>
    </div>
  );
}
