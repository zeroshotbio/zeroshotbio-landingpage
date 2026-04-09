'use client';
import React from 'react';

const C_FirstPrinciples: React.FC = () => {
  return (
    <div className="first-principles-page">
      <h2 className="text-3xl font-bold mb-6">From First Principles</h2>

      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        Our confidence in tsGPT is comes from recently establisehd first principles that apply to AI systems broadly.
      </p>


    <p className="roboto-slab-light text-base mb-6 leading-relaxed"> 
      <strong>1.  Large-scale models unlock emergent capabilities. </strong>
      <br /> In natural 
      language processing, the leap from GPT‑2 to GPT‑3 and beyond to GPT‑4 demonstrated that simply increasing model 
      size -- while maintaining sufficient data quality -- unlocks new, sometimes unexpected, capacities. Analogously, for 
      biology, a modestly sized neural network can capture only surface-level interactions, but a sufficiently large 
      model such as tsGPT sees deeper into gene-regulatory network space. In language models, emergent tasks like few-shot 
      reasoning or step-by-step chain-of-thought appear once scale is large enough; similarly, in transcriptomics, 
      we expect emergent predictive power that can illuminate the complex interplay of genes far better than smaller 
      architectures. To reach this threshold, however, we must train on high-fidelity scRNA-seq data that spans 
      diverse tissues, species, and disease states -- public data alone isn&apos;t enough to fuel the sort of scale needed 
      for these “emergent” biological insights. 
    </p> 

    <p className="roboto-slab-light text-base mb-6 leading-relaxed"> 
      <strong>2. The animal–human translation gap is an AI-trainable problem.</strong>
      <br /> Language models such as GPT‑4 demonstrate remarkable
      performance in multilingual tasks, transferring knowledge across languages that share only partial overlap. This 
      reflects a fundamental truth: once a model grasps underlying linguistic (or in this case, biological) structures, 
      knowledge can generalize across domains. Where drug discovery once relied on the guesswork of “does a mouse model 
      truly represent humans?”, AI approaches akin to cross-lingual understanding can learn the mapping between zebrafish 
      transcriptomes and human outcomes. With enough cross-species single-cell data, tsGPT can spot consistent signals of 
      toxicity or efficacy, bridging the gap between preclinical and clinical results. Rather than remain stuck in cyclical
      trial-and-error, we can <em>train out</em> these pitfalls the same way GPT‑4 learns to produce coherent translations: 
      by seeing parallel exemplars and deducing underlying commonalities. 
    </p> 


    <p className="roboto-slab-light text-base mb-6 leading-relaxed">
      <strong>3. Zebrafish represents a unique sweet spot for scalable, translatable data.</strong><br />
      On the operational side, bridging the public-data deficit and closing the animal–human gap require an organism that 
      is both biologically relevant and amenable to high-throughput screening. <em>Zebrafish hits that sweet spot</em>.
      Its genetics share significant homology with humans, yet it remains cost-effective, fast-breeding, and transparent
      enough to yield large volumes of detailed single-cell datasets. These features provide an ideal foundation for 
      building out extensive, curated scRNA-seq resources—thereby fueling the data scale that robust foundation models 
      demand. More importantly, zebrafish-based insights have proven translatable to mammalian systems in multiple 
      disease contexts, ensuring that the knowledge gleaned by tsGPT not only broadens fundamental biology but also 
      accelerates actionable leads for human therapeutics.
    </p>
    
    <p className="roboto-slab-light text-base mb-6 leading-relaxed">
      Together, these principles guide Zeroshot Biolabs&apos; overall strategy:
    </p>

    <ol className="roboto-slab-light text-base mb-6 leading-relaxed list-decimal ml-6">
      <li>We invest in large foundation models and multi-species biological data to accelerate emergent predictive power.</li>
      <li>We systematically exploit cross-domain alignmen to solve the animal–human disconnect.</li>
      <li>We harness zebrafish as our primary model organism to scalably fill data gaps.</li>
    </ol>


    <p className="roboto-slab-light text-base mb-6 leading-relaxed">
      Investing according to these fundamental first principles, we believe a mature tsGPT can deliver transformative predictive 
      power and a sustainable business edge in the pharmaceutical landscape.
    </p>
    
    </div>

  );
};

export default C_FirstPrinciples;
