'use client';

import React, { ReactNode, useEffect, useState } from "react";

// Define a type for theme options
type ThemeOption = 'light' | 'dark';

const SHOW_DARK_MODE_TOGGLE = true;
const DEFAULT_THEME: ThemeOption = 'light';
const RESPECT_USER_PREFERENCE = true;

interface DarkModeProps {
  children: ReactNode;
}

export default function DarkMode({ children }: DarkModeProps) {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Initialize theme based on configuration settings
    if (RESPECT_USER_PREFERENCE) {
      const storedTheme = localStorage.getItem("theme") as ThemeOption | null;
      if (storedTheme === "dark") {
        document.documentElement.classList.add("dark");
        setDarkMode(true);
      } else {
        document.documentElement.classList.remove("dark");
        if (!storedTheme) {
          localStorage.setItem("theme", DEFAULT_THEME);
        }
      }
    } else {
      if (DEFAULT_THEME === 'dark') {
        document.documentElement.classList.add("dark");
        setDarkMode(true);
      } else {
        document.documentElement.classList.remove("dark");
        setDarkMode(false);
      }
      localStorage.setItem("theme", DEFAULT_THEME);
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const newDarkMode = !prev;
      const newTheme: ThemeOption = newDarkMode ? "dark" : "light";
      localStorage.setItem("theme", newTheme);
      
      if (newDarkMode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      
      return newDarkMode;
    });
  };

  return (
    <>
      {SHOW_DARK_MODE_TOGGLE && (
        <div className="fixed top-4 right-4 z-50">
          <button 
            onClick={toggleDarkMode}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full focus:outline-none cursor-pointer
            `}
            role="switch"
            aria-checked={darkMode}
          >
            <span className={`
              absolute inset-0 rounded-full transition duration-200 ease-in-out
              ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}
            `}></span>
            <span 
              className={`
                absolute h-5 w-5 transform rounded-full bg-white shadow-md
                transition-transform duration-200 ease-in-out
                ${darkMode ? 'translate-x-5' : 'translate-x-1'}
              `}
            ></span>
          </button>
        </div>
      )}
      {children}
    </>
  );
}
