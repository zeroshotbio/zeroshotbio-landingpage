'use client';
import React from 'react';

const C_WhyZebrafish: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        Why Zebrafish?
      </h2>

      <p className="roboto-slab-light text-base mb-10 mt-12 leading-relaxed">
        <strong>A Modern Data-Generation Platform.</strong> For Zeroshot Biolabs, zebrafish 
        (Danio rerio) present a near-perfect nexus between practical research considerations 
        and high-value transcriptomic output. Thanks to their small size, transparent embryos, 
        and prolific reproduction, zebrafish can generate extensive biological data rapidly. 
        This scale is critical for training our tsGPT engine on rich, reliable single-cell 
        RNA datasets, ensuring that each experiment yields abundant transcriptomic insight 
        into real-time, in vivo processes.
      </p>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
        <strong>Robust Genetic and Physiological Parallels.</strong> Although smaller 
        and simpler in appearance, zebrafish share a remarkable degree of genomic homology 
        with humans—around 70% of genes overall, and over 80% of disease-related proteins 
        display functional conservation. These parallels form the bedrock of translational 
        research: pathways involved in cancer, cardiovascular function, and neurological 
        development are often recapitulated in zebrafish models, allowing us to probe the 
        same molecular nodes that drive human pathology, but with far greater experimental 
        agility.
      </p>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
        <strong>High-Throughput Phenotypic Screening.</strong> Zebrafish are especially 
        suited for large-scale drug testing. Automated screening setups can evaluate 
        hundreds or even thousands of compounds across developmental stages, enabling 
        detailed observations of drug efficacy, toxicity, and mechanism of action at a 
        fraction of the cost associated with rodent models. When integrated with advanced 
        transcriptomic profiling, these phenotypic screenings become a data goldmine—revealing 
        not only which treatments work, but also illuminating how they modulate cellular 
        pathways in real time.
      </p>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
        <strong>Predictive of Human Responses.</strong> Historically, zebrafish have proven 
        their worth in identifying treatments that translate to meaningful clinical outcomes. 
        They excel at modeling drug-induced toxicities that sometimes go undetected in mice, 
        including teratogenic effects and organ-specific side effects. Successful case studies, 
        such as novel discoveries in hematopoietic stem cell expansion and targeted anti-cancer 
        pathways, validate the zebrafish’s power to bridge the gap between bench and bedside. 
        For Zeroshot Biolabs, these established precedents increase confidence that 
        zebrafish-driven insights will be highly relevant for human therapy development.
      </p>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
        <strong>Synergy with tsGPT.</strong> Our ultimate ambition is to refine human 
        therapeutic responses, yet achieving this requires a systematic, tiered approach to 
        data generation. Zebrafish add a crucial dimension to our pipeline: they produce 
        complex in vivo datasets—covering developmental biology, disease modeling, and 
        multi-organ interactions—in large volumes. This wealth of single-cell RNA sequencing 
        data feeds into tsGPT, allowing us to uncover hidden patterns in gene expression 
        that standard models might overlook. By training on zebrafish data before we integrate 
        multi-animal datasets, our model gains a robust, multi-system perspective on how 
        genetic and biochemical pathways behave under various perturbations.
      </p>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
        <strong>Building Toward Human Trials.</strong> While zebrafish are not the end 
        goal, they are an ideal stepping stone. Results gleaned here set the stage for 
        subsequent validation in higher vertebrates, culminating in human-focused applications. 
        By starting with zebrafish—where rapid, cost-effective trials are possible—Zeroshot 
        Biolabs rapidly accumulates high-density transcriptomic and phenotypic data to refine 
        tsGPT. Each insight propels us closer to our vision: a universal predictive engine 
        that can forecast human therapeutic responses with unprecedented accuracy, ultimately 
        guiding safer, more effective clinical trials.
      </p>
    </>
  );
};

export default C_WhyZebrafish;
