'use client';
import React from 'react';

const C_FutureIdeas: React.FC = () => {
  return (
    <div className="future-ideas-page">
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        A Few Specific Ambitious Ideas for the Near Future
      </h2>

      {/* 1. Embracing Polypharmaco-Development (unchanged) */}
      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        <strong>Embracing Polypharmaco-Development.</strong> The complexity of biology often renders single-target
        drugs insufficient, particularly in diseases driven by intricate gene-regulatory networks. Leveraging tsGPT&apos;s
        ability to elucidate complex transcriptomic interactions, we&apos;re exploring multi-target approaches as drug
        development strategies in ways that have never been considered before. By designing strategic combinations —
        or “cocktails” — of drugs targeting complementary nodes within regulatory networks, there&apos;s the potential to
        fine-tune the knobs and dials of many different points along a gene regulatory pathway cascade. This
        polypharmacological strategy enhances treatment effectiveness, minimizes the likelihood of resistance, and
        offers tailored solutions that align closely with the evolving biology of complex diseases.
      </p>

      {/* 2. Mapping Cancer Evolution and Resistance (unchanged) */}
      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        <strong>Mapping Cancer Evolution and Resistance.</strong> Cancer&apos;s ability to adapt presents a continuous
        challenge in oncology. Our vision is to leverage tsGPT to reveal how tumors evolve over time at the
        transcriptomic level, illuminating hidden pathways of resistance as they emerge. By predicting these
        evolutionary trajectories, tsGPT can proactively guide the selection of targeted treatments, helping
        scientists anticipate—and ideally circumvent—drug resistance before it occurs. This approach turns
        transcriptomic complexity into actionable insights, empowering drug developers to design therapies one step
        ahead of cancer&apos;s evolution.
      </p>


      {/* 4. Next-Generation Drug Repurposing */}
      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        <strong>Next-Generation Drug Repurposing.</strong> As tsGPT matures, it will rapidly analyze established
        compounds against diverse gene-expression profiles. By matching existing drug signatures to disease states
        far beyond their original indications, we can drastically shorten development cycles. This approach not
        only reduces cost and risk but also unlocks therapeutic potential in overlooked or shelved compounds—reviving
        them for new clinical purposes.
      </p>

    </div>
  );
};

export default C_FutureIdeas;
