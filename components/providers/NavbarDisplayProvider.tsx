"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface NavbarDisplayContextType {
  navbarDisplay: boolean;
  setNavbarDisplay: (value: boolean) => void;
}

const NavbarDisplayContext = createContext<NavbarDisplayContextType>({
  navbarDisplay: true,
  setNavbarDisplay: () => {},
});

export function NavbarDisplayProvider({ children }: { children: ReactNode }) {
  const [navbarDisplay, setNavbarDisplay] = useState(true);

  return (
    <NavbarDisplayContext.Provider value={{ navbarDisplay, setNavbarDisplay }}>
      {children}
    </NavbarDisplayContext.Provider>
  );
}

export function useNavbarDisplay() {
  return useContext(NavbarDisplayContext);
}
