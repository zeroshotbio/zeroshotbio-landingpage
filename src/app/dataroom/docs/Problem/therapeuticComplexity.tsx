'use client';
import React from 'react';
import Image from 'next/image';

const TherapeuticComplexity: React.FC = () => {
  return (
    <div>
      <h2 className="roboto-slab-semibold text-xl text-gray-800 mb-4">
        Problem Overview
      </h2>
      <div className="flex flex-col gap-6">
        {/* Text Section */}
        <div>
          <p className="roboto-slab-regular text-base text-gray-700 leading-relaxed mb-4">
            Here we explain the major challenges facing drug development today, including declining success rates,
            inefficiencies in traditional pipelines, and the high cost of late-stage failures.
          </p>
          <p className="roboto-slab-regular text-base text-gray-700 leading-relaxed">
            Established preclinical methods often struggle to capture the complex interplay of biological factors,
            resulting in missed indicators that could prevent costly failures. This section details how traditional
            assays fall short in predicting the clinical viability of new therapeutic candidates.
          </p>
        </div>
        {/* Full-width Interactive Treemap via an iframe */}
        <div>
          <iframe
            src="/d3_complexity_heatmap.html"
            className="w-full h-[910px] border border-gray-300"
            title="D3 Treemap"
          ></iframe>
        </div>
      </div>
    </div>
  );
};

export default TherapeuticComplexity;
