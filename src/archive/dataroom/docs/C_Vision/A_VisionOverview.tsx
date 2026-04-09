'use client';
import React from 'react';

const C_Vision: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        Our Vision for Biological Foundation Models
      </h2>

      <p className="roboto-slab-light text-base mb-2 mt-12 leading-relaxed">
        <strong>Biology defies the intutions of conventional human understanding and engineering, </strong>especially at 
        the level of gene expression networks. When transcriptomic 
        complexity is central to therapeutic success, traditional drug development strategies still largely rely 
        on trial and error to a disheartening extent. We believe the rise of biological foundation models will fundamentally 
        change the game. Instead of nudging therapeutic development forward in incremental steps, 
        AI-driven system-wide insights will enable enhanced and novel drug designs .
      </p>

      <p className="roboto-slab-light text-base mb-2 mt-6 leading-relaxed">
        <strong>Zeroshot Biolabs serves as a lens through which the chaos of gene expression networks 
        become interpretable. </strong> Our growing expertise has led us 
        to develop tsGPT, a transformer-based model designed to understand comlex gene expression networks. 
        Fundamentally, it&apos;s fine-tuned to predict of the efficacy and toxicity effects of potential drugs on healthy
        and disease-state organisms -- especially human.<strong> While tsGPT is trained on multispecies scRNA data </strong>to best 
        enbale generalization and produce the highest-confidence results, human and zebrafish data make up a disproportionate sum.
      </p>
        
      <p className="roboto-slab-light text-base mb-10 mt-6 leading-relaxed">
        <strong>Why zebrafish?</strong> It&apos;s is a very popular vertabrate model organism increasingly used in pre-clinical
        drug development studies. Its similarity to human genetics, growing body of success stories translating pre-clinical 
        to clinical human results, and low-cost high-throughput characteristics make it the ideal model organism to generate
        the volumes of diverse training data we believe will be necessary to get the best results from future iterations of tsGPT. 
        More on this in the zebrafish section. 
      </p>

      <p className="roboto-slab-light text-large mb-2 mt-12 leading-relaxed">
        <strong>
        From these fundamentals, three major strategic business directions have emerged:
        </strong>
      </p>

      <p className="roboto-slab-light text-base mb-4 mt-4 leading-relaxed">
        <strong>1. tsGPT as a Software Platform:</strong> Offering immediate commercial impact, the tsGPT 
        engine can be provided directly to the research community as a powerful, intuitive platform. 
        Researchers can utilize our software to rapidly interpret transcriptomic data, design precise experiments, 
        and accelerate biological discovery.
      </p>

      <p className="roboto-slab-light text-base mb-4 leading-relaxed">
        <strong>2. Predictive In-house Drug Development:</strong> Leveraging tsGPT’s predictive capabilities, 
        Zeroshot Biolabs can internally identify novel therapeutic candidates by modeling the complex transcriptomic 
        landscapes of diseases. This enables us to efficiently select and prioritize drug candidates that precisely
        modulate gene regulatory networks.
      </p>

      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        <strong>3. AI-Driven Drug Repurposing:</strong> tsGPT uniquely supports rapid identification of 
        existing compounds for new disease indications. By matching drugs to transcriptomic signatures 
        across diverse biological contexts, we drastically accelerate discovery, significantly reduce R&D costs, 
        and lower the risks associated with traditional drug development pipelines.
      </p>
      <p className="roboto-slab-light text-base mb-10 mt-2 leading-relaxed">
        While persuing three revenue streams simultaneously may not often be advisable for new startups, we 
        believe there is such a strong synergy of reinforced confidence between all three that we&apos;re currently
        committed to seriously exploring and hiring for all three. 
      </p>


      <p className="roboto-slab-light text-large mb-4 mt-12 leading-relaxed">
        <strong>
          Finally, a couple of specific ambious ideas we can share a bit about here: 
        </strong>
      </p>
      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        <strong>Embracing Polypharmaco-Development.</strong> The complexity of biology often renders single-target 
        drugs insufficient, particularly in diseases driven by intricate gene-regulatory networks. Leveraging tsGPT&apos;s 
        ability to elucidate complex transcriptomic interactions, we&apos;re exploring multi-target approaches 
        as drug development strategies in ways that have never been considered before. By designing strategic combinations
        -- or &apos;cocktails&apos; -- of drugs targeting complementary nodes within regulatory networks, there&apos;s the potential 
        to fine-tune the knobs and dials of many different points along a gene regulatory pathway cascade. 
        This polypharmacological strategy enhances treatment effectiveness, minimizes the likelihood of resistance, 
        and offers tailored solutions that align closely with the evolving biology of complex diseases.
      </p>

      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        <strong>Mapping Cancer Evolution and Resistance.</strong> Cancer&apos;s ability to adapt presents a continuous 
        challenge in oncology. Our vision is to leverage tsGPT to reveal how tumors evolve over time at the transcriptomic 
        level, illuminating hidden pathways of resistance as they emerge. By predicting these evolutionary trajectories, 
        tsGPT can proactively guide the selection of targeted treatments, helping scientists anticipate—and ideally 
        circumvent—drug resistance before it occurs. This approach turns transcriptomic complexity into actionable 
        insights, empowering drug developers to design therapies one step ahead of cancer&apos;s evolution.
      </p>

    </>
  );
};

export default C_Vision;
