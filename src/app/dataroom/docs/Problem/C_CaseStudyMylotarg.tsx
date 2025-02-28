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
        <strong> Mylotarg is a cancer drug that was first approved in 2000 as a treatment for acute myeloid leukemia. </strong>
        It was withdrawn from the market in 2010 after Phase III results led to unacceptable mortality, then re-approved in 2017 
        with a revised dosing strategy. 
      </p>
      <p className="roboto-slab-light text-base mb-8 mt-2 leading-relaxed">
        Its story does a great job of highlighting the shortcomings of classical drug development and emphasizes
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
          <figcaption className="roboto-slab-extralight text-xxsm text-gray-dark mt-4">
             Mylotarg (gemtuzumab ozogamicin) is an antibody-drug conjugate. It targets the CD33 
             antigen on acute myeloid leukemia (AML) cells through a cytotoxic calicheamicin payload. 
          </figcaption>
        </figure>
      </div>


      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong> Mylotarg is intended to treat acute myeloid leukemia. </strong> 
         AML is a blood cancer that originates from a single group of proliferating immature 
         white blood cells known as myeloid blasts that accumulate in the bone marrow.
         This buildup happens when myeloid blast cells fail to mature normally.
         That failure is the consequence of two major genetic alterations: one that gives cells a 
         growth and survival boost (alterations in genes such as FLT3), 
         and the other that prevents cells from maturing (disruption in transcription factors such as PML_RARα). 
         Together, these two alterations result in the rapid multiplication of immature blood cells 
         and create the conditions for problematic, cancerous growth.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong> Building on this emerging understanding of AML, </strong> researchers in the 1990s 
        sought a strategy to selectively target and eliminate these abnormal myeloid blast cells without
        harming healthy tissue. They identified CD33, a protein abundantly expressed on the surface of 
        most AML blasts but largely absent on normal other stem cells and persued an 
        antibody-drug conjugate (ADC) approach. Calicheamicin -- a highly potent toxin that induces
        double-stranded DNA breaks -- was linked to a monoclonal antibody the specifically binds to CD33. 
        Critically, the ADC design features a cleavable linker that remains stable (and safe) in the bloodstream 
        but is broken down once the antibody-CD33 comlex is internalized by leukemic cells. This mechanism
        ensures the toxin is released only where it can trigger cell death. 
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong> Preclinical studies validated the ADC approach.  </strong> In vitro experiments demonstrated
        that CD33-positive leukemia cell lines were exquisitely sensitive to the ADC. Even animal models
        bearing human AML xenografts showed significant tumor regression with acceptable toxicity. These promising
        results paved the way for clinical trials. 
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong> Phase I studies established the dose-limiting toxicities, </strong> concerns around
        myelosuppression (bone marrow cell suppression) and effects on normal CD33-expression myeloid cells
        along with manageable infusion reactions. With these results, the drug moved to Phase II trials.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong> Phase II studies conducted in older patients with relapsed AML </strong> revealed an overall
        response rate of approximately 30%, including both complete remissions and remissions with incomplete 
        platetely recovery. Although encouraging, some patients experienced transient liver enzyme elevations 
        and rare cases of hepatic veno-occlusive disease, an adverse effect linked to the ADC's off-target effect 
        on liver macrophases.<strong> Based on these outcomes, Mylotarg received accelerated FDA approval in 2000 as the 
        first ADC approved for cancer treatment. </strong>
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong> HOWEVER, further Phase III studies</strong> using a high single dose regimen led to increased
        early mortality, largely due to liver toxicity, which prompted the drug's withdrawal from the market
        in 2010. Investigations revelaed that fractionated dosing could reduce peak toxicity and allow for repeated
        targeting of CD33as it was re-expressed in AML cells. The ALFA-0701 trial demonstrated that a lower, fractionated 
        dose of Mylotarg, when added to standard chemotherapy, significantly improved event-free survival without
        incurring unacceptable toxicity. These findings let to Mylotarg's re-approval in 2017 with revised dosing 
        strategies and updated warinings around hepatotoxicity.
      </p>

      <p className="roboto-slab-light text-base text-verydark mt-12 mb-12 leading-relaxed">
        <strong> So, what did we learn? </strong>
        The story of Mylotarg highlights the importance of understanding the heterogeneity of gene regulatory networks 
        and ensuring that targeted therapies match the molecular profile of the diseaase. Specifically, the evolution
        from high-dose to fractionated doseing clarifies the importance of careful fine-tuning of drug exposure that 
        balances toxicity and efficacy. 
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
