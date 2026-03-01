"use client";

import { getLoginUrl } from "@/lib/auth/sso";
import { LogIn } from "lucide-react";

interface LoginButtonProps {
  redirectPath?: string;
  className?: string;
}

export function LoginButton({
  redirectPath = "/",
  className,
}: LoginButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.location.href = getLoginUrl(window.location.origin, redirectPath);
  };

  return (
    <a
      href="#"
      onClick={handleClick}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      }
    >
      <LogIn className="h-4 w-4" />
      Sign in
    </a>
  );
}
