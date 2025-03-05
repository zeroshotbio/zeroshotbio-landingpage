'use client';
import React from 'react';
import Image from 'next/image';

const C_ScRNADataPlatform: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        scRNA: The Cornerstone of Our Data Platform
      </h2>

      <p className="roboto-slab-light text-base mb-4 mt-12 leading-relaxed">
        <strong>Single-cell RNA sequencing (scRNA) is the transformative technology that underpins our entire data platform.</strong> 
        By capturing gene expression at the resolution of individual cells, scRNA enables us to decipher the complex 
        heterogeneity inherent in biological systems. This high-resolution insight is the foundation upon which our 
        predictive models are built.
      </p>

      <p className="roboto-slab-light text-base mb-8 mt-2 leading-relaxed">
        Unlike traditional bulk RNA-sequencing methods that average signals over millions of cells, scRNA empowers us 
        to observe subtle cell-to-cell variations and dynamic responses. Our platform integrates scRNA data across multiple 
        species and conditions—ranging from developmental stages in zebrafish to disease states in humans—creating a 
        comprehensive atlas of gene regulatory networks that informs every prediction.
      </p>

      <div className="w-full mb-8">
        <figure className="text-left">
          <Image
            src="/images/dataroom_images/scRNA_platform.png"
            alt="scRNA data integration schematic"
            width={500}
            height={300}
            className="object-contain"
          />
          <figcaption className="roboto-slab-extralight text-xxsm text-gray-dark mt-4">
            Our scRNA integration pipeline captures individual cellular responses, creating a detailed map of gene regulation 
            across species and conditions.
          </figcaption>
        </figure>
      </div>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>At its core, our platform harnesses scRNA data to capture the true complexity of living systems.</strong> 
        This single-cell approach not only illuminates the underlying mechanisms driving cellular behavior but also 
        enables us to detect early signs of toxicity and predict drug efficacy with unparalleled precision. Through 
        rigorous quality control, normalization, and integration techniques, we transform raw scRNA datasets into 
        a unified, high-fidelity resource that fuels our AI-driven predictions.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>The advantages of scRNA are twofold:</strong> first, it reveals the diversity of cellular states, and second, 
        it uncovers how gene regulatory networks evolve under different perturbations—be they developmental, pathological, 
        or drug-induced. This granular view is critical for understanding disease mechanisms, identifying potential 
        therapeutic targets, and ultimately, enabling our models to simulate complex biological responses with confidence.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>Our extensive scRNA repository forms the bedrock of our data-driven strategy.</strong> 
        By continuously incorporating both publicly available datasets and proprietary experiments, we maintain a cutting-edge 
        resource that not only supports our internal model development but also provides actionable insights for our partners. 
        This robust dataset ensures that our predictions—whether for toxicity screening, efficacy forecasting, or drug repurposing—are 
        rooted in the true biological complexity of each cell.
      </p>

      <div className="w-full mb-8">
        <figure className="text-left">
          <Image
            src="/images/dataroom_images/scRNA_network.png"
            alt="scRNA data network"
            width={450}
            height={300}
            className="object-contain"
          />
          <figcaption className="roboto-slab-light text-xsm text-gray-dark mt-4">
            scRNA data enables a detailed network view of cellular regulation—vital for predicting outcomes in drug development.
          </figcaption>
        </figure>
      </div>

      <p className="roboto-slab-light text-base text-verydark mt-12 mb-12 leading-relaxed">
        <strong>The bottom line?</strong> Our reliance on scRNA as a core technology transforms how we understand and model 
        biology. It allows us to move beyond averaged signals and into a realm where individual cell behavior is illuminated. 
        This high-resolution perspective not only powers our foundational AI models but also positions us at the forefront of 
        precision medicine, paving the way for safer and more effective therapeutic interventions.
      </p>
    </>
  );
};

export default C_ScRNADataPlatform;