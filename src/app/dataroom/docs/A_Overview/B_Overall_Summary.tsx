'use client';
import React from 'react';
import Image from 'next/image';

const OverallSummary: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        From a Bird&#39;s-Eye View:
      </h2>

      <p className="roboto-slab-light text-base mb-4 mt-12 leading-relaxed">
        <strong> Most of biology is too complicated </strong> for humans to understand and engineer predictably. 
        While drug development strategies may be derived from good science, most success stories 
        are the result of painful trial and error. The failure rate of modern clinical trials is a 
        clear reminder of the limitations of our current strategic approaches.
      </p>

      <p className="roboto-slab-light text-base text-verydark leading-relaxed">
        <strong>Our vision</strong> is that biological foundation models will enable such a robust, deep understanding
        of disease pathways that brand new drug development strategies will become possible.
        This will be a difference in kind, not just quantity. Entirely new categories of pathway visibility will enable
        fresh therapeutic approaches that we believe will revolutionize the preclinical development landscape.
      </p>
      
      <p className="mt-4 roboto-slab-light text-base text-verydark leading-relaxed">
        <strong> In this first chapter, Zeroshot Biolabs is an AI-bio 
        interrogability company. </strong>
        That is, our first focus is to use AI as the primary lens through which the chaos of biology 
        can become understood -- especially in the context of drug development. 
      </p>

      
      <p className="roboto-slab-light text-base text-verydark mt-16 leading-relaxed">
        <strong>Tactically speaking, </strong> we&#39;re starting by training our models on the &#39;action&#39; 
        layer of biology -- the transcriptome. It&#39;s one of the most fundamental, diverse, 
        and data-scalable signatures of activity within and between cells.
        AI&apos;s core competency is in understanding high-dimensional networks, 
        especially when large pools of diverse training data are available.
      </p>

      <p className="roboto-slab-light text-base text-verydark mt-6 leading-relaxed">
        Fortunately there are a lot of publicly available multi-species scRNA (single cell RNA) 
        datasets. We&apos;re harvesting across vertebrate and invertebrate species with a bias toward human and
        <strong><i> Danio rerio</i> (zebrafish)</strong> for our early MVPs. As we 
        grow and learn about the gaps we&apos;ll generate custom datasets to fill them.
      </p>
        
      <p className="roboto-slab-light text-base text-verydark mb-4 mt-6 leading-relaxed">
        <strong>Why the bias toward zebrafish? </strong>
        We&apos;re confident custom data will be necessary to strengthen our models as we specialize them
        toward state-of-the-art performance on a drug-by-drug basis.
        We&apos;ve selected zebrafish as the optimal model organism for custom data generation because
        it is the most human-like model organism that is also low-cost, high-scale, and increasingly popular
        in FDA-approved pre-clinical settings. Technically speaking, it&apos;s also possible to do scRNA
        sequencing on whole-organism zebrafish, which means crucial cross-organ relationships are capturable,
        a feature not possible at reasonable prices with mice.  
      </p>
      
      <p className="roboto-slab-light text-base text-verydark mb-2 mt-10 leading-relaxed">
        <strong> We will run our data cycle continuously </strong> over the life of the 
        company to keep improving our biological foundation models for each new drug development project. 
        In its first incarnation, each turn of the cycle involves growing zebrafish,
        creating healthy, disease, and perturbation varieties,
        performing scRNA sequencing, using the results to train and fine-tune our models,
        learning from the inference results, and -- finally -- designing the next generation of
        experiments. By intelligently filling data gaps and fine-tuning our model architecture 
        over many generations, we expect to become the gold-standard for transcriptomic effect prediction
        for the drug categories we choose to specialize in.
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
        The Data Cycle represents our model development process. For each disease pathway we study,
        drug perturbation experiments on healthy and disease-model zebrafish will generate fresh scRNA sequencing data
        to train and fine-tune our biological foundation model to achieve state-of-the-art performance. 
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
        tsGPT 1.4. Inputs and outputs are structured as gene expression profiles, which are then interpreted
        back into biologically relevant phenotypic realities.
      </p>

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>Given our vision and capabilities, </strong>we now have the liberty to decide which therapeutic categories 
        to target first. Our intuition is that it will be the diseases most fundamentally driven by gene
        regulatory network abnormalities that stand to benefit the most from the transcriptomic biological foundation 
        models we&apos;re building. 
      </p>      

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        That&apos;s why we&apos;ve chosen to analyze the landscape disease targets through the lens of transcriptomic complexity.
        Diseases within chaotic, hard-to-model gene regulatory networks are the most difficult for scientists
        to confidently develop effective, non-toxic drugs for. These networks are often very sensitive to perturbation,
        meaning that small changes in the expression of one gene can have large downstream effects on other cells, tissues,
        and even entire organ systems. 
      </p>     

      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        It&apos;s exactly in this kind of environment that our biological foundation models will thrive.
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
        Transcriptomically simple versus transcriptomically complex disease pathways are visualized 
        in this side-by-side comparison.
        On the left, drugs like Insulin and Aspirin have relatively simple
        positive and negative pathway effects. On the right, a modern leukemia drug like MK-0752 invokes a 
        complex, sensitive cascade of events crucial to its efficacy (blue) and toxicity (red). 
        Most diseases we&apos;d like to develop treatments for have transcriptomically complex efficacy and toxicity
        effects, more like MK-0752 than insulin. 
      </p>


      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>So, how do we make money? </strong>
      </p>
      <p className="roboto-slab-light text-base text-verydark mb-4 leading-relaxed">
        <strong>There are two major pathways available to us.</strong> Either we pursue a SaaS-style 
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
        is more difficult to predict. Following the path Schrödinger pursued, we 
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
