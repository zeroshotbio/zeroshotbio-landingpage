'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

/* ---------------------------
   Import your doc components
   --------------------------- */

// Top-level documentation sections
import Introduction from './docs/Overview/introduction';
import ExecutiveSummary from './docs/Overview/executiveSummary';
import BusinessModel from './docs/Business_Model/businessModel';
import CompetitiveLandscape from './docs/Competitive_Landscape/competitiveLandscape';
import Customers from './docs/Customers/customers';
import MarketOpportunity from './docs/Market_Opportunity/marketOpportunity';
import TeamAdvisors from './docs/Team_and_Advisors/teamAdvisors';

// AI Bio Strategy sub-sections
import AiBioIntroCrisis from './docs/aiBio/introduction';
import BioFoundationModelVision from './docs/aiBio/bioFoundationModelVision';
import AnimalModelsZebrafish from './docs/aiBio/animalModelsZebrafish';
import IntroducingTsGPT from './docs/aiBio/introducingTsGPT';
import BioFoundationModelsImpacts from './docs/aiBio/bioFoundationModelsImpacts';
import StrategicTechnologyPathForward from './docs/aiBio/strategicTechnologyPathForward';
import VisionGlimpseBiggerPicture from './docs/aiBio/visionGlimpseBiggerPicture';

/* -----------------------------------------------
   Interfaces for your category structure
----------------------------------------------- */

interface SubSection {
  id: string;
  title: string;
  component: React.FC;
}

interface Category {
  id: string;
  title: string;
  description: string;
  component?: React.FC;
  subSections?: SubSection[];
}

/* -----------------------------------------------
   Data Setup
----------------------------------------------- */

const categories: Category[] = [
  {
    id: 'overview',
    title: 'Overview',
    description: 'An overall look at our data room wiki.',
    subSections: [
      {
        id: 'introduction',
        title: 'Introduction',
        component: Introduction,
      },
      {
        id: 'executive-summary',
        title: 'Executive Summary & Pitch Deck',
        component: ExecutiveSummary,
      },
    ],
  },
  {
    id: 'ai-bio-strategy',
    title: 'AI Bio Strategy',
    description: 'Our approach to AI-driven bioengineering.',
    subSections: [
      {
        id: 'introduction-crisis-of-confidence',
        title: 'Introduction – A Crisis of Confidence',
        component: AiBioIntroCrisis,
      },
      {
        id: 'bio-foundation-model-vision',
        title: 'Bio Foundation Model Vision',
        component: BioFoundationModelVision,
      },
      {
        id: 'animal-models-zebrafish',
        title: 'Animal Models & Zebrafish',
        component: AnimalModelsZebrafish,
      },
      {
        id: 'introducing-tsgpt-engine',
        title: 'Introducing the tsGPT Engine',
        component: IntroducingTsGPT,
      },
      {
        id: 'bio-foundation-models-impacts',
        title: 'Bio Foundation Models & Their Impacts',
        component: BioFoundationModelsImpacts,
      },
      {
        id: 'strategic-technology-path-forward',
        title: 'Strategic Technology Path Forward',
        component: StrategicTechnologyPathForward,
      },
      {
        id: 'vision-glimpse-of-the-bigger-picture',
        title: 'Vision: A Glimpse at the Bigger Picture',
        component: VisionGlimpseBiggerPicture,
      },
    ],
  },
  {
    id: 'business-model',
    title: 'Business Model',
    description: 'Discover our revenue streams and scalability potential.',
    component: BusinessModel,
  },
  {
    id: 'competitive-landscape',
    title: 'Competitive Landscape',
    description: 'Understand our unique position in the AI biotech market.',
    component: CompetitiveLandscape,
  },
  {
    id: 'customers',
    title: 'Customers',
    description: 'Learn about our ideal partners and engagement process.',
    component: Customers,
  },
  {
    id: 'market-opportunity',
    title: 'Market Opportunity',
    description: 'Explore the market potential and growth projections.',
    component: MarketOpportunity,
  },
  {
    id: 'team-advisors',
    title: 'Team & Advisors',
    description: 'Meet our expert team and advisory board.',
    component: TeamAdvisors,
  },
];

/* -----------------------------------------------
   Main Component
----------------------------------------------- */

const DataRoomDocumentation: React.FC = () => {
  // Password gating
  const [accessGranted, setAccessGranted] = useState(false);
  const [typedPassword, setTypedPassword] = useState('');

  // For category/sub-section selection
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0].id);
  const [selectedSubSectionId, setSelectedSubSectionId] = useState<string | null>(null);
  // Keep track of which category is expanded (only one at a time)
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(categories[0].id);

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

  const handleUnlock = () => {
    const CORRECT_PASSWORD = 'zebrafish';
    if (typedPassword === CORRECT_PASSWORD) {
      setAccessGranted(true);
    } else {
      alert('Incorrect password. Please try again.');
    }
  };

  const handleToggleCategory = (catId: string) => {
    if (expandedCategoryId === catId) {
      setExpandedCategoryId(null);
    } else {
      setExpandedCategoryId(catId);
    }
    setSelectedCategoryId(catId);
  };

  const handleSelectSubSection = (catId: string, subId: string) => {
    setSelectedCategoryId(catId);
    setSelectedSubSectionId(subId);
  };

  // Next sub-section logic
  const currentCategory = categories.find(c => c.id === selectedCategoryId);
  let nextSubSection = null;
  if (currentCategory?.subSections && selectedSubSectionId) {
    const idx = currentCategory.subSections.findIndex(s => s.id === selectedSubSectionId);
    if (idx !== -1 && idx < currentCategory.subSections.length - 1) {
      nextSubSection = currentCategory.subSections[idx + 1];
    }
  }

  // Render the main content on the right side
  function renderContent() {
    if (!currentCategory) {
      return <div className="text-gray-500">Category not found.</div>;
    }
    const subSections =
      currentCategory.subSections || [{ id: currentCategory.id, title: currentCategory.title, component: currentCategory.component! }];

    if (selectedSubSectionId) {
      const sub = subSections.find(s => s.id === selectedSubSectionId);
      if (!sub) return <div className="text-gray-500">Sub-section not found.</div>;
      const SubComponent = sub.component;
      return <SubComponent />;
    }

    return (
      <>
        <h2 className="roboto-slab-bold text-lg sm:text-2xl text-gray-900 mb-2 leading-tight">
          {currentCategory.title}
        </h2>
        <p className="roboto-slab-regular text-sm sm:text-base text-gray-600 mb-8 leading-snug">
          {currentCategory.description}
        </p>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-white relative">
      {/* Mobile-Only View: Show a simple message that the data room is desktop only */}
      <div className="block sm:hidden w-full h-screen bg-white flex flex-col items-center justify-center">
        <Image
          src="/images/zeroshot_bio_gritty.png"
          alt="zeroshot logo"
          width={250}
          height={250}
          className="object-contain mb-4"
        />
            <h3 className="text-base text-center roboto-slab-light text-gray-verydark pt-8 px-16">
            The data room is formatted for viewing on desktop computers.
            </h3>
            <h3 className="text-base text-center roboto-slab-light text-gray-verydark pt-8 px-16">
            You <strong>can</strong> rotate your screen horizontally to preview it from here.
            </h3>
      </div>

      {/* Desktop/Larger Screens Layout: 
          hidden on mobile, displayed from sm: and up
      */}
      <div className="hidden sm:flex justify-center w-full">
        {/* Outer container with max width */}
        <div
          className={`w-full max-w-[1600px] flex transition-filter duration-300 ${
            accessGranted ? 'blur-0' : 'blur-sm'
          }`}
          style={{ minWidth: '640px' }}
        >
          {/* Left Sidebar */}
          <aside className="flex flex-col border-r border-gray-200 px-4 sm:px-6 py-6 sm:py-8 w-[23%] max-w-[320px] sticky top-0 bg-gray-50 overflow-y-auto">
            <div className="flex items-center h-16 sm:h-20 mb-4 sm:mb-6">
              <Image
                src="/images/zeroshot_bio_gritty.png"
                alt="zeroshot logo"
                width={170}
                height={170}
                className="object-contain"
              />
            </div>
            <div className="w-full border-t border-gray-200 mt-2 sm:mt-[5px] mb-2 sm:mb-4"></div>
            <nav className="space-y-3">
              {categories.map(cat => {
                const isExpanded = expandedCategoryId === cat.id;
                const isSelected = selectedCategoryId === cat.id;
                const subSections = cat.subSections || [{ id: cat.id, title: cat.title, component: cat.component! }];

                return (
                  <div key={cat.id} className="border-b border-gray-200 pb-2">
                    <button
                      onClick={() => handleToggleCategory(cat.id)}
                      className={`flex items-center w-full text-left transition-colors duration-200 px-3 py-2 rounded-sm ${
                        isSelected ? 'bg-gray-100 text-gray-800' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span
                        className={`inline-block transform transition-transform duration-300 ease-in-out mr-2 text-sm ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      >
                        &gt;
                      </span>
                      <span className="flex-1 text-sm roboto-slab-medium">{cat.title}</span>
                    </button>
                    {isExpanded && (
                      <div className="overflow-hidden transition-all duration-300 ease-in-out max-h-[400px] mt-2">
                        <div className="flex flex-col space-y-2 pl-5 pr-3 py-2">
                          {subSections.map(sub => {
                            const subSelected = selectedSubSectionId === sub.id;
                            return (
                              <button
                                key={sub.id}
                                onClick={() => handleSelectSubSection(cat.id, sub.id)}
                                className={`w-full px-3 py-2 rounded border border-gray-100 text-xs text-gray-500 text-left transition-colors duration-200 ${
                                  subSelected ? 'bg-gray-200 text-gray-900' : 'bg-white hover:bg-gray-100'
                                }`}
                              >
                                {sub.title}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </aside>

          {/* Right Content Area */}
          <main className="flex-1 overflow-y-auto relative">
            {/* Top Header Bar */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 z-10">
              <h1 className="roboto-slab-semibold text-base sm:text-xl text-gray-900">
                Investor Data Room
              </h1>
            </div>
            {/* Second Header Bar */}
            <div className="sticky top-[40px] sm:top-16 bg-white border-b border-gray-200 px-4 sm:px-6 py-2 z-10 transition-all duration-300">
              <h2 className="roboto-slab-medium text-sm sm:text-lg text-gray-800">
                {currentCategory?.title}
              </h2>
            </div>

            {/* Main content */}
            <div className="px-4 sm:px-8 pt-4 sm:pt-8 sm:ml-[50px]">
              <div className="max-w-3xl">
                {renderContent()}
                {nextSubSection && (
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() =>
                        handleSelectSubSection(selectedCategoryId, nextSubSection!.id)
                      }
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded shadow transition-colors"
                    >
                      Next: {nextSubSection.title}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Password Overlay */}
      {!accessGranted && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/20 backdrop-blur-sm">
          <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-lg max-w-sm w-full mx-4">
            <h2 className="roboto-slab-semibold text-gray-800 text-xl mb-4">
              Enter Password
            </h2>
            <input
              type="password"
              placeholder="Password"
              value={typedPassword}
              onChange={(e) => setTypedPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUnlock();
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none"
            />
            <button
              onClick={handleUnlock}
              className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded w-full roboto-slab-medium transition-colors"
            >
              Unlock
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataRoomDocumentation;
