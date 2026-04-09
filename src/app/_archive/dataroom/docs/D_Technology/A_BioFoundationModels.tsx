'use client';
import React from 'react';
import Image from 'next/image';

const C_FoundationModelTsGPT: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        Introducing the tsGPT Engine
      </h2>

      <p className="roboto-slab-light text-base mb-4 mt-12 leading-relaxed">
        <strong> Our foundation models </strong> are fundamentally engineered to capture  
        transcriptomic patterns that underlie cellular behavior, focusing on critical signals such 
        as toxicity markers, efficacy predictors, and phenotype-response dynamics. At the heart of this 
        approach is our <strong> tsGPT engine (transcriptomics-GPT)</strong>: a multi-layered transformer 
        architecture adapted for single-cell RNA (scRNA) expression data. 
      </p>
      <p className="roboto-slab-light text-base leading-relaxed">
        tsGPT not only recognizes subtle variations in gene expression across complex regulatory networks, 
        it also models the beneficial and adverse outcomes of perturbations away from the &apos;healthy norm&apos;. 
        We&apos;re curating our training dataset and designing our model architecture specifically to model 
        the perturbation effects of drug interventions. For instance, in zebrafish models of T-cell acute 
        lymphoblastic leukemia -- where dysregulated 
        oncogenic signals disrupt normal hematopoiesis -- tsGPT can predict how targeted drug treatments 
        could restore healthy gene expression patterns and flag potential off-target toxicities.
      </p>

      <p className="roboto-slab-light text-base mb-4 mt-4 leading-relaxed">
       <strong>While zebrafish is the model organism were starting with to generate new custom data
        for future generations of tsGPT, the model&apos;s core training is multi‐species.
        </strong> It unifies single‐cell sequencing data from zebrafish, human, mouse, fruit fly, chicken, 
        pig, chimpanzee, rabbit, roundworm and others 
        into a common representation that captures gene regulatory circuits, 
        time evolution, and disease states. The reason for this diversity is clear: results from 
        single organism experiments don&apos;t consistently translate to human, but far more often
        results from multi-organism experiments do. By training on multi‐organism single‐cell data sets, 
        tsGPT inherently learns patterns that hold true across across vertebrates (and invertebrates).
        More on this in the next section on Data.
      </p>

      <p className="roboto-slab-light text-base mb-16 mt-2 leading-relaxed">
        tsGPT harnesses a transformer-based architecture that
        leverages self-attention to contextualize gene expression values in a high-dimensional latent 
        space. Each cell is treated as a sequence of tokens, where each token is a gene with a corresponding 
        expression measurement value, enabling the model to capture intricate dependencies among genes. 
        The architecture incorporates specialized attention masks designed to selectively focus on known gene signals 
        while iteratively predicting the values of unknown genes. This mechanism not only reconstructs 
        complete transcriptomic profiles with high fidelity but also reveals underlying regulatory 
        networks. By effectively mapping the complex interplay between gene expressions, tsGPT becomes 
        capable of discerning subtle differences across cellular states, thereby modeling both static 
        and dynamic aspects of gene regulation.
      </p>

      <div className="w-full mb-8">
        <figure className="text-left">
          <Image
            src="/images/dataroom_images/full_model_architecture.png"
            alt="tsGPT architecture"
            width={700}
            height={300}
            className="object-contain"
          />
          <figcaption className="roboto-slab-extralight text-xxsm text-gray-dark mt-4">
            A schematic of the tsGPT pipeline, from multi‐species single‐cell data integration 
            and gene regulatory network inference, through adjacency‐aware transformers.
          </figcaption>
        </figure>
      </div>



      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed"> 
        <strong>During its training, tsGPT encounters millions of single‐cell profiles</strong> across numerous 
        species, developmental stages, and experimental conditions—from healthy baseline states to complex 
        disease scenarios following compound interventions. Through a self‐supervised masking strategy, tsGPT 
        learns to accurately predict hidden gene expression values by recognizing informative patterns across 
        diverse biological contexts. Simultaneously, it aligns these predictions with known gene regulatory 
        networks, enabling cross-species hypothesis generation and insight transfer regarding drug responses. 
        </p> 
      
      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed"> To ensure biological 
        authenticity and technical robustness, tsGPT incorporates domain‐adversarial methods during training, 
        effectively reducing batch and experimental noise. This technique allows the model to construct 
        a stable transcriptomic feature space that captures genuine biological signals, spanning detailed 
        gene‐gene interactions to broader cellular phenotypes. Such a robust, domain-invariant foundation 
        primes tsGPT for precise fine-tuning toward specialized applications, including cell‐type annotation, 
        batch correction, and accurate predictions of cellular perturbation responses, transforming 
        complex high-dimensional datasets into actionable biological insights. 
      </p>


      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>One of tsGPT’s most important capabilities is cross‐species toxicity forecasting. </strong> 
        In classical drug development, a compound might appear safe in certain animal models while eliciting 
        unexpected toxicity in another. The truism &apos;animal models lie, but multiple models together are predictive&apos;
        underscores the reason we embraced multi‐species data from the start. By identifying shared gene regulatory 
        signatures that correlate with organ damage or pathological stress, tsGPT generates insights about 
        whether a drug’s toxic liabilities might appear in rodents, fish, or humans long before a full battery 
        of in vivo tests are done.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>While tsGPT is a foundation model,</strong> it can be readily adapted to specialized applications, 
        such as immune‐oncology, rare disease, or specific organ toxicities. The adjacency structure can incorporate 
        curated pathways for, say, cardiotoxicity or neurotoxicity. The time tokens and species embeddings 
        allow it to handle scenarios ranging from acute doses in zebrafish larvae to chronic dosing in rodent 
        models. This flexibility means that researchers can &apos;fine‐tune&apos; tsGPT on a small, domain‐specific dataset 
        while still leveraging the vast cross‐species knowledge it gained from its initial pretraining.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>Ultimately, tsGPT will provide predictability that limits late‐stage drug development failures </strong> 
        by providing a rigorous in silico screening layer that incorporates multi‐species data at the earliest strategic
        stages. Rather than discovering a safety problem deep into Phase II or III—when both time and 
        cost investments are enormous—companies can adopt tsGPT’s screening predictions to triage candidate 
        molecules. This approach significantly increases the likelihood of carrying forward compounds 
        with genuinely translatable safety and efficacy profiles.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>The vision for tsGPT extends far beyond incremental improvements.</strong> By modeling 
        gene expression and regulatory circuits as a universal &apos;language&apos; of biology, tsGPT opens the door 
        to entirely new ways of exploring therapeutic interventions. Researchers can run &apos;what‐if&apos; 
        inferences, testing how gene expression patterns will shift in disease states or how drug combinations 
        might synergize across tissues.
      </p>
    </>
  );
};

export default C_FoundationModelTsGPT;
