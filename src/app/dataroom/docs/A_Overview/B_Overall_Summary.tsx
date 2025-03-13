'use client';
import React from 'react';
import Image from 'next/image';

const OverallSummary: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        From a Bird&#39;s-Eye View:
      </h2>

      <p className="roboto-slab-light text-base mb-10 mt-12 leading-relaxed">
        <strong> Most of biology is too complicated </strong> for humans to understand and engineer predictably. 
        While drug development strategies may be derived from good science, most success stories 
        are the result of painful trial and error. The failure rate of modern clinical trials is a 
        clear reminder of the limitations of our current strategic approaches.
      </p>

      <p className="roboto-slab-light text-base text-verydark leading-relaxed">
        <strong>Our vision</strong> is that biological foundation models will enable such a robust, deep understanding
        of disease pathways that brand new drug development strategies will become possible.
        This will be a difference in kind, not just quantity. Entirely new categories of pathway visibility will enable
        fresh therapeutic approaches that we believe will revolutionze the precilincal development landscape.
      </p>
      
      <p className="mt-4 roboto-slab-light text-base text-verydark leading-relaxed">
        <strong> In this first chapter, Zeroshot Biolabs is an AI-bio 
        interrogability company. </strong>
        That is, our first focus is to use AI as the primary lens through which the chaos of biology 
        can become understood -- especially in the context of drug development. 
      </p>

      
      <p className="roboto-slab-light text-base text-verydark mb-4 mt-10 leading-relaxed">
        <strong>Tactically speaking, </strong> we&#39;re starting by training our models on the &#39;action&#39; 
        layer of biology -- the transcriptome. It&#39;s one of the most fundamental, diverse, 
        and data-scalable signatures of activity within and between cells.
        AI&#39;s core competency is in understanding the complexity of high-dimensional networks, 
        especially when large pools of diverse training data are available. 
        That&#39;s why we&#39;ve chosen to start with <strong><i>Danio rerio</i> (zebrafish)</strong> as 
        our first model organism. With zebrafish, we&#39;re able to sequence the transcriptomes 
        of thousands of cells from hundreds of individuals under dozens of conditions. 
      
        After we&#39;ve demonstrated predictive capability within zebrafish biology by testing
        our model against real-world outcomes, we&#39;ll expand to include other model 
        organisms in our training data toward our first milestone goal: the prediction of outcomes 
        in human biology.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-2 mt-10 leading-relaxed">
        <strong> We will run the data cycle continuously </strong> over the life of the 
        company to keep improving our biological foundation models. 
        In its first incarnation, each turn of the cycle involves growing zebrafish,
        creating healthy, disease, and perturbation varieties,
        performing scRNA sequencing, using the results to train and fine-tune our models,
        learning from the inference results, and finally designing the next generation of
        experiments. By intelligently filling data gaps and fine-tuning our model architecture 
        over many generations, we expect to become the gold-standard for transcriptomic effect prediction.
      </p>

      <div className="w-full mb-4">
        <Image
          src="/images/dataroom_images/overall_fundamental_flow.png"
          alt="IO-healthy-disease"
          width={700}
          height={500}
          className="object-contain"
        />
      </div>
      <p className="roboto-slab-extralight text-xxsm mb-20 mt-0 leading-relaxed">
        The data cycle represents our fundamental development loop. As Zeroshot Biolabs begins exploring
        specialization into different specific disease pathways, crucial new data will be generated 
        through experiments on real animal model organisms. 
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
       <strong> The first iteration of our biological foundation model </strong>predicts
       the gene expression patterns of cells under different disease and drug conditions.
        Most therapeutics are either toxic or effective because of their impact on an 
        organism&#39;s gene expression patterns.
        A drug&#39;s ability to reliably improve these patterns is ultimately what 
        determines its success. 
      </p>

      <div className="w-full mt-0 mb-4">
        <Image
          src="/images/dataroom_images/input-output.png"
          alt="IO-healthy-disease"
          width={450}
          height={400}
          className="object-contain"
        />
      </div>

      <p className="roboto-slab-extralight text-xxsm mb-20 mt-0 leading-relaxed">
        A visualization of the fundamental operation of the first iteration of our transformer model,
        tsGPT 1.4. Inputs and outputs are structed as gene expression profiles, which are then interpreted
        back into biologically relevant phenotypic realities.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>What categories of therapeutics should we develop core competency for? </strong>
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong> Drug candidates </strong> that target powerful but sensitive &#39;master regulator&#39; sites
        are some of the most promising but difficult to harness. The chain of events
        that follow often have deep gene regulatory effects that either result in unexpected
        toxicity or inconsistent efficacy across species. 
        The self-attention transformer architecture is especially well suited for capturing
        context-dependent, long-range interaction effects in transcriptomically complex diseases like these. 
        
      </p>

      <div className="w-full">
        <Image
          src="/images/dataroom_images/simple_v_complex_drugs.png"
          alt="IO-healthy-disease"
          width={800}
          height={400}
          className="object-contain"
        />
      </div>
      <p className="roboto-slab-extralight text-xxsm mb-20 mt-4 leading-relaxed">
        Transcriptomically simple versus transcriptomically complex disease pathways are visualized in this side-by-side comparison.
        On the left, drugs like Insulin and Aspirin have relatively simple
        positive and negative pathway effects. On the right, a drug like Mylotarg involves a complex cascade of events 
        relevant to its efficacy (blue) and toxicity (red). Most diseases have transcriptomically complex efficacy and toxicity
         effects, more like Mylotarg than insulin. 
      </p>


      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>How do we make money? </strong>
      </p>
      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>There are two major pathways avaialble to us.</strong> Either we pursue a SaaS-style 
        business model selling access to inference or we use our system to develop 
        novel drug candidates of our own. The former would allow us to generate revenue within a year, 
        but the latter would (potentially) allow us to capture far more value 
        in the long term. It may be that we pursue a hybrid of these two models 
        given their mutual synergy.
        We&#39;re having conversations with advisors, founders, investors, and 
        potential customers to help us make the right strategic decision here.
        
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>1. The SaaS market opportunity </strong> is substantial and growing. 
        Industry reports suggest AI in drug discovery reached
        ~$500m in 2020 with a CAGR of 40%, reaching $3-5b by the late 2020s. The appeal for these 
        customers is clear -- a tool that saves hundreds of millions by catching failures early 
        and enabling fine-tuning that substantially improves efficacy confidence will command 
        premium subscription fees. 
      </p>




      <p className="roboto-slab-light text-base text-verydark mb-10 leading-relaxed">
        <strong>2. If we develop our own drug candidates </strong> the market opportunity
        is more difficult to predict. If we follow the path Schrödinger pursued, we 
        could take select compounds through proof-of-concept, then license or sell them
        outright to larger pharma for further clinical development. That means Zeroshot Biolabs
        would make money in &#39;$100m batches&#39; plus milestone fees and royalties. The advantage of
        this strategy is that Zeroshot can remain focused on its core competency (AI-driven 
        pre-clinical confidence) while participating in the upside of successful drug development.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-10 leading-relaxed">
        <strong>We&#39;re also exploring drug repurposing. </strong> The capabilities of our 
        biological foundation model are uniquely positioned to predict which existing
        clinically-validated drug candidates would be efficacious for entirely new disease areas. 
        Repurposed therapies can deliver significant clinical value within 3-5 years instead of 
        7-10, especially if the original pharmacokinetics and safety data remain applicable in
        the repurposed context. We can design our model to rank hundreds of potential disease 
        contexts simultaneously, effectively doing an &#39;all-vs-all&#39; match of drug-gene interactions.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-20 leading-relaxed">
        <strong>Our thinking on the emerging competitive landscape</strong> is that a diversity 
        of specialized foundation models will each thrive in a growing landscape of niches.
        Zeroshot Biolabs aims to become the leader in transcriptomic effect modeling toward 
        human drug response prediction. Likely, Zeroshot will work synergistically with 
        other AI-bio companies at different levels of the biology &#39;stack&#39; as part of a chain 
        of players creating value along the entire drug-development pipeline. 
      </p>
    </>
  );
};

export default OverallSummary;
