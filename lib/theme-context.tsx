"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";
const THEME_STORAGE_KEY = "sellingmy-theme-v4";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // v4 intentionally migrates existing accounts to the approved charcoal/lime
    // experience once. After that first load, the user's toggle choice persists.
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    const initial = stored === "light" ? "light" : "dark";
    setTheme(initial);
    localStorage.setItem(THEME_STORAGE_KEY, initial);
    document.documentElement.classList.remove("dk", "lk");
    document.documentElement.classList.add(initial === "dark" ? "dk" : "lk");
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_STORAGE_KEY, next);
      document.documentElement.classList.remove("dk", "lk");
      document.documentElement.classList.add(next === "dark" ? "dk" : "lk");
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
