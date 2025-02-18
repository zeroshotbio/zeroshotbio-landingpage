'use client';
import React from 'react';
import Image from 'next/image';

const OverallSummary: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-semibold text-xl text-black mb-8 mt-4">
        Bird’s-Eye View
      </h2>


      <p className="roboto-slab-regular text-base text-verydark mb-8 mt-12 leading-relaxed">
        <strong>The Problem</strong> is straightforward: pre-clinical experiments are 
        failing to effectively predict clinical trial results.

        Many promising therapies never see the light of day 
        because developers lack solid preclinical data needed to
        steer critical go/no-go decisions.
        
        As a result, R&amp;D 
        budgets balloon, timelines stretch, and potential
        life-saving treatments never make it to market.
      </p>

      <p className="roboto-slab-regular text-base text-verydark mb-4 mt-10 leading-relaxed">
        <strong>Our Vision</strong> is that biological foundation models will enable a deeper enderstanding 
        of the toxicity and efficacy effects of therapeutics on entire organisms. 
        Not just higher quality readings, different kinds of insights than have ever been possible before.

      <p className="mt-4">
        You can think of Zeroshot Biolab's first chapter as AI-bio <i>interrogability</i> company. 
      </p> 
      <p className="mt-4">
        That is, our first mission is to make biology more <i>capable of being iterrogated.</i> 
      </p>
      
      <p className="mt-4">
      We're learning to understand the dance between chaos and structure inherent to biology 
      and become masters of effectively communicating that understanding to drug developers.
      </p>


      <p className="roboto-slab-regular text-base text-verydark mb-4 mt-10 leading-relaxed">
        <strong>Tactically speaking, </strong> 
        we know AI&#39;s core competency is in understanding the complexity of high-dimensional networks
        when large amounts of diverse training data is available. 

      <p className="mt-4"></p>
        That's why we&#39;re begining with the modest model organism <i>Danio rario</i> (Zebrafish).
        We've selected zebrafish because we're confident we can scale with it. 
      </p>

      <p className="mt-8"></p>
        <strong> The data cycle </strong>we will run continuously over the life of the company to keep our
        biological foundation models at the bleeding edge. Each turn of the cycle involves growing up zebrafish,
        creating healthy, disease models, and perturbation varieties based on conditions-of-interest,
        sequencing them transcriptmically (scRNA-seq), training, fine-tuning, and re-training,
        learning from the results, then designing new batches of experiments to fill gaps and enhance capabilities.  
      </p>

      <div className="w-full mb-8">
        <Image
          src="/images/dataroom_images/overall_fundamental_flow.png"
          alt="Overall Flow Graphic"
          width={1000}
          height={600}
          className="object-contain"
        />
      </div>

      <p className="roboto-slab-regular text-base text-verydark mb-4 leading-relaxed">
        <strong>Bio Foundation Models</strong> are
        transformer-based LLMs.
      </p>

      <p className="roboto-slab-regular text-base text-verydark mb-4 leading-relaxed">
        <strong>Biologist Perspective</strong>
      </p>

      <p className="roboto-slab-regular text-base text-verydark mb-4 leading-relaxed">
        Our <strong>Business Model</strong> blends high-value experimental services, data subscriptions, and 
        milestone-based collaborations with pharma. 
      </p>

      <p className="roboto-slab-regular text-base text-verydark mb-4 leading-relaxed">
        The <strong>Market Opportunity</strong> 
      </p>

      <p className="roboto-slab-regular text-base text-verydark leading-relaxed">
        <strong>Competitive Landscape</strong>, we stand out by maintaining end-to-end control—
        <em>from zebrafish to AI</em>—so every experiment enriches our core platform. This virtuous cycle of data 
        and insight is tough to replicate, and it’s why we believe Zeroshot Bio is the future of preclinical 
        confidence.
      </p>
    </>
  );
};

export default OverallSummary;
