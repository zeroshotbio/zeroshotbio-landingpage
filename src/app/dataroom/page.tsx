'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

/* ---------------------------
   Import your doc components
   --------------------------- */

// Top-level documentation sections
import Introduction from './docs/Overview/Introduction';
import OverallSummary from './docs/Overview/Overall_Summary';

// Problem
import DrugDevelopmentPipeline from './docs/Problem/drugDevelopmentPipeline';
import TherapeuticComplexity from './docs/Problem/therapeuticComplexity';
import CaseStudyMylotarg from './docs/Problem/caseStudyMylotarg';

// Vision
import VisionOverview from './docs/Vision/visionOverview';
import FirstPrinciples from './docs/Vision/firstPrinciples';
import Zebrafish from './docs/Vision/zebrafish';
import ScRNA from './docs/Vision/scRNA';
import FuturePotential from './docs/Vision/futurePotential';

// Technology
import BioFoundationModels from './docs/Technology/bioFoundationModels';
import DataSources from './docs/Technology/dataSources';
import BiologistPersepctive from './docs/Technology/biologistPerspective';

// Business Model
import BusinessModel from './docs/Business_Model/businessModel';

// Market Opportunity
import MarketOpportunity from './docs/Market_Opportunity/marketOpportunity';
import Customers from './docs/Market_Opportunity/customers';

// Competitive Landscape 
import CompetitiveLandscape from './docs/Competitive_Landscape/competitiveLandscape';

// Team & Advisors
import TeamAdvisors from './docs/Team_and_Advisors/teamAdvisors';

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
        id: 'ovearll-summary',
        title: 'Overall Summary',
        component: OverallSummary,
      },
    ],
  },
  {
    id: 'problem',
    title: 'Problem',
    description: 'An analysis of the key challenges in drug development.',
    subSections: [
      {
        id: 'drug-development-pipeline',
        title: 'Drug Development Pipeline',
        component: DrugDevelopmentPipeline,
      },
      {
        id: 'therapeutic-complexity',
        title: 'Therapeutic Complexity',
        component: TherapeuticComplexity,
      },
      {
        id: 'case-study-mylotarg',
        title: 'Case Study: Mylotarg',
        component: CaseStudyMylotarg,
      },
    ],
  },
  {
    id: 'vision',
    title: 'Vision',
    description: 'Our vision for the future of biological foundation models.',
    subSections: [
      {
        id: 'vision-overview',
        title: 'Vision Overview',
        component: VisionOverview,
      },
      {
        id: 'first-principles',
        title: 'First Principles',
        component: FirstPrinciples,
      },
      {
        id: 'zebrafish',
        title: 'Zebrafish',
        component: Zebrafish,
      },
      {
        id: 'scrna',
        title: 'scRNA',
        component: ScRNA,
      },
      {
        id: 'future-potential',
        title: 'Future Potential',
        component: FuturePotential,
      },
    ],
  },
  {
    id: 'technology',
    title: 'Technology',
    description: 'The technology behind our platform.',
    subSections: [
      {
        id: 'bio-foundation-models',
        title: 'Bio Foundation Models',
        component: BioFoundationModels,
      },
      {
        id: 'data-sources',
        title: 'Data Sources',
        component: DataSources,
      },
      {
        id: 'biologist-perspective',
        title: 'Biologist Perspective',
        component: BiologistPersepctive,
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
    id: 'market-opportunity',
    title: 'Market Opportunity',
    description: 'Explore the market potential and growth projections.',
    subSections: [
      {
        id: 'market-opportunity',
        title: 'Market Opportunity',
        component: MarketOpportunity,
      },
      {
        id: 'customers',
        title: 'Customers',
        component: Customers,
      },
    ],
  },
  {
    id: 'competitive-landscape',
    title: 'Competitive Landscape',
    description: 'Understand our unique position in the AI biotech market.',
    component: CompetitiveLandscape,
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
    const CORRECT_PASSWORD = 'z';
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
      return <div className="text-black">Category not found.</div>;
    }
    const subSections =
      currentCategory.subSections || [{ id: currentCategory.id, title: currentCategory.title, component: currentCategory.component! }];

    if (selectedSubSectionId) {
      const sub = subSections.find(s => s.id === selectedSubSectionId);
      if (!sub) return <div className="text-black">Sub-section not found.</div>;

      try {
        const SubComponent = sub.component;
        return <SubComponent />;
      } catch (error) {
        console.error('Error rendering component:', error);
        return <div className="text-red-500">Error loading component</div>;
      }
    }

    return (
      <>
        <h2 className="roboto-slab-bold text-lg sm:text-2xl text-black mb-2 leading-tight">
          {currentCategory.title}
        </h2>
        <p className="roboto-slab-regular text-sm sm:text-base text-black mb-8 leading-snug">
          {currentCategory.description}
        </p>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-white relative">
      {/* Mobile-Only View */}
      <div className="block sm:hidden w-full h-screen bg-white flex flex-col items-center justify-center">
        <Image
          src="/images/zeroshot_bio_gritty.png"
          alt="zeroshot logo"
          width={250}
          height={250}
          className="object-contain mb-4"
        />
        <h3 className="text-base text-center roboto-slab-light text--black pt-8 px-16">
          The data room is formatted for viewing on desktop computers.
        </h3>
        <h3 className="text-base text-center roboto-slab-light text-gray-black pt-8 px-16">
          You <strong>can</strong> rotate your screen horizontally to preview it from here.
        </h3>
      </div>

      {/* Desktop Layout */}
      <div className="hidden sm:flex justify-center w-full">
        <div
          className={`w-full max-w-[1600px] flex transition-filter duration-200 ${
            accessGranted ? 'blur-0' : 'blur-sm'
          }`}
          style={{ minWidth: '640px' }}
        >
        {/* Left Sidebar */}
        <aside className="flex flex-col border-r border-semidark px-4 sm:px-6 py-6 sm:py-8 w-[23%] max-w-[320px] sticky top-0 bg-gray-50 overflow-y-auto">
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
                const subSections = cat.subSections || [
                    { id: cat.id, title: cat.title, component: cat.component! },
                ];

                return (
                    <div
                    key={cat.id}
                    className="my-2 border border-gray-200 rounded-lg overflow-hidden"
                    >
                    <button
                        onClick={() => handleToggleCategory(cat.id)}
                        className={`flex items-center w-full px-3 py-2 focus:outline-none transition-colors duration-100 text-left ${
                        isSelected ? 'bg-gray-200 text-black' : 'bg-white hover:bg-gray-100'
                        }`}
                    >
                        <span
                        className={`inline-block transform transition-transform duration-500 ease-in-out mr-2 text-sm ${
                            isExpanded ? 'rotate-90' : ''
                        }`}
                        >
                        &gt;
                        </span>
                        <span className="flex-1 text-sm roboto-slab-medium">
                        {cat.title}
                        </span>
                    </button>
                    <div
                        className={`pl-2 pr-2 bg-gray-50 transition-all duration-500 ease-in-out ${
                        isExpanded ? 'max-h-[500px] py-2' : 'max-h-0 py-0'
                        } overflow-hidden`}
                    >
                        {subSections.map(sub => {
                        const subSelected = selectedSubSectionId === sub.id;
                        return (
                            <button
                            key={sub.id}
                            onClick={() => handleSelectSubSection(cat.id, sub.id)}
                            className={`w-full mb-2 px-3 py-2 rounded text-left transition-colors duration-100 text-xs ${
                                subSelected ? 'bg-gray-200 text-black' : 'bg-white hover:bg-gray-100'
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
            {/* Top Header Bar */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 z-10">
              <h1 className="roboto-slab-semibold text-base sm:text-xl text-black">
                Investor Data Room
              </h1>
            </div>
            {/* Second Header Bar */}
            <div className="sticky top-[40px] sm:top-16 bg-white border-b border-gray-200 px-4 sm:px-6 py-2 z-10 transition-all duration-100">
              <h2 className="roboto-slab-medium text-sm sm:text-lg text-black">
                {currentCategory?.title}
              </h2>
            </div>

            {/* Main content with text limited to 80% width */}
            <div className="px-4 sm:px-0 pt-6 pb-32 sm:pt-12 sm:ml-[28px] max-w-[60%] mx-auto">
              {renderContent()}

              {nextSubSection && (
                <div className="flex justify-left mt-4">
                  <button
                    onClick={() => handleSelectSubSection(selectedCategoryId, nextSubSection.id)}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-black px-4 py-2 rounded shadow transition-colors"
                  >
                    Next: {nextSubSection.title}
                  </button>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Password Overlay */}
      {!accessGranted && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/20 backdrop-blur-sm">
          <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-lg max-w-sm w-full mx-4">
            <h2 className="roboto-slab-semibold text-black text-xl mb-4">
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
