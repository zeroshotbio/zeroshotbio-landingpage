'use client';
import React from 'react';
import Image from 'next/image';

const OverallSummary: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        Bird’s-Eye View
      </h2>


      <p className="roboto-slab-light text-base mb-8 mt-12 leading-relaxed">
        <strong>The Problem</strong> is straightforward: pre-clinical experiments too often 
        fail to effectively predict clinical trial results.

        Many promising therapies never see the light of day 
        because developers lack the preclinical confidence needed to
        steer critical go/no-go decisions.
        
        As a result, R&amp;D 
        budgets balloon, timelines stretch, and potential
        life-saving treatments never make it to market.
      </p>
      

      <p className="roboto-slab-light text-base text-verydark mb-4 mt-10 leading-relaxed">
        <strong>Our Vision</strong> is that biological foundation models will enable a never-before-possible
        understanding of the toxicity and efficacy of therapeutics on entire organisms. 
        Not just higher quality readings, but entirely new categories of visibility that will open up new drug 
        development approaches. 

      <p className="mt-4">
        In this first chapter, you can think of <strong>  Zeroshot Biolabs as an AI-bio interrogability company. </strong>
        That is, our first focus is to use AI as a lens to make the chaos of biology more capable of being deeply understood,
        especially in the context of drug development.
        We're starting with the 'action' layer of biology -- transcriptomics. 
      </p>

      


      <p className="roboto-slab-light text-base text-verydark mb-4 mt-10 leading-relaxed">
        <strong>Tactically speaking, </strong> 
        AI&#39;s core competency is in understanding the complexity of high-dimensional networks
        when large amounts of diverse training datum are available. 

      <p className="mt-4"></p>
        That's why we've chosen <strong><i>Danio rario</i> (zebrafish)</strong> as our first model organism: 
        zebrafish are uniquely positioned for scale, experimental diversity, and measurability.
      
        Over time we'll incorporate other model organisms toward effective
        prediction of perturbation outcomes in human biology.
      </p>

      <p className="mt-8"></p>
        We will run <strong>The Data Cycle </strong> continuously over the life of the company to keep improvng our
        biological foundation models (pictured below). Each turn of the cycle involves growing up the animal model,
        creating healthy, disease, and perturbation varieties based on conditions-of-interest,
        sequencing them transcriptmically (scRNA-seq), training, fine-tuning, re-training,
        learning from the results, and designing new batches of experiments to fill gaps that enhance capabilities.  
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

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
       <strong>Drug developers interacting with our models </strong>will use an input-output framework.
      </p>
      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
       1. Given a disease-profile and a healthy-profile, what series of transcriptomic transformations could bridge the gap?
      </p>
      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
       2. Given a disease-profile and the expected effects of a drug, is a h
      </p>


      <div className="w-full mb-8">
        <Image
          src="/images/dataroom_images/input-output.png"
          alt="IO-healthy-disease"
          width={1000}
          height={600}
          className="object-contain"
        />
      </div>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        Our <strong>Business Model</strong> blends high-value experimental services, data subscriptions, and 
        milestone-based collaborations with pharma. 
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        The <strong>Market Opportunity</strong> 
      </p>

      <p className="roboto-slab-light text-base text-verydark leading-relaxed">
        <strong>Competitive Landscape</strong>, we stand out by maintaining end-to-end control—
        <em>from zebrafish to AI</em>—so every experiment enriches our core platform. This virtuous cycle of data 
        and insight is tough to replicate, and it’s why we believe Zeroshot Bio is the future of preclinical 
        confidence.
      </p>
    </>
  );
};

export default OverallSummary;
