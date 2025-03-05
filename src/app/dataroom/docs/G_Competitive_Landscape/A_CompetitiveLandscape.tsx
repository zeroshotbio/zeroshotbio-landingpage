'use client';
import React from 'react';
import Image from 'next/image';

const C_CompetitiveLandscape: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        Our Competitive Landscape: Strategic Positioning in a Growing Niche Ecosystem
      </h2>

      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        Our thinking on the emerging competitive landscape is that a diversity of specialized foundation models will each thrive in a growing landscape of niches. In this rapidly evolving field, companies are developing targeted solutions at every layer of the biology stack—from chemical structure analysis to protein folding and genomic editing.
      </p>

      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        <strong>Zeroshot Biolabs</strong> is uniquely positioned to lead the charge in transcriptomic effect modeling, with a singular focus on predicting human drug response. While other players concentrate on isolated aspects such as small molecule design or protein structure prediction, our approach leverages the rich detail inherent in single-cell transcriptomics, providing deep insights into how drugs affect gene regulatory networks across multiple species.
      </p>

      <div className="w-full mb-8">
        <figure className="text-left">
          <Image
            src="/images/dataroom_images/competitive_landscape.png"
            alt="Competitive Landscape Diagram"
            width={500}
            height={300}
            className="object-contain"
          />
          <figcaption className="roboto-slab-extralight text-xxsm text-gray-dark mt-4">
            Our model’s niche focus on transcriptomic effects positions us uniquely within an ecosystem of specialized AI-biotech players.
          </figcaption>
        </figure>
      </div>

      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        <strong>Key Differentiators:</strong>
      </p>
      <ul className="list-disc pl-8 roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <li>
          <strong>Transcriptomic Focus:</strong> We concentrate on decoding the full spectrum of gene expression, making us experts in capturing the cellular responses that underpin drug toxicity and efficacy.
        </li>
        <li>
          <strong>Multi-Species Integration:</strong> By leveraging data across zebrafish, mouse, rat, drosophila, and human, our models are trained to recognize evolutionary conservation and species-specific nuances—a competitive advantage that enables more accurate human predictions.
        </li>
        <li>
          <strong>Adjacency-Aware Modeling:</strong> Our unique incorporation of gene regulatory network information via adjacency matrices and layer indices empowers our platform to understand the intricate interplay of gene regulation, which is often overlooked by competitors.
        </li>
      </ul>

      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        We envision a collaborative ecosystem where Zeroshot Biolabs works synergistically with other AI-bio companies. Each player contributes to different layers of the drug development pipeline. For example, while partners might specialize in small molecule design or protein structure optimization, our focus on transcriptomic analysis fills a critical gap by forecasting drug response and toxicity with unparalleled depth.
      </p>

      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        By seamlessly integrating our models with complementary solutions, we not only enhance our own predictive capabilities but also drive value along the entire drug-development pipeline. Our strategic positioning ensures that we remain indispensable to partners and customers alike, whether through direct licensing, data-sharing collaborations, or integrated end-to-end screening platforms.
      </p>

      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        <strong>The competitive landscape is vast and evolving,</strong> yet our focused expertise in transcriptomic effect modeling positions Zeroshot Biolabs as a leader in this domain. With our unparalleled insights into human drug response, we are set to redefine standards in preclinical screening, ultimately reducing failures and expediting the journey from lab bench to bedside.
      </p>
    </>
  );
};

export default C_CompetitiveLandscape;
