'use client';
import React from 'react';
import Image from 'next/image';

const A_BiologyIsComplex: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        Biology is Complex
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
            width={500}
            height={400}
            className="object-contain"
          />
          <figcaption className="roboto-slab-light text-xsm text-gray-dark mt-4">
            An approximate representation of the major gene expression pathway cascades of zebrafish. 
          </figcaption>
        </figure>
      </div>


      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong> The history of bioengineering is checkered with cycles of discovery
         and false confidence. </strong> 
          A century of attempts at using classical engineering approaches toward
          reliable health improvements has produced mixed results. 
          For the number of research directions biologists have explored, few have 
          resulted in reliable therapeutics. Vaccines, antibiotics, 
          and small-molecules are the most successful examples, arguably the results 
          of trial and error, directional luck, and low-hanging fruit more than 
          bioengineering confidence and strategic intelligence.
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
