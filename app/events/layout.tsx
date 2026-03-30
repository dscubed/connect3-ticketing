"use client";

import { useEffect } from "react";
import { useNavbarDisplay } from "@/components/providers/NavbarDisplayProvider";

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setNavbarDisplay } = useNavbarDisplay();

  useEffect(() => {
    setNavbarDisplay(false);
    return () => setNavbarDisplay(true);
  }, [setNavbarDisplay]);

  return <>{children}</>;
}
