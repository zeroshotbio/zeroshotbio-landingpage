'use client';
import React from 'react';
import Image from 'next/image';

const DrugDevelopmentPipeline: React.FC = () => {
  return (
    <div>
      <h2 className="roboto-slab-semibold text-xl text-gray-800 mb-4">
        Detailed Problem Analysis
      </h2>
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Text Column */}
        <div className="flex-1">
          <p className="roboto-slab-regular text-base text-gray-700 leading-relaxed mb-4">
            The drug development pipeline has long been plagued by inefficiencies and a growing crisis of confidence.
            Despite billions in investments, early-stage clinical trials continue to show alarmingly low success rates.
            This decline is largely driven by the complexity of human biology and the limitations of traditional preclinical models.
          </p>
          <p className="roboto-slab-regular text-base text-gray-700 leading-relaxed mb-4">
            Traditional animal models, such as rodents, often fail to capture the nuanced, dynamic interactions of gene networks
            that are critical for predicting both toxicity and efficacy. In addition, static assays provide only a snapshot of
            cellular activity—missing the emergent phenomena that dictate a drug’s true potential. These shortcomings lead to
            costly late-stage failures and lost opportunities.
          </p>
          <p className="roboto-slab-regular text-base text-gray-700 leading-relaxed">
            These challenges underscore the urgent need for a paradigm shift in preclinical testing—one that leverages high-resolution,
            single-cell data and advanced AI analytics to deliver early, actionable insights.
          </p>
        </div>
        {/* Image Column */}
        <div className="w-full sm:w-1/2">
          <Image 
            src="/images/dataroom_images/Re-Done Clinical Trials Graphic.png"
            alt="Revised Clinical Trials Graphic"
            width={800}
            height={450}
            className="object-contain"
          />
        </div>
      </div>
    </div>
  );
};

export default DrugDevelopmentPipeline;
