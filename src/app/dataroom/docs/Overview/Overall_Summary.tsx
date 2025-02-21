'use client';
import React from 'react';
import Image from 'next/image';

const OverallSummary: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        Bird’s-Eye View
      </h2>


      <p className="roboto-slab-light text-base mb-12 mt-12 leading-relaxed">
        <strong>The Problem</strong> is straightforward: our iniability to understand biology has limited
         therapeutic development. 
        Most drug candidates tested in pre-clinical conditions
        fail in human clinical trials.
        Potentiall life-saving opportunities never make it to market.
      </p>
      

      <p className="roboto-slab-light text-base text-verydark leading-relaxed">
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

      


      <p className="roboto-slab-light text-base text-verydark mb-4 mt-12 leading-relaxed">
        <strong>Tactically speaking, </strong> 
        AI&#39;s core competency is in understanding the complexity of high-dimensional networks
        when large amounts of diverse training datum are available. 
        That's why we've chosen <strong><i>Danio rario</i> (zebrafish)</strong> as our first model organism: 
        zebrafish are uniquely positioned for scale, experimental diversity, and measurability.
      
        Over time we'll incorporate other model organisms toward effective
        prediction of perturbation outcomes in human biology.
      </p>

      <p className="mt-12"></p>
        <strong> We run the data cycle continuously </strong> over the life of the company to keep improvng our
        biological foundation models. Each turn of the cycle involves growing zebrafish,
        creating healthy, disease, and perturbation varieties,
        performing scRNA sequencing, using the results to train and fine-tune our model,
        learn from the inference results, and design the next generation of
        experiments to intelligently fill data gaps and enhance capabilities.  
      </p>

      <div className="w-full mb-20">
        <Image
          src="/images/dataroom_images/overall_fundamental_flow.png"
          alt="Overall Flow Graphic"
          width={1000}
          height={600}
          className="object-contain"
        />
      </div>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
       <strong> Our biology foundation model </strong>predicts
       the gene expression patterns of cells
       under different disease and drug conditions.
        Most therapeutics are either toxic or effective because of their impact on an organism's gene expression patterns.
        A drug's ability to reliably improve gene expression patterns is what ultimatlye determines its success. 
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        Not only does our model predict a drug's impact on transcriptomic state changes, 
        it also captures contextual gene-gene relationships and long-range dependencies across 
        cell types delivers fundamentally more important insights.
      </p>

      <div className="w-full mb-20">
        <Image
          src="/images/dataroom_images/input-output.png"
          alt="IO-healthy-disease"
          width={500}
          height={400}
          className="object-contain"
        />

      </div>


      <p className="roboto-slab-light text-base text-verydark mb-12 leading-relaxed">
        <strong>The Business Model</strong> we persue is something we're still considering. We can either sell access to our model
        to drug developers or begin to develop drugs ourselves. We're having conversations with advisors, successful founders,
        investors, and potential customers to help us make the right decision.
        
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-12 leading-relaxed">
        <strong>The Market Opportunity</strong> depends on our business model direction. If we persue the classic Saas model, 
        the pre-clinical development market is our target. IF we develop our own drug candidates, ideally we'd follow the private
        Schrondinger persued by selling phase-I-ready drug candidates to larger pharma developers.          
      </p>

      <p className="roboto-slab-light text-base text-verydark leading-relaxed">
        <strong>Our thinking on the competitive landscape</strong> is that specialized models that serve specialized functions will 
        thrive -- especially in biolgoy. Zeroshot Biolabs is hyper-focused on creating our own data from multiple animal models 
        and our own specialized architectures that translate that data to human-drug-responsese results that will deliver the strongest 
        predictions for drug development of indications where cures depend most on gene regulatory network control. 
      </p>
    </>
  );
};

export default OverallSummary;
