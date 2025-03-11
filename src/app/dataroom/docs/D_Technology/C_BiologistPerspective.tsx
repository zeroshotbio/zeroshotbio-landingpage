'use client';
import React from 'react';
import Image from 'next/image';

const C_BiologistPerspective: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        A Drug Developer&apos;s Workflow with tsGPT
      </h2>

      <p className="roboto-slab-light text-base mb-4 mt-12 leading-relaxed">
        Many pharmaceutical researchers rely on hands-on experimentation, pharmacokinetic assays, and iterative compound optimization. <strong>tsGPT introduces a powerful new dimension by enabling confident transcriptomic modeling.</strong>
      </p>

      <p className="roboto-slab-light text-base mb-8 mt-2 leading-relaxed">
        In our approach, drug developers use tsGPT as a central dashboard to decode the complex cascade of gene regulatory events within their disease models. Take the example of Mylotarg—a CD33 antibody-drug conjugate used in Acute Myeloid Leukemia (AML) that has been limited by off-target toxicity. Researchers observing adverse liver toxicity from CD33 targeting can turn to tsGPT for deeper insights.
      </p>

      <div className="w-full mb-8">
        <figure className="text-left">
          <Image
            src="/images/dataroom_images/input-output.png"
            alt="Biologist Workflow with tsGPT"
            width={500}
            height={300}
            className="object-contain"
          />
          <figcaption className="roboto-slab-extralight text-xxsm text-gray-dark mt-4">
            tsGPT transforms raw single-cell data into actionable predictions on gene regulatory pathways.
          </figcaption>
        </figure>
      </div>

      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        1. Uncovering the Transcriptomic Landscape
      </h3>
      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        Researchers begin by feeding tsGPT with single-cell expression data from pilot toxicology studies of AML blasts. In the case of Mylotarg, this data—accompanied by metadata such as compound class, dosage, and time points—allows tsGPT to analyze the entire transcriptomic network of CD33-positive leukemia cells. The model then highlights the cascade of gene regulatory events and reveals not only the intended effects but also the off-target activations that contribute to liver toxicity.
      </p>

      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        2. Simulating Perturbations to Identify Safer Targets
      </h3>
      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        With a comprehensive map in hand, researchers can “ask” tsGPT how perturbing key nodes in the regulatory network might alter cellular responses. For instance, tsGPT might simulate the effects of reducing CD33 signaling while simultaneously exploring alternative targets such as <strong>CLEC12A</strong>, <strong>CD123</strong>, <strong>CD47</strong>, <strong>FLT3</strong>, and <strong>TIM-3</strong>. These simulations reveal which alternative targets are both highly expressed in AML blasts and minimally present in critical healthy tissues, suggesting potential combinations that can maintain anti-leukemic efficacy while lowering the overall CD33 antibody-cytotoxin dose.
      </p>

      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        3. Designing a Safer, More Effective Combination Therapy
      </h3>
      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        By integrating these insights, the development team can refine their therapeutic strategy. tsGPT’s predictions enable them to propose a novel polygenic combination: using a lower dose of the original CD33 ADC (Mylotarg) to reduce liver toxicity, paired with one or more additional targets that tsGPT has identified as critical for leukemia cell survival. This combination therapy not only minimizes off-target effects but also offers a multi-pronged attack against AML, addressing tumor heterogeneity and preempting resistance.
      </p>

      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        4. Streamlining Development and Reducing Risk
      </h3>
      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        With tsGPT providing mechanistic transparency—detailing which genes and pathways are implicated—researchers can make data-driven decisions with greater confidence. This approach minimizes the traditional trial-and-error cycle, reduces the number of required animal studies, and lowers both time and cost. By anticipating adverse outcomes before large-scale experiments, tsGPT empowers developers to de-risk the pipeline and accelerate progress from bench to bedside.
      </p>

      <p className="roboto-slab-light text-base text-verydark mt-12 mb-12 leading-relaxed">
        In essence, tsGPT transforms the drug development workflow by enabling a detailed, transcriptomic-driven reexamination of therapeutic targets. In the case of Mylotarg, it guides researchers to adjust dosing and identify complementary targets, ensuring that safety and efficacy go hand-in-hand. This synergy between deep molecular insights and practical application ultimately redefines how therapies are designed and optimized.
      </p>
    </>
  );
};

export default C_BiologistPerspective;
