'use client';
import React from 'react';

const C_CustomerStrategyOverview: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        Customer Segments Overview
      </h2>

      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        Zeroshot Biolabs strategically targets three distinct customer segments, each characterized by unique profiles, priorities, and operational contexts. Understanding these customers enables us to tailor our solutions to meet their specific needs effectively.
      </p>

      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        1. SaaS Platform Customers: Biotechs, CROs, and Academia
      </h3>
      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        Our SaaS customers primarily include biotechnology firms, Contract Research Organizations (CROs), and academic research groups engaged in early-stage therapeutic discovery. Biotech customers are typically agile teams focused on specialized therapeutic areas, where speed, precision, and resource efficiency are paramount. They seek user-friendly, reliable tools that integrate easily into their current workflows, allowing rapid iteration without extensive in-house bioinformatics infrastructure.
      </p>
      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        CRO customers require scalable, standardized solutions to consistently deliver high-quality results to their own pharmaceutical clients. They value accuracy, ease-of-use, and reproducibility in transcriptomic modeling. Academic institutions, on the other hand, prioritize affordability and flexibility, using tsGPT to enhance their research outcomes, publish groundbreaking results, and secure funding through innovative transcriptomic insights.
      </p>

      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        2. Big Pharma Licensing Customers: Established Pharmaceutical Corporations
      </h3>
      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        Licensing customers encompass large, well-established pharmaceutical companies seeking high-value, de-risked therapeutic candidates. These corporations often have significant financial resources but face internal pressures to streamline their R&D processes, reduce attrition rates, and accelerate clinical timelines. Their interest in Zeroshot Biolabs stems from our ability to provide thoroughly validated, transcriptomically optimized drug candidates, particularly in high-stakes therapeutic areas such as oncology, immunology, and rare diseases.
      </p>
      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        These customers are inherently risk-averse and therefore strongly value preclinical confidence. Our ability to demonstrate transcriptomic clarity around target safety, efficacy, and potential off-target effects significantly enhances our offerings&apos; attractiveness. Consequently, these pharmaceutical partners seek deep, collaborative relationships that align with their long-term strategic pipelines and clinical ambitions.
      </p>

      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        3. Drug Repurposing and Combination Therapy Customers: Specialty Pharma and Clinical Innovators
      </h3>
      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        Our third customer segment comprises specialty pharmaceutical companies and clinical-stage innovators looking to rapidly advance treatments through intelligent drug repurposing and multi-target therapeutic strategies. These customers are often entrepreneurial and market-responsive, operating under tight timelines to bring effective treatments to patients in underserved therapeutic areas. They recognize the value of leveraging existing, clinically validated compounds or biologics, seeking to extend their therapeutic potential efficiently.
      </p>
      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        These customers highly value our capability to identify novel therapeutic combinations or repurposing opportunities quickly. They seek to leverage Zeroshot Biolabs’ expertise in transcriptomic modeling to uncover overlooked therapeutic possibilities, shorten development timelines, reduce clinical trial risk, and ultimately accelerate regulatory approval and market entry.
      </p>

      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        <strong>Unified Customer Vision:</strong> Across all three segments, our customers share a common need: accurate, actionable, transcriptomic insights that streamline drug development and reduce the risk of costly clinical failures. By deeply understanding each customer segment’s unique characteristics and strategic imperatives, Zeroshot Biolabs positions itself as an essential partner in the evolving landscape of AI-driven drug discovery.
      </p>
    </>
  );
};

export default C_CustomerStrategyOverview;
