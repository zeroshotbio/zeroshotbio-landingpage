'use client';
import React from 'react';

const C_ScRNADataPlatform: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        scRNA: The Cornerstone of Our Data Platform
      </h2>

      <p className="roboto-slab-light text-base mb-4 mt-12 leading-relaxed">
        <strong>Single-cell RNA sequencing (scRNA) drives everything we do.</strong> By capturing gene expression on a per-cell basis, we reveal deep details of underlying genetics and pinpoint even subtle shifts in biological activity. Rather than averaging signals, scRNA illuminates the nuanced interplay of genes in each cell—a vantage crucial for biomarker discovery and therapeutic prediction.
      </p>

      <p className="roboto-slab-light text-base mb-8 mt-2 leading-relaxed">
        This level of granularity is increasingly essential: <em>scRNA is rich in signatures that AI can uniquely pick up.</em> 
        In conventional bulk sequencing, informative clues often get lost in aggregate data. But with scRNA, we see which 
        cells respond—or fail to respond—to disease or treatment, how gene regulatory pathways rewire themselves, and 
        where novel biomarkers might emerge. This per-cell lens brings us closer to genuine biological mechanisms, 
        fueling higher-fidelity modeling.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>Why we invest in scRNA:</strong>
      </p>
      <ul className="roboto-slab-light text-base mb-4 leading-relaxed list-disc ml-6">
        <li>Deep, cell-level representation of genetic networks</li>
        <li>Detection of subtle gene-expression changes that indicate early toxicity or disease onset</li>
        <li>Powerful biomarker discovery for more targeted therapies</li>
        <li>High information density, ideal for AI-driven pattern recognition</li>
      </ul>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>The Zebrafish Connection:</strong> Our platform goes further by curating an ever-growing library of 
        zebrafish disease models and targeted perturbations, all profiled at single-cell resolution. Zebrafish not only 
        share substantial genetic homology with humans, but also allow rapid, cost-effective experimentation. By 
        mapping how each perturbation affects gene expression, we assemble a living compendium of disease states and 
        therapeutic interventions—an invaluable resource that bolsters the precision of our predictive models.
      </p>

      <p className="roboto-slab-light text-base text-verydark mt-12 mb-12 leading-relaxed">
        <strong>The bottom line?</strong> Leveraging scRNA at scale—paired with our ongoing zebrafish data generation—enables 
        us to capture rich, cell-by-cell signatures of disease and response. This high-resolution strategy powers our 
        AI models with the depth needed to make accurate predictions for both early toxicity and targeted efficacy, 
        placing Zeroshot Biolabs at the forefront of modern drug discovery.
      </p>
    </>
  );
};

export default C_ScRNADataPlatform;
