'use client';

import React, { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

/* ---------------------------
   Import your doc components
   --------------------------- */

// Top-level documentation sections
import A_Introduction from "./docs/A_Overview/A_Introduction";
import B_OverallSummary from "./docs/A_Overview/B_Overall_Summary";

// Problem
import A_BiologyIsComplex from "./docs/B_Problem/A_BiologyIsComplex";
import B_DrugDevelopment from "./docs/B_Problem/B_DrugDevelopment";
import C_CaseStudyLeukemia from "./docs/B_Problem/C_CaseStudyLeukemia";

// Vision
import VisionOverview from "./docs/C_Vision/A_VisionOverview";
import FirstPrinciples from "./docs/C_Vision/B_FirstPrinciples";
import Zebrafish from "./docs/C_Vision/C_Zebrafish";
import ScRNA from "./docs/C_Vision/D_scRNA";
import FuturePotential from "./docs/C_Vision/E_FuturePotential";

// Technology
import BioFoundationModels from "./docs/D_Technology/A_BioFoundationModels";
import DataSources from "./docs/D_Technology/B_DataSources";
import BiologistPerspective from "./docs/D_Technology/C_BiologistPerspective";

// Business Modelf
import BusinessModel from "./docs/E_Business_Model/A_BusinessModel";

// Market Opportunity
import MarketOpportunity from "./docs/F_Market_Opportunity/A_MarketOpportunity";
import Customers from "./docs/F_Market_Opportunity/B_Customers";

// Competitive Landscape
import CompetitiveLandscape from "./docs/G_Competitive_Landscape/A_CompetitiveLandscape";

// Team & Advisors
import TeamAdvisors from "./docs/H_Team_and_Advisors/A_TeamAdvisors";

/* -----------------------------------------------
   Interfaces for your category structure
----------------------------------------------- */

interface SubSection {
  id: string;
  title: string;
  component: React.ComponentType;
}

interface Category {
  id: string;
  title: string;
  description: string;
  component?: React.ComponentType;
  subSections?: SubSection[];
}

/* -----------------------------------------------
   DarkMode Component (internal only)
----------------------------------------------- */

type ThemeOption = "light" | "dark";

const SHOW_DARK_MODE_TOGGLE = false;
const DEFAULT_THEME: ThemeOption = "light";
const RESPECT_USER_PREFERENCE = true;

function DarkMode({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
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
      if (DEFAULT_THEME === "dark") {
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
    setDarkMode((prev) => {
      const newMode = !prev;
      localStorage.setItem("theme", newMode ? "dark" : "light");
      document.documentElement.classList.toggle("dark", newMode);
      return newMode;
    });
  };

  return (
    <>
      {SHOW_DARK_MODE_TOGGLE && (
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={toggleDarkMode}
            className={`relative inline-flex h-6 w-11 items-center rounded-full focus:outline-none cursor-pointer`}
            role="switch"
            aria-checked={darkMode}
          >
            <span
              className={`absolute inset-0 rounded-full transition duration-200 ease-in-out ${
                darkMode ? "bg-gray-700" : "bg-gray-300"
              }`}
            ></span>
            <span
              className={`absolute h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                darkMode ? "translate-x-5" : "translate-x-1"
              }`}
            ></span>
          </button>
        </div>
      )}
      {children}
    </>
  );
}

/* -----------------------------------------------
   Data Setup for Documentation
----------------------------------------------- */

const categories: Category[] = [
  {
    id: "overview",
    title: "Overview",
    description: "An overall look at our data room wiki.",
    subSections: [
      {
        id: "introduction",
        title: "Introduction",
        component: A_Introduction,
      },
      {
        id: "overall-summary",
        title: "Overall Summary",
        component: B_OverallSummary,
      },
    ],
  },
  {
    id: "problem",
    title: "Problem",
    description: "An analysis of the key challenges in drug development.",
    subSections: [
      {
        id: "biology-is-complex",
        title: "Biology is Complex",
        component: A_BiologyIsComplex,
      },
      {
        id: "drug-development-landscape",
        title: "Drug Development Landscape",
        component: B_DrugDevelopment,
      },
      {
        id: "case-study-Leukemia",
        title: "Case Study: Leukemia",
        component: C_CaseStudyLeukemia,
      },
    ],
  },
  {
    id: "vision",
    title: "Vision",
    description: "Our vision for the future of biological foundation models.",
    subSections: [
      {
        id: "vision-overview",
        title: "Vision Overview",
        component: VisionOverview,
      },
      {
        id: "first-principles",
        title: "First Principles",
        component: FirstPrinciples,
      },
      {
        id: "zebrafish",
        title: "Zebrafish",
        component: Zebrafish,
      },
      {
        id: "scrna",
        title: "scRNA",
        component: ScRNA,
      },
      {
        id: "future-potential",
        title: "Future Potential",
        component: FuturePotential,
      },
    ],
  },
  {
    id: "technology",
    title: "Technology",
    description: "The technology behind our platform.",
    subSections: [
      {
        id: "bio-foundation-models",
        title: "Bio Foundation Models",
        component: BioFoundationModels,
      },
      {
        id: "data-sources",
        title: "Data Sources",
        component: DataSources,
      },
      {
        id: "biologist-perspective",
        title: "Biologist Perspective",
        component: BiologistPerspective,
      },
    ],
  },
  {
    id: "business-model",
    title: "Business Model",
    description: "Discover our revenue streams and scalability potential.",
    subSections: [
      {
        id: "business-model",
        title: "Business Model",
        component: BusinessModel,
      },
    ],
  },
  {
    id: "market-opportunity",
    title: "Market Opportunity",
    description: "Explore the market potential and growth projections.",
    subSections: [
      {
        id: "market-opportunity",
        title: "Market Opportunity",
        component: MarketOpportunity,
      },
      {
        id: "customers",
        title: "Customers",
        component: Customers,
      },
    ],
  },
  {
    id: "competitive-landscape",
    title: "Competitive Landscape",
    description: "Understand our unique position in the AI biotech market.",
    subSections: [
      {
        id: "competitive-landscape",
        title: "Competitive Landscape",
        component: CompetitiveLandscape,
      },
    ],
  },
  {
    id: "team-advisors",
    title: "Team & Advisors",
    description: "Meet our expert team and advisory board.",
    subSections: [
      {
        id: "team-advisors",
        title: "Team & Advisors",
        component: TeamAdvisors,
      },
    ],
  },
];

/* -----------------------------------------------
   Main Page Component
----------------------------------------------- */

const DataRoomDocumentation: React.FC = () => {
  // Dark mode state and password gating
  const [darkMode, setDarkMode] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);
  const [typedPassword, setTypedPassword] = useState("");

  // Visitor tracking state
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Category/sub-section selection
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0].id);
  const [selectedSubSectionId, setSelectedSubSectionId] = useState<string | null>(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(
    categories[0].id
  );

  // Track the current route to highlight active tab
  const pathname = usePathname();

  // Initialize dark mode from localStorage
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "dark") {
      document.documentElement.classList.add("dark");
      setDarkMode(true);
    }
  }, []);

  // Automatically select the first sub-section when a category changes
  useEffect(() => {
    const cat = categories.find((c) => c.id === selectedCategoryId);
    if (cat) {
      if (cat.subSections && cat.subSections.length > 0) {
        setSelectedSubSectionId(cat.subSections[0].id);
      } else {
        setSelectedSubSectionId(null);
      }
    }
  }, [selectedCategoryId]);

  // Attempt password unlock and log visitor info
  const handleUnlock = async () => {
    const CORRECT_PASSWORD = "z"; // Example
    if (typedPassword === CORRECT_PASSWORD) {
      setAccessGranted(true);
      try {
        const res = await fetch("/api/visitors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName,
            lastName,
            password: typedPassword,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setVisitorId(data.id);
        }
      } catch (err) {
        console.error("Error logging visitor:", err);
      }
    } else {
      alert("Incorrect password. Please try again.");
    }
  };

  // Toggle expand/collapse for the left nav categories
  const handleToggleCategory = (catId: string) => {
    setExpandedCategoryId(expandedCategoryId === catId ? null : catId);
    setSelectedCategoryId(catId);
  };

  // Select a sub-section
  const handleSelectSubSection = (catId: string, subId: string) => {
    setSelectedCategoryId(catId);
    setSelectedSubSectionId(subId);
  };

  // Identify the current category
  const currentCategoryIndex = categories.findIndex(
    (c) => c.id === selectedCategoryId
  );
  const currentCategory =
    currentCategoryIndex !== -1 ? categories[currentCategoryIndex] : null;

  // Next sub-section logic
  let nextSubSection: SubSection | null = null;
  if (currentCategory?.subSections && selectedSubSectionId) {
    const idx = currentCategory.subSections.findIndex(
      (s) => s.id === selectedSubSectionId
    );
    if (idx !== -1 && idx < currentCategory.subSections.length - 1) {
      nextSubSection = currentCategory.subSections[idx + 1];
    }
  }

  // Check if we are at the final sub-section of a category
  let atLastSubSectionOfCategory = false;
  if (currentCategory?.subSections && selectedSubSectionId) {
    const idx = currentCategory.subSections.findIndex(
      (s) => s.id === selectedSubSectionId
    );
    if (idx === currentCategory.subSections.length - 1) {
      atLastSubSectionOfCategory = true;
    }
  }

  // Figure out the next major category, if any
  let nextCategory: Category | null = null;
  if (
    currentCategoryIndex !== -1 &&
    currentCategoryIndex < categories.length - 1
  ) {
    nextCategory = categories[currentCategoryIndex + 1];
  }

  // Helper function to jump to the first sub-section of the next category
  const handleGoToNextCategory = () => {
    if (!nextCategory) return;
    setSelectedCategoryId(nextCategory.id);
    setExpandedCategoryId(nextCategory.id);
    if (nextCategory.subSections && nextCategory.subSections.length > 0) {
      setSelectedSubSectionId(nextCategory.subSections[0].id);
    } else {
      setSelectedSubSectionId(null);
    }
  };

  // Log visitor exit time when the user leaves the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (visitorId) {
        fetch("/api/visitors", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: visitorId }),
        }).catch((err) =>
          console.error("Error logging exit time:", err)
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [visitorId]);

  // Render the main content on the right side
  function renderContent() {
    if (!currentCategory) {
      return (
        <div className="text-black dark:text-white">Category not found.</div>
      );
    }
    const subSections =
      currentCategory.subSections ||
      [
        {
          id: currentCategory.id,
          title: currentCategory.title,
          component: currentCategory.component!,
        },
      ];
    if (selectedSubSectionId) {
      const sub = subSections.find((s) => s.id === selectedSubSectionId);
      if (!sub) {
        return (
          <div className="text-black dark:text-white">
            Sub-section not found.
          </div>
        );
      }
      try {
        const SubComponent = sub.component;
        return <SubComponent />;
      } catch (error) {
        console.error("Error rendering component:", error);
        return (
          <div className="text-red-500">Error loading component</div>
        );
      }
    }
    return (
      <>
        <h2 className="roboto-slab-bold text-lg sm:text-2xl text-black dark:text-white mb-2 leading-tight">
          {currentCategory.title}
        </h2>
        <p className="roboto-slab-regular text-sm sm:text-base text-black dark:text-white mb-8 leading-snug">
          {currentCategory.description}
        </p>
      </>
    );
  }

  return (
    <DarkMode>
      <div className="min-h-screen bg-white dark:bg-gray-900 relative">
        {/* Mobile-Only View */}
        <div className="block sm:hidden w-full h-screen bg-white dark:bg-gray-900 flex flex-col items-center justify-center">
          <Image
            src="/images/zeroshot_bio_gritty.png"
            alt="zeroshot logo"
            width={250}
            height={250}
            className="object-contain mb-4"
          />
          <h3 className="text-base text-center roboto-slab-light text-black dark:text-white pt-8 px-16">
            The data room is formatted for viewing on desktop computers.
          </h3>
          <h3 className="text-base text-center roboto-slab-light text-black dark:text-white pt-8 px-16">
            You <strong>can</strong> rotate your screen horizontally to preview it from here.
          </h3>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex justify-center w-full">
          <div
            className={`w-full max-w-[1600px] flex ${
              accessGranted ? "blur-0" : "blur-sm"
            }`}
            style={{ minWidth: "640px" }}
          >
            {/* Left Sidebar */}
            <aside className="flex flex-col border-r border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-6 sm:py-8 w-[23%] max-w-[320px] sticky top-0 bg-gray-50 dark:bg-gray-800 overflow-y-auto">
              <div className="flex items-center h-16 sm:h-20 mb-4 sm:mb-6">
                <Image
                  src="/images/zeroshot_bio_gritty.png"
                  alt="zeroshot logo"
                  width={170}
                  height={170}
                  className="object-contain"
                />
              </div>
              <div className="w-full border-t border-gray-200 dark:border-gray-700 mt-2 sm:mt-[5px] mb-2 sm:mb-4"></div>
              <nav className="space-y-3">
                {categories.map((cat) => {
                  const isExpanded = expandedCategoryId === cat.id;
                  const isSelected = selectedCategoryId === cat.id;
                  const subSections = cat.subSections || [
                    { id: cat.id, title: cat.title, component: cat.component! },
                  ];
                  return (
                    <div
                      key={cat.id}
                      className="my-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => handleToggleCategory(cat.id)}
                        className={`flex items-center w-full px-3 py-2 focus:outline-none transition-colors duration-50 text-left ${
                          isSelected
                            ? "bg-gray-200 dark:bg-gray-700 text-black dark:text-white"
                            : "bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                      >
                        <span
                          className={`inline-block transform transition-transform duration-50 ease-in-out mr-2 text-sm ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        >
                          &gt;
                        </span>
                        <span className="flex-1 text-sm roboto-slab-medium text-black dark:text-white">
                          {cat.title}
                        </span>
                      </button>
                      <div
                        className={`pl-2 pr-2 bg-gray-50 dark:bg-gray-800 transition-all duration-50 ease-in-out ${
                          isExpanded ? "max-h-[500px] py-2" : "max-h-0 py-0"
                        } overflow-hidden`}
                      >
                        {subSections.map((sub) => {
                          const subSelected = selectedSubSectionId === sub.id;
                          return (
                            <button
                              key={sub.id}
                              onClick={() => handleSelectSubSection(cat.id, sub.id)}
                              className={`w-full mb-2 px-3 py-2 rounded text-left transition-colors duration-100 text-xs ${
                                subSelected
                                  ? "bg-gray-200 dark:bg-gray-700 text-black dark:text-white"
                                  : "bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-black dark:text-white"
                              }`}
                            >
                              {sub.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </nav>
            </aside>

            {/* Right Content Area */}
            <main className="flex-1 overflow-y-auto relative">
              {/* Top Header Bar with tabs */}
              <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4 z-10">
                <div className="flex items-center space-x-8">
                  <Link
                    href="/dataroom"
                    className={`roboto-slab-semibold text-base sm:text-xl px-1 pb-1
                      ${
                        pathname === "/dataroom"
                          ? "text-black dark:text-white border-b-2 border-black dark:border-white"
                          : "text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white hover:border-b-2 hover:border-gray-500 transition-all"
                      }`}
                  >
                    Investor Data Room
                  </Link>
                  <Link
                    href="/gene-explorer"
                    className={`roboto-slab-semibold text-base sm:text-xl px-1 pb-1
                      ${
                        pathname === "/gene-explorer"
                          ? "text-black dark:text-white border-b-2 border-black dark:border-white"
                          : "text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white hover:border-b-2 hover:border-gray-500 transition-all"
                      }`}
                  >
                    Gene-Explorer 1.0
                  </Link>
                </div>
              </div>

              {/* Second Header Bar */}
              <div className="sticky top-[40px] sm:top-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-2 z-10 transition-all duration-100">
                <h2 className="roboto-slab-medium text-sm sm:text-lg text-black dark:text-white">
                  {currentCategory?.title}
                </h2>
              </div>

              {/* Main content area */}
              <div className="sm:pr-8 pt-6 pb-32 sm:pt-12 sm:ml-[28px] max-w-[700px] mx-auto">
                {renderContent()}

                {/* Next Sub-Section Button */}
                {nextSubSection && (
                  <div className="flex justify-left mt-4">
                    <button
                      onClick={() =>
                        handleSelectSubSection(
                          selectedCategoryId,
                          nextSubSection!.id
                        )
                      }
                      className="text-xs bg-gray-300 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-black dark:text-white px-4 py-2 rounded shadow transition-colors"
                    >
                      Next: {nextSubSection!.title}
                    </button>
                  </div>
                )}

                {/* If at last sub-section of the category, show next category button */}
                {atLastSubSectionOfCategory && nextCategory && (
                  <div className="flex justify-left mt-4">
                    <button
                      onClick={handleGoToNextCategory}
                      className="text-xs bg-gray-300 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-black dark:text-white px-4 py-2 rounded shadow transition-colors"
                    >
                      Next: {nextCategory.title}
                    </button>
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>

        {/* Password Overlay */}
        {!accessGranted && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/20 dark:bg-black/20 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-6 shadow-lg max-w-sm w-full mx-4">
              <h2 className="roboto-slab-semibold text-black dark:text-white text-xl mb-4">
                Enter Your Info
              </h2>
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-3 py-2 mb-2 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-3 py-2 mb-4 focus:outline-none"
              />
              <input
                type="password"
                placeholder="Password"
                value={typedPassword}
                onChange={(e) => setTypedPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUnlock();
                }}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-3 py-2 mb-4 focus:outline-none"
              />
              <button
                onClick={handleUnlock}
                className="bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 text-white px-4 py-2 rounded w-full roboto-slab-medium transition-colors"
              >
                Unlock
              </button>
            </div>
          </div>
        )}
      </div>
    </DarkMode>
  );
};

export default DataRoomDocumentation;
