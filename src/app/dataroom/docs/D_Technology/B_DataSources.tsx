'use client';
import React from 'react';
import Image from 'next/image';

const C_DataSources: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        Our Multi‐Faceted Data Sources
      </h2>

      <p className="roboto-slab-light text-base mb-4 mt-12 leading-relaxed">
        <strong>We believe the strength of any biological foundation model depends on the breadth and depth of its data sources.</strong> 
        tsGPT relies on high‐quality single‐cell data from a variety of species—both publicly available 
        and proprietary—along with internally generated datasets that capture condition‐specific or pathway‐specific variations.
      </p>

      <p className="roboto-slab-light text-base mb-8 mt-2 leading-relaxed">
        By tapping into well‐validated public repositories, we ensure that tsGPT has a robust baseline 
        knowledge of transcriptomic variation across different organisms and disease contexts. Meanwhile, 
        privately generated datasets allow us to tailor the model to particular therapeutic pathways, 
        offering insight into novel drug targets or specialized applications. This dual sourcing strategy 
        keeps tsGPT universally relevant and highly customizable.
      </p>


      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        1. Publicly Available Single‐Cell Repositories
      </h3>
      <p className="roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <strong>These large‐scale repositories provide the essential foundation for tsGPT’s multi‐species coverage.</strong> 
        By integrating tens of millions of single‐cell transcriptomes from sources such as the Sequence Read Archive (SRA), 
        the Gene Expression Omnibus (GEO), ENCODE, and EBI‐ENA, we capture biologically diverse contexts.  
        Tabula Muris, Tabula Sapiens, and other comprehensive atlases help us map baseline transcriptomes across 
        multiple tissues and life stages in mice and humans, while curated zebrafish data sets from ZFIN 
        offer developmentally staged profiles. This breadth ensures tsGPT understands core gene regulatory patterns 
        that are evolutionary conserved and can generalize to new experimental settings.
      </p>

      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        2. Partner & Consortium Data
      </h3>
      <p className="roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <strong>We collaborate with a range of industry and academic groups</strong> to gain access to specialized 
        single‐cell data relevant to drug development. These partner‐provided datasets often focus on specific disease 
        niches, such as neurodegenerative disorders or oncology subtypes, enabling tsGPT to learn how certain pathways 
        differ between healthy and diseased states. Because these data are typically well‐annotated and derived from 
        carefully designed experiments, they offer high signal‐to‐noise ratios for the model. By merging them with 
        the public data, we ensure that our predictions remain broadly grounded yet also finely tuned to real‐world 
        therapeutic challenges.
      </p>

      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        3. Internal, Pathway‐Specific Generative Data
      </h3>
      <p className="roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <strong>For high‐priority targets or custom client requests, we generate entirely new single‐cell data in‐house.</strong> 
        These efforts might involve performing CRISPR‐based perturbations in zebrafish or mice to isolate effects 
        on specific pathways (e.g., Wnt signaling, TNF‐alpha, or MAPK modules). We also apply advanced spatial 
        transcriptomics to capture gene expression changes within distinct tissue microenvironments, offering a 
        higher‐resolution view of how drugs impact local cell populations. This proprietary data is integrated back 
        into tsGPT’s training corpus, making the model uniquely equipped to address specialized R&D questions 
        while maintaining its broader multi‐species perspective.
      </p>


      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        4. Proprietary Drug‐Indication Libraries
      </h3>
      <p className="roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <strong>Beyond customer‐driven data generation,</strong> we invest in collecting single‐cell drug response 
        data sets for indications in which we foresee building our own pipeline of novel therapeutics. These include 
        key areas such as metabolic disorders, certain cancers, and inflammatory diseases. By actively profiling how 
        different candidates modulate specific gene networks, we’re amassing a private repository of “drug expression 
        fingerprints” that tsGPT can leverage. This approach not only accelerates our internal R&D but also 
        underpins more confident predictions for future external collaborations and licensing opportunities.
      </p>


      <p className="roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <strong>By coupling publicly curated data and proprietary datasets,</strong> we maintain tsGPT’s 
        foundational breadth without sacrificing the specificity required for cutting‐edge drug development. 
        This carefully orchestrated data ecosystem is constantly expanding, with new single‐cell profiles, 
        tissue types, drug perturbations, and clinical metadata feeding the model’s growing knowledge base.
      </p>

      <p className="roboto-slab-light text-base text-verydark mt-12 mb-12 leading-relaxed">
        <strong>The result?</strong> A dynamically updated resource that keeps tsGPT aligned with the 
        latest biological findings, enabling robust cross‐species toxicity predictions, 
        target prioritization, and pathway insights that can be operationalized throughout 
        the drug discovery pipeline.
      </p>
    </>
  );
};

export default C_DataSources;
