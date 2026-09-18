// Shared shell for /commit, /commit/docs and /commit/draft_files: the colour variables for light and
// dark mode (THEME_CSS), a pre-paint script that applies a stored choice so the page never flashes
// the wrong theme, and the toggle.
import React from "react";
import { THEME_CSS } from "./theme";
import ThemeToggle from "./ThemeToggle";

const APPLY_STORED = `try{var t=localStorage.getItem("commit-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-commit-theme",t)}catch(e){}`;

export default function CommitLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: APPLY_STORED }} />
      <style dangerouslySetInnerHTML={{ __html: THEME_CSS }} />
      <ThemeToggle />
      {children}
    </>
  );
}
