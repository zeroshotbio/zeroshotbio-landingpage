'use client';
import React from 'react';

const C_Customers: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        Customer Strategy Overview
      </h2>

      <p className="roboto-slab-light text-base mb-10 mt-12 leading-relaxed">
        <strong>SaaS Platform Customers.</strong> For our Software-as-a-Service offering, the customer base is broad and dynamic. Our primary clients will include biotechnology companies, pharmaceutical research organizations, academic research institutions, and contract research organizations. These customers rely on high-resolution, transcriptomic insights to make critical decisions early in drug discovery. Our platform will offer them robust pathway mapping, target validation, resistance mechanism prediction, and multi-target therapeutic modeling—all delivered through an intuitive, subscription-based interface. By catching potential failures early and streamlining the discovery process, our clients will save significant time and capital. The service model is designed to integrate seamlessly with existing R&D workflows, providing actionable intelligence that reinforces confidence in preclinical outcomes without venturing into the realm of chemical structure design.
      </p>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
        <strong>Big Pharma and Drug Candidate Licensing.</strong> In parallel, we envision a customer strategy inspired by the Schrödinger Nimbus Takeda model. Here, our target customers are major pharmaceutical companies like Takeda and others, looking for high-value, preclinically validated drug candidates. This approach involves developing select compounds through rigorous transcriptomic analysis to achieve proof-of-concept before handing them off to big pharma. Our expertise in disease pathway understanding will allow us to pinpoint candidates with strong translational potential, making them attractive for licensing or outright acquisition. These transactions are expected to be in the range of $100 million batches, supplemented with milestone payments and royalties. In this scenario, our customers are not just purchasing a drug candidate—they are investing in our AI-driven preclinical confidence that de-risks the path to clinical trials.
      </p>

      <p className="roboto-slab-light text-base mb-10 leading-relaxed">
        <strong>Dual Approach, Unified Vision.</strong> Whether through a SaaS model or direct drug candidate licensing, our customer strategy is built on the foundation of deep biological insight. For SaaS clients, our tools provide a continuous stream of predictive analytics to inform decision-making. For big pharma partners, our candidate generation leverages the same advanced transcriptomic models to produce assets that are ready to transition into clinical trials. This dual strategy allows Zeroshot Biolabs to capture a substantial share of the market by addressing both early-stage discovery and later-stage asset development. By focusing on disease pathway understanding rather than chemical synthesis, we remain true to our core competency, ensuring that our offerings are both unique and highly valuable in the competitive landscape of drug discovery.
      </p>
    </>
  );
};

export default C_Customers;
