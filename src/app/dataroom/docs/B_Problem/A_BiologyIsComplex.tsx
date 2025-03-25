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
        This inherent chaos explains why scientists have struggled to reliably turn fundamental biological discoveries 
        into effective therapeutics.
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
         <strong>In AI research circles, the manifold hypothesis posits </strong> that complex, seemigly chaotic data 
         encountered in nature exists on a spectrum. At one extreme, data can be entirely random and 
         high-dimensional, rendering it computationally intractable and practically opaque to current AI 
         techniques. At the other end, data can be excessively structured and simple, providing little 
         informational novelty. Between these two extremes lies a &apos;Goldilocks zone&apos; of complexity: 
         chaotic data spaces with substantial informational content <i> and </i> enough structure for
         modern AI systems to recognize meaningful patterns and generalize effectively. 
      </p>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
        <strong>The transcriptomic layer of biology is a chaotic data space that has recently become AI-tractable. </strong> 
        Single-cell RNA sequencing generates enormous quantities of high-dimensional data
        containing intricate cellular states and trajectories that correspond to biological
        processes such as differentiation, disease progression, and developmental trajectories. Leveraging
        advanced AI architectures -- particularly transformer-based models -- we&apos;re now able to
        identify, visualize, and understand transcriptomic patterns with remarkable clarity and predictive power.
        As a result, the previously opaque complexities of biological systems are becoming increasingly transparent.
        <strong> At Zeroshot Biolabs, we&apos; specifically focused on translating these insights into tangible advancements 
        in drug development.</strong>
      </p>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
         <strong>To illustrate concretely, consider cancer&apos;s notoriously adaptive resistance to targeted therapeutics. </strong> 
         Frequently, when one signaling pathway is blocked by a targeted drug, cancer cells quickly evolve alternative 
         gene expression routes, re-channeling their survival mechanisms through redundant and overlapping 
         transcriptomic networks. This capacity to exploit manifold transcriptomic interactions -- essentially 
         harnessing biological complexity -- enables cancer cells to consistently evade drug effects, resulting 
         in persistent therapeutic resistance and, ultimately, clinical trial failures. However by anticipating and modeling 
         these intricate adaptive pathways before they arise clinically, we can preemptively identify and 
         counteract mechanisms of resistance. This deeper, predictive understanding not only improves our 
         capacity to design single targeted agents but also opens exciting avenues for innovative therapeutic 
         approaches like intelligently engineered drug combinations (AKA cocktail therapeutics) that 
         simultaneously block multiple escape routes, effectively closing off cancer&apos;s options for resistance.
        In the next section, we explore this paradigm in detail through the lens of Notch pathway inhibitors 
        in acute lymphoblastic leukemia, illustrating precisely how these insights are reshaping modern cancer 
        drug development strategies.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-10 leading-relaxed">

      </p>

      <p className="roboto-slab-light text-base text-verydark mb-20 leading-relaxed">

      </p>
    </>
  );
};

export default A_BiologyIsComplex;
