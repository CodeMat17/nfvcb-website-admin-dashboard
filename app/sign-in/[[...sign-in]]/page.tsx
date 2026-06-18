"use client";

import { SignIn, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Page() {
  const { isSignedIn, user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const role = user.publicMetadata?.role;
    router.replace(role === "admin" ? "/dashboard" : "/not-admin");
  }, [isSignedIn, user, router]);

  if (isSignedIn) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <SignIn />
    </div>
  );
}
