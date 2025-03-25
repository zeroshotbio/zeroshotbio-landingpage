'use client';
import React from 'react';
import Image from 'next/image';

const A_BiologyIsComplex: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        Biology is Complex. AI will <i>more than</i> help.
      </h2>


      <p className="roboto-slab-light text-base mb-10 mt-12 leading-relaxed">
        <strong>Biology is a chaotic, complex system. </strong> 
        Intricate networks of interaction among thousands of genes, proteins and signaling molecules 
        underlie every biological process.
        This inherent chaos explains why despite our best efforts
        scientists struggle to reliably turn fundamental discoveries into therapeutics.
      </p>
      

      <div className="w-full mb-12">
        <figure className="text-left">
          <Image
            src="/images/dataroom_images/zebrafish_radial.png"
            alt="IO-healthy-disease"
            width={600}
            height={500}
            className="object-contain"
          />
          <figcaption className="roboto-slab-light text-xsm text-gray-dark mt-4">
            An approximate representation of the major gene expression pathway cascades of zebrafish. 
          </figcaption>
        </figure>
      </div>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
         In AI research circles, <strong> the manifold hypothesis </strong>  posits that complex, seemigly chaotic data 
         encountered in nature exists on a spectrum. At one extreme, data can be entirely random and 
         high-dimensional, rendering it computationally intractable and practically opaque to current AI 
         techniques. At the other end, the data is excessively structured and simple, providing little 
         informational novelty or challenge. Between these two extremes lies a &apos;Goldilocks zone&apos; of complexity—where 
         data sets embody sufficient 
         complexity and dimensionality to yield meaningful insights, yet remain embedded within 
         lower-dimensional manifolds accessible enough for advanced AI systems to discern structure, 
         recognize meaningful patterns, and generalize effectively. 
      </p>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
        The transcriptomic layer of biology is one such space, recently capable of exploration.
        Single-cell RNA sequencing, for instance, generates enormous quantities of high-dimensional data,
        reflecting subtle, intricate cellular states and trajectories. Yet beneath this apparent complexity,
        cellular transcriptional states often cluster along well-defined manifolds corresponding to biological
        processes such as differentiation, disease progression, and developmental trajectories. Leveraging
        advanced AI architectures—particularly transformer-based models—researchers can now identify,
        visualize, and understand these manifold structures with remarkable clarity and predictive power.
        Consequently, the once opaque complexities of biological systems are becoming increasingly transparent,
        enabling discoveries that promise to revolutionize medicine, biology, and bioengineering.
      </p>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
         <strong> Cancer is the quintessential example </strong> of the potential
         for AI-driven therapeutic development strategies to work <i>with </i>
         transcriptomic complexity instead of against it.
         When one signaling route is inhibited by a targeted therapeutic, cancer cells very often evolve
         alternative, redundant gene expression pathways, rerouting survival
         signals by taking advantage of the chaos of transcriptomic interactions. 
         This ability to exploit multiple, overlapping gene regulatory circuits enables 
         persistence and clinical trial failures.
         AI-driven strategies that can predict these adaptive maneuvers before they become
         clinic-halting problems will become invaluable in the design of next-generation cancer drugs. 
      </p>


      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong> The history of bioengineering is checkered with cycles of discovery
         and false confidence. </strong> 
          A century of attempts at using classical engineering approaches toward
          reliable bioengineering has produced mixed clinical results. 
          For the number of research directions biologists have explored, few have 
          resulted in reliable therapeutics. Vaccines, antibiotics, 
          and small-molecules are the most successful examples. Arguably, their success
          is largely the result of trial and error, directional luck, and low-hanging fruit 
          more than bioengineering confidence and strategic intelligence.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
         We believe AI-based approaches represent a genuinely new paradigm of progress for bioengineers. 
         No longer just a linear understanding of biological cause and effect; instead, a fundamentally 
         nonlinear set of approaches capable of capturing and modeling system-wide variables of connection. 
         By transcending traditional methods that rely heavily on reductionist perspectives, 
         AI-driven techniques embrace complexity, turning previously overwhelming biological intricacies
        into manageable, insightful models. This paradigm shift offers the potential not just to better 
        understand biology but to proactively engineer it, revolutionizing therapeutic development, 
        personalized medicine, and biotechnological innovation. Ultimately, the intersection of manifold
        complexity and artificial intelligence represents a fertile ground for transformative advancements 
        in healthcare and beyond.

      </p> 

      <p className="roboto-slab-light text-base text-verydark mb-10 leading-relaxed">

      </p>

      <p className="roboto-slab-light text-base text-verydark mb-20 leading-relaxed">

      </p>
    </>
  );
};

export default A_BiologyIsComplex;
