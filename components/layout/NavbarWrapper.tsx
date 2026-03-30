"use client";

import { useNavbarDisplay } from "@/components/providers/NavbarDisplayProvider";
import { Navbar } from "./Navbar";

export function NavbarWrapper() {
  const { navbarDisplay } = useNavbarDisplay();

  if (!navbarDisplay) {
    return null;
  }

  return <Navbar />;
}
