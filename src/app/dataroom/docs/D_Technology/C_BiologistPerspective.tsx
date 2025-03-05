'use client';
import React from 'react';
import Image from 'next/image';

const C_BiologistPerspective: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        A Biologist’s Workflow with tsGPT
      </h2>

      <p className="roboto-slab-light text-base mb-4 mt-12 leading-relaxed">
        <strong>Many pharmaceutical researchers are accustomed to hands‐on experimentation, 
        pharmacokinetic assays, and incremental adjustments to compound chemistry.</strong> 
        For these scientists, tsGPT offers a genuinely new dimension to their workflow—one 
        where data‐driven predictions and mechanistic insights can streamline decision‐making 
        and reduce costly trial‐and‐error in the lab.
      </p>

      <p className="roboto-slab-light text-base mb-8 mt-2 leading-relaxed">
        Below, we walk through how a typical small‐molecule drug development program might 
        incorporate tsGPT to accelerate lead optimization, clarify toxicity risks, and 
        prioritize candidates for further in vivo testing.
      </p>

      <div className="w-full mb-8">
        <figure className="text-left">
          <Image
            src="/images/dataroom_images/biologist_workflow.png"
            alt="Biologist workflow"
            width={500}
            height={300}
            className="object-contain"
          />
          <figcaption className="roboto-slab-extralight text-xxsm text-gray-dark mt-4">
            How tsGPT interfaces with the traditional stages of small‐molecule development, 
            offering data‐driven refinements to a well‐established process.
          </figcaption>
        </figure>
      </div>

      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        1. Gathering Baseline Data
      </h3>
      <p className="roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <strong>A biologist begins with known chemical scaffolds or hits from a high‐throughput screen.</strong> 
        They also have initial pharmacokinetic data—absorption, distribution, metabolism, excretion, and 
        toxicity (ADMET)—along with in vitro potency profiles. Normally, these data feed iterative 
        refinement of chemical libraries, but do not fully reveal why certain structures exhibit 
        toxicity or appear to fail in certain species. At this point, expression readouts from 
        in vitro cell lines or small in vivo pilot studies can be collected to harness tsGPT’s 
        interpretive power.
      </p>

      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        2. Preparing Inputs for tsGPT
      </h3>
      <p className="roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <strong>The researcher supplies tsGPT with single‐cell expression data derived 
        from pilot toxicology studies,</strong> such as short‐term zebrafish or mouse assays. 
        They also provide metadata: the compound’s basic chemical structure category, the dose 
        used, and relevant time points. tsGPT’s pipeline tokenizes these inputs and compares them 
        to its broad, multi‐species expression dataset, seeking regulatory patterns in the 
        targeted tissue or cell type.
      </p>

      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        3. Generating Mechanistic & Toxicity Insights
      </h3>
      <p className="roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <strong>tsGPT identifies potential off‐target effects by analyzing changes in 
        gene regulatory networks,</strong> pinpointing which modules or pathways 
        are unexpectedly activated. This includes cross‐species correlations: the model 
        might indicate that, although zebrafish transcriptomes appear largely normal, 
        a pattern reminiscent of hepatotoxicity risk is surfacing when aligned with 
        rodent liver data. This level of mechanistic foresight helps the biologist gauge 
        whether to adapt the dose regimen or consider structural modifications to 
        reduce toxicity liabilities.
      </p>

      <div className="w-full mb-8">
        <figure className="text-left">
          <Image
            src="/images/dataroom_images/toxicity_prediction.png"
            alt="Toxicity predictions"
            width={450}
            height={300}
            className="object-contain"
          />
          <figcaption className="roboto-slab-light text-xsm text-gray-dark mt-4">
            tsGPT flags early signals of toxicity by detecting gene expression anomalies 
            associated with known adverse pathways across species.
          </figcaption>
        </figure>
      </div>

      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        4. Refining Compound Design & Dose Strategy
      </h3>
      <p className="roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <strong>With mechanistic clues in hand, the chemist or biologist can rationally alter 
        the compound structure</strong> to minimize exposure in critical tissues or reduce 
        metabolic byproducts identified as hazardous. Similarly, tsGPT’s multi‐time 
        extrapolations can show how gene expression signatures evolve at longer dosing intervals. 
        If dose fractionation is predicted to mitigate toxicity, for instance, the team can trial 
        new regimens in a smaller set of animals before committing to large‐scale experiments.
      </p>

      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        5. Prioritizing Follow‐Up Experiments
      </h3>
      <p className="roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <strong>Based on tsGPT’s output, the biologist focuses their next set of in vivo experiments 
        on the most promising candidates and the relevant species suggested by the model.</strong> 
        The pipeline may predict minimal cardiotoxicity in zebrafish but flag potential 
        challenges in rat models. This helps refine the selection of which rodent studies 
        to run, or which biomarkers to monitor in upcoming preclinical trials.
      </p>

      <div className="w-full mb-8">
        <figure className="text-left">
          <Image
            src="/images/dataroom_images/biologist_cycle.png"
            alt="Biologist iterative cycle"
            width={450}
            height={300}
            className="object-contain"
          />
          <figcaption className="roboto-slab-light text-xsm text-gray-dark mt-4">
            An iterative feedback loop: 
            tsGPT predictions inform experimental setups, 
            which generate new single‐cell data, 
            further refining the model’s accuracy.
          </figcaption>
        </figure>
      </div>

      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        6. Streamlining Timelines & Budgets
      </h3>
      <p className="roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <strong>Traditional small‐molecule development often involves repeated rounds of trial‐and‐error,</strong> 
        each entailing new animal cohorts and separate toxicity screens. By systematically 
        applying tsGPT’s predictions prior to each iteration, the drug developer reduces 
        the number of blind guesses. This significantly cuts down on both direct experimentation 
        costs and time to reach a development milestone.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <strong>Furthermore, tsGPT offers mechanistic transparency:</strong> 
        beyond a simple “safe or toxic” classification, 
        it elucidates which genes or pathways are implicated. 
        This rationale supports more directed medicinal chemistry or targeted 
        experiments—vital in a drug discovery culture that values both speed and rigorous 
        validation.&#39;&#39;
      </p>

      <p className="roboto-slab-light text-base text-verydark mt-12 mb-12 leading-relaxed">
        <strong>In essence, tsGPT integrates seamlessly</strong> into a typical 
        small‐molecule development pipeline, guiding the design of next‐stage animal studies, 
        pinpointing mechanistic underpinnings of toxicity or efficacy, and helping teams make 
        data‐driven choices about which compounds to advance. This synergy between empirical 
        pharmacokinetic expertise and advanced AI modeling ultimately accelerates discovery 
        while lowering attrition rates, giving biologists more confidence in 
        their most promising lead molecules.
      </p>
    </>
  );
};

export default C_BiologistPerspective;
