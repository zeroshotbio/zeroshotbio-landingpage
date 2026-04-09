'use client';
import React from 'react';

const C_DataSources: React.FC = () => {
  return (
    <div className="data-sources-page">
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        Data: The Backbone of tsGPT
      </h2>

      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        Our data strategy combines vast public scRNA-seq repositories with proprietary data we develop designed to push the envelope of transcriptomic discovery. While we continuously harvest publicly available datasets from multiple species and conditions, a critical pillar of our approach is the generation of high-fidelity zebrafish disease and perturbation data.
      </p>

      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        Zebrafish are uniquely suited for scalable, high-throughput experimentation. Their genetic similarity to humans, rapid development, and cost-effectiveness enable us to generate rich, per-cell transcriptomic data under a variety of disease conditions. We are actively developing a comprehensive library of zebrafish disease models—each annotated with detailed scRNA profiles and aligned with known human pathologies. This proprietary resource not only fills critical data gaps but also establishes a dynamic testbed for exploring how genetic perturbations affect disease progression.
      </p>

      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        In parallel, we are assembling large-scale perturbation datasets that capture how specific interventions alter transcriptomic landscapes. By systematically testing a wide range of compounds and genetic modifications in our zebrafish models, we generate invaluable data that reflects both the intended therapeutic effects and potential off-target toxicities. This multi-dimensional data serves as a foundation for our tsGPT engine, enabling it to learn subtle shifts in gene expression that signal early efficacy or emerging risks.
      </p>

      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        Our approach ensures that our dataset is not only massive in scale but also rich in information—each cell’s profile is packed with deep genetic signatures. This high-resolution, per-cell representation allows our AI to detect even the most subtle changes in gene expression, which are crucial for identifying new biomarkers and refining therapeutic strategies.
      </p>

      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        Beyond zebrafish, we integrate data from a range of species and conditions—capturing developmental stages, healthy states, and various disease models. This diversity is key to training a robust foundation model that can generalize across biological contexts. By merging public data with our own curated experiments, we create a comprehensive, multi-species transcriptomic atlas that underpins every prediction made by tsGPT.
      </p>

      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        <strong>Why This Matters:</strong> The combination of high-quality public datasets and our proprietary zebrafish models provides an unparalleled resource. It empowers tsGPT to generate accurate, actionable insights by learning from the most representative, high-fidelity data available. This rich, diverse data foundation not only enhances the predictive power of our models but also accelerates drug discovery, repurposing, and the identification of novel therapeutic targets.
      </p>
    </div>
  );
};

export default C_DataSources;
