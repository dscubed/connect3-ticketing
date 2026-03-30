"use client";

import { useAuthStore } from "@/stores/authStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { getLoginUrl } from "@/lib/auth/sso";
import { LogIn, LogOut, UserPlus, UserRound, User } from "lucide-react";
import Link from "next/link";

interface NavUserMenuProps {
  /** Path to redirect to after sign-in/sign-up. Defaults to current path. */
  redirectPath?: string;
}

export function NavUserMenu({ redirectPath = "/" }: NavUserMenuProps) {
  const { user, profile, loading } = useAuthStore();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleAuth = (mode: "login" | "signup") => {
    window.location.href = getLoginUrl(
      window.location.origin,
      redirectPath,
      mode,
    );
  };

  if (loading) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  if (!user || !profile) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full border"
          >
            <UserRound className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => handleAuth("login")}
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => handleAuth("signup")}
          >
            <UserPlus className="h-4 w-4" />
            Create account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const initials = profile.first_name
    ? profile.first_name.charAt(0).toUpperCase()
    : (user.email?.charAt(0).toUpperCase() ?? "?");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            {profile.avatar_url && (
              <AvatarImage
                src={profile.avatar_url}
                alt={profile.first_name ?? ""}
              />
            )}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="flex flex-col gap-1 px-2 py-1.5">
          <p className="text-sm font-medium">{profile.first_name ?? "User"}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
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
          className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
