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
        <strong> Through the lens of an AI-biology company like Zeroshot, </strong>
          disease categories that require transcriptomically-complex interventions are also 
          the most optimal to target and specialize in.
      </p>

      <p className="roboto-slab-light text-base mb-4 mt-4 leading-relaxed">
          Disease pathways that require the deepest understanding of complex gene networks 
          are also the most difficult for scientists using classical methods to make progress on. 
          It's in these categories that biology foundation models will most significantly move the needle.
      </p>

      <p className="roboto-slab-light text-base mb-4 mt-4 leading-relaxed">
        Here, the top ~300 successfully approved drugs organized by: 
        <ul className="text-gray-dark roboto-slab-regular text-xm mt-2">
          <li> 
            - Disease category
          </li>         
          <li> 
            - Transcriptomic complexity 
            <span className="roboto-slab-light text-xsm text-gray-light"> (dark orange vs light blue)</span>
          </li>        
          <li> 
            - Monetary impact 
            <span className="roboto-slab-light text-xsm text-gray-light"> (rectangle size)</span>
          </li> 
        </ul>
      </p>


      <div className="w-full">
        <figure className="text-left m-0">
          <iframe
            src="/d3_complexity_heatmap.html"
            className="w-full h-[970px] block"
            title="D3 Treemap"
          ></iframe>
          <Image
            src="/images/dataroom_images/tree_map_legend.png"
            alt="IO-healthy-disease"
            width={630}
            height={100}
            className="object-contain mt-0"
          />
        </figure>
      </div>


      <p className="roboto-slab-light text-base mt-10 leading-relaxed">
        <strong> As you can see, </strong>a large portion of approved therapeutics have 
        involved complex gene networks. Disease categories like cancer, autoimmune, gene therapy,
        and transplant stand out. 
      </p>

      <p className="roboto-slab-light text-base mt-8 mb-8 leading-relaxed">
        <strong> However, we have to remember that this map is essentially a snapshot of 
        the past. </strong> It represents the successes of drug development from classical methods 
        over the past century. Many of the diseases we've succeeded in creating cures for have been 
        the surprisingly easy 'low-hanging-fruit'. Successes we've had in treating
        complex disease indications have either come as a result of a disproportionately massive research 
        effort combined with trial & error, or luck.  
      </p>

      <p className="roboto-slab-light text-base mt-4 mb-10 leading-relaxed">
        <strong> The next map is more important -- it shows
        disease indications that still need treatments. </strong> 
        If the previous visualization was map of the past, this is a map of the future. 
      </p>

      <p className="roboto-slab-light text-base mb-4 mt-4 leading-relaxed">
        Here, the top ~300 diseases humanity wants treatments for organized by:
        <ul className="text-gray-dark roboto-slab-regular text-xm mt-2">
          <li> 
            - Disease category
          </li>         
          <li> 
            - Transcriptomic complexity 
            <span className="roboto-slab-light text-xsm text-gray-light"> (dark orange vs light blue)</span>
          </li>        
          <li> 
            - Monetary impact 
            <span className="roboto-slab-light text-xsm text-gray-light"> (rectangle size)</span>
          </li> 
        </ul>
      </p>

      <div className="w-full">
        <figure className="text-left mb-16">
          <iframe
            src="/prospective_diseases_treemap.html"
            className="w-full h-[970px] block"
            title="D3 Treemap"
          ></iframe>
          <Image
            src="/images/dataroom_images/tree_map_legend.png"
            alt="IO-healthy-disease"
            width={630}
            height={100}
            className="object-contain mt-0"
          />
        </figure>
      </div>

      <p className="roboto-slab-light text-base mb-4 leading-relaxed">
        The difference between the first and second map speaks for itself: <strong> the disease indications
        we care most about developing treatments for are also the most transcriptomically complex. </strong>
        Scientists using classical methods continue to struggle to make tractable progress in these categories.
        Fundamentally new approaches are necessary to understand and create effective therapeutic strategies. 
      </p>

      <p className="roboto-slab-light text-base mb-20 leading-relaxed">
        We believe the future of drug development will being to rely heavily on 
        biological foundation models that help drug developers create sophisticated, fine-tuned drugs 
        that confidently interact with complex transcriptomic networks. 
      </p>

    </div>
  );
};

export default TherapeuticComplexity;
