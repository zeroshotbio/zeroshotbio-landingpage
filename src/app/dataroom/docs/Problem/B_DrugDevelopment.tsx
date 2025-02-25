'use client';
import React from 'react';
import Image from 'next/image';

const TherapeuticComplexity: React.FC = () => {
  return (
    <div>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        The Drug Development Landscape
      </h2>

      <p className="roboto-slab-light text-base mb-4 mt-12 leading-relaxed">
        <strong> Through the lens of an AI-first biology company, </strong> the disease 
          landscape is most productively organized as a hierarchy based on gene network complexity.
          Our strategic assumption here is that disease indications that depend on
          the most complex gene networks are the most problematic for 
          scientists using classical methods to make progress on.
      </p>

      <p className="roboto-slab-light text-base mb-4 mt-4 leading-relaxed">
        Below is an interactive visualization of ~200 of the top FDA-approved drugs arranged by
        disease category, complexity, and monetary impact. You can mouse over each square to get more info.
      </p>

      <div className="w-full mb-2">
        <figure className="text-left">
          <iframe
            src="/d3_complexity_heatmap.html"
            className="w-full h-[975px]"
            title="D3 Treemap"
          ></iframe>
        </figure>
      </div>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
        As you can see a large portion of approved therapeutics we care about involve complex gene networks.
      </p>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
        Next, a similar interactive visualization but this time as a projection looking forward toward the
        top ~300 indications of interest.
      </p>

      <div className="w-full mb-2">
        <figure className="text-left">
          <iframe
            src="/d3_complexity_heatmap.html"
            className="w-full h-[975px]"
            title="D3 Treemap"
          ></iframe>
        </figure>
      </div>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
        As you can see, the problem of successful drug development for the indication categories we care most
        about is tied considerably to gene regulatory network complexity. The future of drug development success
        may very well begin to rely heavily on biology foundation models that help drug developers understand
        how to best understand the disease and create more sophisticated drugs that can be designed with 
        fine-tune approach.
      </p>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
        Encouraging, data-rich resources are available but underutilized -- including transcriptomics. A perception
        of complexity, shortage of accessible computational methods, and a lack of established workflows have limited
        widespread adoption. For many disease indications, important confidence-enabling insights that would either
        flag toxicities or help fine-tune drug designs are being missed. 
      </p>

    </div>
  );
};

export default TherapeuticComplexity;
