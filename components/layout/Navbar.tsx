"use client";

import Link from "next/link";
import LogoAnimated from "../logo/LogoAnimated";
import { NavUserMenu } from "@/components/auth/NavUserMenu";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/10 backdrop-blur-2xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 font-bold tracking-tight text-lg"
        >
          <LogoAnimated className="h-5 w-5" onHover={true} />
        </Link>

        <NavUserMenu />
      </div>
    </header>
  );
}
