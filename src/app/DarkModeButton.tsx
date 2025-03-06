'use client';

import React, { ReactNode, useEffect, useState } from "react";

// ========================
// 🔍 CONFIGURATION SECTION
// ========================

// 🔍 TO ENABLE THE DARK MODE TOGGLE: Set this to 'true'
const SHOW_DARK_MODE_TOGGLE = true;

// Set the default theme ('light' or 'dark')
const DEFAULT_THEME = 'light';

// Should user preference override the default? (set to false to force DEFAULT_THEME)
const RESPECT_USER_PREFERENCE = true;

// Animation settings - controls the cascade effect
const ENABLE_STAGGERED_ANIMATION = true;

interface DarkModeProps {
  children: ReactNode;
}

export default function DarkMode({ children }: DarkModeProps) {
  const [darkMode, setDarkMode] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    // Initialize theme based on configuration settings
    if (RESPECT_USER_PREFERENCE) {
      // Check localStorage for user preference
      const storedTheme = localStorage.getItem("theme");
      
      if (storedTheme === "dark") {
        document.documentElement.classList.add("dark");
        setDarkMode(true);
      } else {
        // Either 'light' or null (first visit)
        document.documentElement.classList.remove("dark");
        // Set default if not set yet
        if (!storedTheme) {
          localStorage.setItem("theme", DEFAULT_THEME);
        }
      }
    } else {
      // Force default theme regardless of user preference
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
    if (isTransitioning) return; // Prevent rapid toggling during transition
    
    setIsTransitioning(true);
    
    setDarkMode((prev) => {
      const newDarkMode = !prev;
      localStorage.setItem("theme", newDarkMode ? "dark" : "light");
      
      if (ENABLE_STAGGERED_ANIMATION) {
        // For staggered effect, apply classes to different elements with varying delays
        if (newDarkMode) {
          // First add the main dark class
          document.documentElement.classList.add("dark");
          
          // Then add animation classes to trigger the staggered transitions
          document.documentElement.classList.add("theme-transition");
        } else {
          // Remove the dark class
          document.documentElement.classList.remove("dark");
          
          // Keep the animation class during the transition
          document.documentElement.classList.add("theme-transition");
        }
        
        // Remove the animation class after the transition is complete
        setTimeout(() => {
          document.documentElement.classList.remove("theme-transition");
          setIsTransitioning(false);
        }, 400); // Set to just slightly longer than our longest transition (300ms)
      } else {
        // Simple toggle without staggered effect
        if (newDarkMode) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
        setTimeout(() => setIsTransitioning(false), 200);
      }
      
      return newDarkMode;
    });
  };

  return (
    <>
      {/* Dark mode toggle button */}
      {SHOW_DARK_MODE_TOGGLE && (
        <div className="fixed top-4 right-4 z-50">
          <button 
            onClick={toggleDarkMode}
            disabled={isTransitioning}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full focus:outline-none
              ${isTransitioning ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}
            `}
            role="switch"
            aria-checked={darkMode}
          >
            {/* Background of the toggle */}
            <span className={`
              absolute inset-0 rounded-full transition duration-200 ease-in-out
              ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}
            `}></span>
            
            {/* The sliding circle */}
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