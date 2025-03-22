'use client';
import React from 'react';
import Image from 'next/image';

const A_BiologyIsComplex: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        Biology is Complex. AI can <i>more than</i> help.
      </h2>


      <p className="roboto-slab-light text-base mb-10 mt-12 leading-relaxed">
        <strong>Biology is a chaotic, complex system. </strong> 
        Intricate networks of interaction among thousands of genes, proteins and signaling molecules 
        underlie every biological process.
        This inherent chaos explains why despite our best efforts
        scientists still struggle to turn fundamental discoveries into reliable therapies.
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
         In AI research circles, <strong> a problem space that appears chaotic and complex yet possesses 
         sufficient underlying structure for AI to effectively analyze is commonly refered to as a 
         &apos;low-dimensional manifold&apos;. </strong>
         The transcriptomic layer of biology is one such space -- its patterns are incredibly chaotic and 
         complex, yet structured enough to be AI-tractable.
         Scientists have had access to far more valuable information than they&apos;ve previously been able 
         to understand and harness.
         The introduction of AI as a tool to decypher pathways and design interventions is creating a
         brand new drug development paradigm.
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
         <strong>We believe AI-based approaches represent 
         a genuinely new paradigm of progress for bioengineers. </strong> 
         No longer just a linear understanding of biological cause and effect; instead,
         a fundamentally nonlinear set of approaches capable of capturing and modeling 
         system-wide variables of connection.
      </p> 

      <p className="roboto-slab-light text-base text-verydark mb-10 leading-relaxed">

      </p>

      <p className="roboto-slab-light text-base text-verydark mb-20 leading-relaxed">

      </p>
    </>
  );
};

export default A_BiologyIsComplex;
