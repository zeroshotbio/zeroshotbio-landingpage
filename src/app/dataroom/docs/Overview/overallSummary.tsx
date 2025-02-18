'use client';
import React from 'react';
import Image from 'next/image';

const OverallSummary: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-semibold text-xl text-black mb-8">
        Bird’s-Eye View
      </h2>


      <p className="roboto-slab-regular text-base text-verydark mb-4 leading-relaxed">
        <strong>The Problem</strong> is straightforward: early-stage trials fail too often, and the repercussions 
        ripple throughout the entire drug development pipeline. Many promising therapies never see the light of day 
        because we lack the solid preclinical data needed to steer critical go/no-go decisions. As a result, R&amp;D 
        budgets balloon, timelines stretch, and potential life-saving treatments never make it to market.
      </p>

      <p className="roboto-slab-regular text-base text-verydark mb-4 leading-relaxed">
        <strong>Our Vision</strong> is to revolutionize how drugs are vetted by using 
        <em> scalable zebrafish assays integrated with advanced single-cell analytics</em>. We aim to deliver 
        actionable insights before a molecule ever reaches a patient, allowing scientists to zero in on the most 
        promising leads while cutting the staggering costs tied to late-stage failures. This proactive approach 
        builds confidence and efficiency at every step of the pipeline.
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
        <strong>Bio Foundation Models</strong> power this transformation. We’ve developed advanced 
        transformer-based architectures, trained on extensive single-cell datasets, to detect subtle gene-level 
        risks and opportunities that conventional screens tend to overlook. By merging computational muscle with 
        rigorous biological data, we deliver precise, nuanced predictions that drive smarter, faster decisions.
      </p>

      <p className="roboto-slab-regular text-base text-verydark mb-4 leading-relaxed">
        <strong>Biologist Perspective</strong> ensures our AI is far more than a black box. We connect mechanistic 
        insights to real-world experiments, illuminating why certain candidates might fail or excel. This loop 
        between lab validation and AI outputs builds trust in our results, enabling development teams to act with 
        greater conviction and clarity.
      </p>

      <p className="roboto-slab-regular text-base text-verydark mb-4 leading-relaxed">
        Our <strong>Business Model</strong> blends high-value experimental services, data subscriptions, and 
        milestone-based collaborations with pharma. By offering rapid zebrafish screens paired with single-cell 
        readouts, we cater to diverse R&amp;D objectives—from small biotech startups to established enterprises. 
        Modular pricing and pay-for-performance structures make it easy for clients to scale with us as their 
        pipelines grow.
      </p>

      <p className="roboto-slab-regular text-base text-verydark mb-4 leading-relaxed">
        The <strong>Market Opportunity</strong> is clear: as sequencing costs plummet and the race for better 
        preclinical screening heats up, mid-tier biotechs, CROs, and larger pharma companies need a more 
        cost-effective way to decide which candidates to back. By delivering granular single-cell data early in 
        development, we help them eliminate weak leads fast and focus resources on winners, providing a decisive 
        edge in a competitive market.
      </p>

      <p className="roboto-slab-regular text-base text-verydark leading-relaxed">
        In a crowded <strong>Competitive Landscape</strong>, we stand out by maintaining end-to-end control—
        <em>from zebrafish to AI</em>—so every experiment enriches our core platform. This virtuous cycle of data 
        and insight is tough to replicate, and it’s why we believe Zeroshot Bio is the future of preclinical 
        confidence.
      </p>
    </>
  );
};

export default OverallSummary;
