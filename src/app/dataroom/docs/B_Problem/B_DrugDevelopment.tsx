'use client';
import React from 'react';
import Image from 'next/image';

const TherapeuticComplexity: React.FC = () => {
  return (
    <div>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        The Drug Development Landscape
      </h2>

      <p className="roboto-slab-light text-base mb-6 mt-12 leading-relaxed">
        <strong> Disease categories </strong> that require the most transcriptomically-complex interventions 
        are also where drug developers using classical methods struggle the most. 
        Biological foundation models thrive on complexity; it's where they have the most potential
        to help drug developers significantly move the needle.
      </p>

      <p className="roboto-slab-light text-base mb-2 mt-4 leading-relaxed">
        <strong> The intersection of transcriptomic complexity and 
        monetary impact </strong> is where Zeroshot biolabs is most likely to succeed 
        in making a significant, disruptive impact.
      </p>

      <p className="roboto-slab-light text-base mb-2 mt-4 leading-relaxed">
        So, we started by creating a map of the top ~300 successfully approved, in-market drugs 
        and organized it by: 
      </p>
      <ul className="text-gray-dark roboto-slab-regular text-xm mt-4 mb-6">
        <li>- Disease category</li>
        <li>
          - Transcriptomic complexity 
          <span className="roboto-slab-light text-xsm text-gray-light"> (dark orange vs light blue)</span>
        </li>
        <li>
          - Monetary impact 
          <span className="roboto-slab-light text-xsm text-gray-light"> (rectangle size)</span>
        </li>
      </ul>

      <div className="w-full">
        <figure className="text-left m-0">
          <iframe
            src="/d3_complexity_heatmap.html"
            className="w-full h-[970px] block"
            title="D3 Treemap"
          ></iframe>
          <Image
            src="/images/dataroom_images/tree_map_legend.png"
            alt="IO-healthy-disease"
            width={630}
            height={100}
            className="object-contain mt-0"
          />
        </figure>
      </div>

      <p className="roboto-slab-extralight text-xxsm mb-0 mt-2 leading-relaxed">
        The data in the map above was organized by ChatGPT's Deep Research. We double checked many 
        individual data points and are confident that the overall picture is quite accurate.
        The transcriptomic complexity score was estimated by considering how many genes and pathways 
        are known to be involved in the underlying pathology, how intricate the gene regulatory networks are, 
        and how much the disease process disrupts normal cellular transcriptomic patterns.
      </p>

      <p className="roboto-slab-light text-base mt-10 leading-relaxed">
        <strong> Unsurprisingly, </strong> complex gene networks are a critical part of most 
        approved therapeutics. Disease categories like cancer, autoimmune, gene therapy,
        and transplant stand out as having more drugs that act on complex networks.
      </p>

      <p className="roboto-slab-light text-base mt-6 mb-2 leading-relaxed">
        <strong> Remember, this map is essentially a snapshot of the past. </strong> It represents the successes
        of drug development from classical methods over the past century. Our thesis and strong opinion is that 
        most of these successes represent mother nature's 'low-hanging-fruit'; as different researchers working on 
        different diseases over the past century began to more deeply understand the underlying biology of their 
        focus area, some happened to have simpler underlying causes that were easier to develop drugs for.
        Many of the blue areas in the map above represent these 'low-hanging-fruit' success stories.
      </p>

      <p className="roboto-slab-light text-base mt-6 mb-8 leading-relaxed">
        <strong> As with all of science, however, the low-hanging-fruit run out. </strong> 
        Most diseases we care about having cures for will require fundamentally greater bioengineering sophistication 
        than classical methods have been capable of providing.
        Our view is that most drug success stories developed for complex disease indications have either happened as a 
        result of disproportionately massive research efforts, trial &amp; error, luck, or all of the above. 
      </p>

      <p className="roboto-slab-light text-base mt-12 mb-6 leading-relaxed">
        <strong> As we look to the future of biology, </strong> this map is more important. It visualizes
        the top ~300 disease indications where need for treatment is most dire.
        This map is organized the same way as the previous one:
      </p>
      <ul className="text-gray-dark roboto-slab-regular text-xm mt-4 mb-6">
        <li>- Disease category</li>
        <li>
          - Transcriptomic complexity 
          <span className="roboto-slab-light text-xsm text-gray-light"> (dark orange vs light blue)</span>
        </li>
        <li>
          - Monetary impact 
          <span className="roboto-slab-light text-xsm text-gray-light"> (rectangle size)</span>
        </li>
      </ul>

      <div className="w-full">
        <figure className="text-left mb-4">
          <iframe
            src="/prospective_diseases_treemap.html"
            className="w-full h-[970px] block"
            title="D3 Treemap"
          ></iframe>
          <Image
            src="/images/dataroom_images/tree_map_legend.png"
            alt="IO-healthy-disease"
            width={630}
            height={100}
            className="object-contain mt-0"
          />
        </figure>
      </div>

      <p className="roboto-slab-extralight text-xxsm mb-12 mt-2 leading-relaxed">
        The data in the map above was organized by ChatGPT's Deep Research. We double checked many 
        individual data points and are confident that the overall picture is quite accurate.
        The transcriptomic complexity score was estimated by considering how many genes and pathways 
        are known to be involved in the underlying pathology, how intricate the gene regulatory networks are, 
        and how much the disease process disrupts normal cellular transcriptomic patterns.
      </p>

      <p className="roboto-slab-light text-base mb-4 leading-relaxed">
        The difference between the two maps speaks for itself: <strong> the disease indications
        we care most about developing treatments for are also the most transcriptomically complex. </strong>
        This reality is paintuflly reflected in the general trend we see in clinical trial failure rates. 
        Fundamentally new approaches are necessary to understand and create effective therapeutic strategies
        that better account for the complexity of the underlying biology. 
      </p>

      <p className="roboto-slab-light text-base mb-20 leading-relaxed">
        We believe the future of drug development will begin to rely heavily on 
        biological foundation models that help drug developers understand complex gene networks and
        create sophisticated, fine-tuned, polygenic drugs that effectively target them.
      </p>
    </div>
  );
};

export default TherapeuticComplexity;
