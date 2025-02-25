'use client';
import React from 'react';
import Image from 'next/image';

const C_CaseStudyMylotarg: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        A Case Study: Mylotarg
      </h2>


      <p className="roboto-slab-light text-base mb-10 mt-12 leading-relaxed">
        <strong> Mylotarg is a cancer drug first approved in 2000. </strong> 
        Intricate networks of interaction among thousands of genes, proteins and signaling molecules 
        underlie every biological process.
        This inherent chaos explains why despite our best efforts
        scientists still struggle to turn fundamental discoveries into reliable therapies.
      </p>
      

      <div className="w-full mb-8">
        <figure className="text-left">
          <Image
            src="/images/dataroom_images/mylotarg_cartoon.png"
            alt="IO-healthy-disease"
            width={200}
            height={100}
            className="object-contain"
          />
          <figcaption className="roboto-slab-light text-xsm text-gray-dark mt-4">
             Mylotarg (gemtuzumab ozogamicin) is an antibody-drug conjugate. It targets the CD33 
             antigen on acute myeloid leukemia (AML) cells through a cytotoxic calicheamicin payload. 
          </figcaption>
        </figure>
      </div>


      <p className="roboto-slab-light text-base text-verydark mb-12 leading-relaxed">
        <strong> Highly effective in certain AML settings, </strong> it nevertheless exhibited previously 
          underappreciated liver toxicity – most notably veno-occlusive disease (VOD).  
          No longer just a linear understanding of biological cause and effect; instead,
         a fundamentally nonlinear set of approaches capable of capturing and modeling 
         system-wide variables of connection.
          
      </p>

      <div className="w-full mb-8">
        <figure className="text-left">
          <Image
            src="/images/dataroom_images/mylotarg_network.png"
            alt="IO-healthy-disease"
            width={450}
            height={300}
            className="object-contain"
          />
          <figcaption className="roboto-slab-light text-xsm text-gray-dark mt-4">
             The polygenic effects of mylotarg make the overall influence of the drug on an 
             organism complicated to project.
          </figcaption>
        </figure>
      </div>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
         <strong>We believe AI-based approaches represent 
         a genuinely new paradigm of progress for bioengineers. </strong> 
         No longer just a linear understanding of biological cause and effect; instead,
         a fundamentally nonlinear set of approaches capable of capturing and modeling 
         system-wide variables of connection.
      </p> 

    </>
  );
};

export default C_CaseStudyMylotarg;
