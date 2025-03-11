'use client';
import React from 'react';
import Image from 'next/image';

const C_MarketOpportunity: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        Market Opportunity Overview
      </h2>

      <p className="roboto-slab-light text-base mb-10 mt-12 leading-relaxed">
        <strong>A Transformative Moment in Drug Discovery.</strong> The AI-driven drug discovery market in North America is undergoing rapid expansion. Currently valued at approximately $1 billion, it&apos;s projected to grow nearly twenty-fold, reaching approximately $19.7 billion by 2029 at a compound annual growth rate of around 45%. Companies leveraging AI to reduce costly failures and optimize therapeutic efficacy can expect premium subscription revenues and significant investor interest, underscoring substantial short-term upside potential.
      </p>

      <div className="w-full mb-8">
        <figure className="text-left">
          <Image
            src="/images/dataroom_images/pharma_ai_adoption.png"
            alt="tsGPT architecture"
            width={500}
            height={300}
            className="object-contain"
          />
          <figcaption className="roboto-slab-extralight text-xxsm text-gray-dark mt-4">
            A schematic of the tsGPT pipeline, from multi-species single-cell data integration
            and gene regulatory network inference, through adjacency-aware transformers.
          </figcaption>
        </figure>
      </div>

      <div className="w-full mb-8">
        <figure className="text-left">
          <Image
            src="/images/dataroom_images/beachead_ai_adoption.png"
            alt="tsGPT architecture"
            width={500}
            height={300}
            className="object-contain"
          />
          <figcaption className="roboto-slab-extralight text-xxsm text-gray-dark mt-4">
            Our advanced AI-driven analysis provides deep biological insights into therapeutic response pathways.
          </figcaption>
        </figure>
      </div>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
        <strong>Focusing on Disease Pathways, Not Chemistry.</strong> Zeroshot Biolabs excels in decoding complex transcriptomic landscapes to illuminate disease mechanisms and predict therapeutic outcomes. Unlike chemical structure design firms, we focus intensively on biological pathways, identifying high-value protein targets and repurposing opportunities based on deep systems biology insights. This distinct capability significantly enhances our competitive positioning in the market.
      </p>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
        <strong>The SaaS Revolution in Drug Discovery.</strong> Our Software-as-a-Service (SaaS) transcriptomic analysis platform addresses an urgent need in biotech and academia—interpreting massive single-cell and transcriptomic datasets. Comparable industry platforms, such as Benchling, achieve robust revenue, averaging over $175K per customer annually. Zeroshot Biolabs anticipates capturing premium subscription fees by empowering clients to avoid costly development missteps, ultimately saving tens to hundreds of millions of dollars in R&D expenditures. Realistically, our platform could generate annual recurring revenues reaching eight figures within three to five years.
      </p>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
        <strong>Drug Candidate Development and Licensing.</strong> Following precedents like the landmark Schrödinger-Nimbus-Takeda deal—where an AI-driven drug candidate commanded $4 billion upfront—we aim to develop select AI-informed drug candidates to a compelling preclinical or early clinical proof-of-concept stage. Licensing such assets in North America frequently attracts upfront payments ranging from tens to hundreds of millions of dollars, with total deal values potentially exceeding a billion dollars when milestones and royalties are factored in. This proven pathway presents a high-return revenue stream without direct involvement in chemical synthesis.
      </p>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
        <strong>Unlocking the Power of Drug Repurposing.</strong> Our platform&apos;s capability to systematically evaluate hundreds of drugs against numerous disease contexts positions us strongly within the rapidly growing North American drug repurposing market, expected to increase by over $4 billion within the next five years. AI-driven repurposing dramatically reduces clinical timelines from the typical 7–10 years down to just 3–5 years, cutting R&D costs by approximately 40–60%. A successfully repurposed drug candidate could yield licensing agreements with upfront payments of $10–30 million and milestones reaching $50–100 million, presenting investors with accelerated and significant ROI.
      </p>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
        <strong>A Proven Market Blueprint.</strong> The recent successes of AI-focused biotech deals—including Schrödinger, Exscientia, Nimbus, and Insilico Medicine—provide strong market validation for Zeroshot’s business model. These precedents clearly demonstrate that companies can achieve substantial valuation uplift, premium licensing terms, and successful drug repositioning strategies through dedicated application of advanced AI in disease pathway analysis.
      </p>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
        <strong>A Clear Path Forward.</strong> Zeroshot Biolabs&apos; strategic focus on SaaS-driven transcriptomic analysis, targeted drug candidate licensing, and innovative repurposing programs uniquely positions us to capture a meaningful share of the rapidly expanding AI-driven drug discovery market. By leveraging sophisticated transcriptomic insights to enhance preclinical confidence, we aim to generate considerable returns for investors while accelerating the delivery of safer, more effective therapeutics to patients.
      </p>


      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        References
      </h3>
      <ul className="roboto-slab-light text-sm text-gray-dark list-disc pl-5 space-y-2">
        <li>
          Benchling Annual Revenue and Valuation Report (2024). Benchling Financials & Market Data.
        </li>
        <li>
          Thermo Fisher Scientific Acquisition Announcement (2023). Transcriptomics Analytics Platform Acquisition.
        </li>
        <li>
          Exscientia and Sanofi Strategic Collaboration Press Release (2022). Sanofi Investor Relations.
        </li>
        <li>
          Insilico Medicine and Sanofi AI Partnership Announcement (2022). PharmaTimes, Industry News.
        </li>
        <li>
          Atomwise and Sanofi Drug Discovery Collaboration (2020). BusinessWire Press Release.
        </li>
        <li>
          Nimbus Therapeutics Sale of TYK2 inhibitor to Takeda for $4 Billion (2022). Nimbus Therapeutics Corporate Announcement.
        </li>
        <li>
          Nimbus Therapeutics ACC inhibitor Licensing Deal with Gilead Sciences (2016). FierceBiotech Industry Analysis.
        </li>
        <li>
          Recursion Pharmaceuticals AI-driven Repurposing Collaboration with Roche/Genentech (2022). Recursion Pharmaceuticals Investor Update.
        </li>
        <li>
          Technavio Drug Repurposing Market Size and Forecast Report (2023–2028). Technavio Research.
        </li>
        <li>
          Bioinformatics AI Market Growth and Forecast (2021–2029). Market Research Reports, Data Bridge.
        </li>
        <li>
          Transcriptomics Market Size and Trends Analysis (2022–2030). Grand View Research Market Insights.
        </li>
        <li>
          Cost and Efficiency Analysis of Drug Repurposing versus Novel Drug Development (2022). Drug Discovery Today, Industry Journal.
        </li>
        <li>
          Celgene Thalidomide Repurposing Success Analysis (2020). Nature Reviews Drug Discovery.
        </li>
      </ul>


    </>



  );
};

export default C_MarketOpportunity;

