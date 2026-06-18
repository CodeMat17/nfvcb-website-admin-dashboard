"use client";

import { Show, SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import ConvexClientProvider from "@/components/ConvexClientProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }
    if (user.publicMetadata?.role !== "admin") {
      router.replace("/not-admin");
    }
  }, [isLoaded, isSignedIn, user, router]);

  if (!isLoaded || !isSignedIn || user?.publicMetadata?.role !== "admin") {
    return null;
  }

  return (
    <ConvexClientProvider>
      <nav className="sticky top-0 z-50 w-full flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
        <span className="font-semibold text-gray-800">NFVCB Admin</span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Show when="signed-out">
            <SignInButton />
            <SignUpButton>
              <button className="bg-[#6c47ff] text-white rounded-full font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 cursor-pointer">
                Sign Up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </nav>
      {children}
    </ConvexClientProvider>
  );
}
