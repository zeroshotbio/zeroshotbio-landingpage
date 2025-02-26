'use client';
import React from 'react';
import Image from 'next/image';

const C_CaseStudyMylotarg: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        An Illuminating Case Study: Mylotarg
      </h2>


      <p className="roboto-slab-light text-base mb-4 mt-12 leading-relaxed">
        <strong> Mylotarg is a cancer drug first approved in 2000 as a treatment for acute myeloid leukemia. </strong>
        Its story highlights the shortcomings of classical drug development and emphasizes
        how biological foundation models will significantly improve the outcomes of
        drug development stories.
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


      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong> We start with a basic understanding of the diesease acute myeloid leukemia. </strong> 
         AML is a blood cancer that originates from a single group of proliferating immature 
         white blood cells known as myeloid blasts that accumulate in the bone marrow.
         This buildup happens when myeloid blast cells fail to mature normally.
         AML is not a uniform disease but rather a mix of conditions driven by two types of genetic
          alterations work together to cause AML: one gives cells a 
          growth or survival boost (alterations in genes such as FLT3), 
          and the other prevents cells from maturing (disruption in transcription factors such as PML_RARα). 
           Together, these mutations result in the rapid multiplication of immature blood cells and form the foundation
           for cancerous growth.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-12 leading-relaxed">
        <strong> These insights into transcription factor disruption established that
        AML is the result of a network-level failure of normal myeloid differentiation 
        programs, rather than a single gene defect​.
        </strong>
      </p>

      <div className="w-full mb-8">
        <figure className="text-left">
          <Image
            src="/images/dataroom_images/aml_lineages.png"
            alt="IO-healthy-disease"
            width={500}
            height={100}
            className="object-contain"
          />
          <figcaption className="roboto-slab-light text-xsm text-gray-dark mt-4">
             Blood cell development. A blood stem cell goes through several steps to become a red blood cell, 
             platelet, or white blood cell.
          </figcaption>
        </figure>
      </div>

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
