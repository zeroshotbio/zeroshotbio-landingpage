'use client';
import React from 'react';
import Image from 'next/image';

const C_FoundationModelTsGPT: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        Introducing the tsGPT Biological Foundation Model
      </h2>

      <p className="roboto-slab-light text-base mb-4 mt-12 leading-relaxed">
        <strong>tsGPT is our multi‐species foundation model designed to predict drug efficacy 
        and toxicity across diverse biological systems.</strong> It unifies single‐cell data from zebrafish, 
        mouse, rat, drosophila, and human into a common representation that captures gene regulatory circuits, 
        time evolution, and disease states. By incorporating cutting‐edge Transformer architectures and 
        adjacency‐aware attention mechanisms, tsGPT provides a powerful and genuinely new paradigm for 
        drug discovery and biological research.
      </p>

      <p className="roboto-slab-light text-base mb-8 mt-2 leading-relaxed">
        At its core, tsGPT recognizes that many preclinical drug failures stem from incomplete or oversimplified 
        models of biological complexity—particularly when trying to map results from one species onto another. 
        By training on multi‐organism single‐cell data sets, tsGPT inherently learns cross‐species 
        patterns of toxicity and efficacy. This allows researchers to simulate how a therapeutic candidate 
        might behave in zebrafish or drosophila, and more confidently extrapolate those findings to mammals 
        and ultimately to humans.
      </p>

      <div className="w-full mb-8">
        <figure className="text-left">
          <Image
            src="/images/dataroom_images/tsgpt_schema.png"
            alt="tsGPT architecture"
            width={500}
            height={300}
            className="object-contain"
          />
          <figcaption className="roboto-slab-extralight text-xxsm text-gray-dark mt-4">
            A schematic of the tsGPT pipeline, from multi‐species single‐cell data integration 
            and gene regulatory network inference, through adjacency‐aware Transformers.
          </figcaption>
        </figure>
      </div>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>tsGPT is built on the recognition that biology is intrinsically complex and interlinked.</strong> 
        Traditional reductionist approaches—such as focusing on a single pathway in a single organism—often fail 
        to account for the broad network effects of a drug. tsGPT, in contrast, encodes knowledge about gene–gene 
        interactions through adjacency matrices and layer indices, letting it attend to transcription factors and 
        target genes in a biologically informed way. This is crucial for distinguishing benign off‐target effects 
        from truly toxic outcomes.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>During its training, tsGPT encounters millions of single‐cell profiles</strong> spanning a range 
        of species, developmental stages, and conditions—from healthy tissues to disease states treated with 
        various compounds. In doing so, the model learns to predict masked gene expressions (a self‐supervised 
        strategy) and simultaneously aligns these predictions with the underlying gene regulatory networks. 
        This multi‐objective approach helps tsGPT generalize across complex biology, enabling it to generate 
        novel hypotheses about drug efficacy in one species, based on knowledge gained from others.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>One of tsGPT’s most transformative capabilities is its cross‐species toxicity forecasting.</strong> 
        In classical drug development, a compound might appear safe in certain animal models while eliciting 
        unexpected toxicity in another. The truism &#34animal models lie, but multiple models together are predictive&#34 
        underscores the reason we embraced multi‐species data from the start. By identifying shared gene regulatory 
        signatures that correlate with organ damage or pathological stress, tsGPT generates insights about 
        whether a drug’s toxic liabilities might appear in rodents, fish, or humans—long before a full battery 
        of in vivo tests are done.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>While tsGPT is a foundation model,</strong> it can be readily adapted to specialized applications, 
        such as immune‐oncology, rare disease, or specific organ toxicities. The adjacency structure can incorporate 
        curated pathways for, say, cardiotoxicity or neurotoxicity. The time tokens and species embeddings 
        allow it to handle scenarios ranging from acute doses in zebrafish larvae to chronic dosing in rodent 
        models. This flexibility means that researchers can &#34fine‐tune&#34 tsGPT on a small, domain‐specific dataset 
        while still leveraging the vast cross‐species knowledge it gained from its initial pretraining.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>Ultimately, tsGPT aims to mitigate late‐stage drug development failures</strong> by 
        providing a more rigorous in silico screening layer that incorporates multi‐species data at the earliest 
        stages possible. Rather than discovering a safety problem deep into Phase II or III—when both time and 
        cost investments are enormous—companies can adopt tsGPT’s screening predictions to triage candidate 
        molecules. This approach significantly increases the likelihood of carrying forward compounds 
        with genuinely translatable safety and efficacy profiles.
      </p>

      <div className="w-full mb-8">
        <figure className="text-left">
          <Image
            src="/images/dataroom_images/tsgpt_network.png"
            alt="tsGPT network"
            width={450}
            height={300}
            className="object-contain"
          />
          <figcaption className="roboto-slab-light text-xsm text-gray-dark mt-4">
            tsGPT&#39;s adjacency‐aware attention integrates knowledge of gene regulatory networks 
            across multiple species.
          </figcaption>
        </figure>
      </div>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>The vision for tsGPT extends far beyond incremental improvements.</strong> By modeling 
        gene expression and regulatory circuits as a universal &#34language&#34 of biology, tsGPT opens the door 
        to entirely new ways of exploring therapeutic interventions. Researchers can run &#34what‐if&#34 
        inferences—testing how gene expression might shift in disease or how various drug combinations 
        might synergize across different organisms. This approach promises to reduce guesswork and to unify 
        data across models in a single, comprehensive AI architecture.
      </p>

      <p className="roboto-slab-light text-base text-verydark mt-12 mb-12 leading-relaxed">
        <strong>The bottom line?</strong> tsGPT represents a quantum leap in how we unify 
        multi‐species single‐cell data, bridging in vivo and in vitro gaps through an adjacency‐aware 
        Transformer backbone. By preserving network biology and integrating cross‐species signals, 
        tsGPT enables an unprecedented level of predictive power when it comes to drug toxicity, 
        efficacy, and beyond—paving the way for the next generation of safer, more effective medicines.
      </p>
    </>
  );
};

export default C_FoundationModelTsGPT;
