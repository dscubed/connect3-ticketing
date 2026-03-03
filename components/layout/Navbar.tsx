"use client";

import { useAuthStore } from "@/stores/authStore";
import { LoginButton } from "@/components/auth/LoginButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { LogOut, User } from "lucide-react";
import Link from "next/link";
import LogoAnimated from "../logo/LogoAnimated";

export function Navbar() {
  const { user, profile, loading } = useAuthStore();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const initials = profile?.first_name
    ? profile.first_name.charAt(0).toUpperCase()
    : (user?.email?.charAt(0).toUpperCase() ?? "?");

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 font-bold tracking-tight text-lg"
        >
          <LogoAnimated className="h-5 w-5" onHover={true} />
          <span className="mb-1">Ticketing</span>
        </Link>

        <div className="flex items-center gap-3">
          {loading ? null : user && profile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    {profile.avatar_url && (
                      <AvatarImage
                        src={profile.avatar_url}
                        alt={profile.first_name ?? ""}
                      />
                    )}
                    <AvatarFallback className="text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="flex flex-col gap-1 px-2 py-1.5">
                  <p className="text-sm font-medium">
                    {profile.first_name ?? "User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="flex items-center gap-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <LoginButton redirectPath="/" />
          )}
        </div>
      </div>
    </header>
  );
}
