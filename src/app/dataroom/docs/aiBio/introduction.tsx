'use client';
import React from 'react';

const Introduction: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-semibold text-xl text-gray-800 mb-4">
        Introduction
      </h2>
      <p className="roboto-slab-regular text-base text-gray-700 mb-4 leading-relaxed">
        Drug development today faces a severe crisis of confidence. Despite billions of dollars 
        invested annually, early-phase success rates have sharply declined. Traditional preclinical 
        methods often miss subtle toxicities and efficacy signals, leaving many promising therapeutic 
        candidates unproven.
      </p>
      <p className="roboto-slab-regular text-base text-gray-700 mb-4 leading-relaxed">
        Zeroshot Bio is tackling this challenge by building advanced biological foundation models using 
        large-scale single-cell transcriptomics in zebrafish. Our scalable, high-fidelity approach generates 
        massive, AI-ready datasets that enable earlier, more confident predictions in drug development.
      </p>
      <p className="roboto-slab-regular text-base text-gray-700 leading-relaxed">
        In the next section, we present our vision on Bio Foundation Models and demonstrate how this innovative 
        strategy can transform preclinical testing and accelerate therapeutic discovery.
      </p>
    </>
  );
};

export default Introduction;
