'use client';
import React from 'react';

const C_BusinessModel: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        Our Business Model & Path to Revenue
      </h2>

      <p className="roboto-slab-light text-base mb-4 mt-12 leading-relaxed">
        <strong>The global market for AI in drug discovery is substantial and continues 
        to grow rapidly.</strong> Industry analysts placed the segment at approximately $500M 
        in 2020, with a projected CAGR of 40%. By the late 2020s, that translates into a 
        multi‐billion‐dollar market, driven by pharma and biotech companies seeking robust 
        computational tools to accelerate their R&D pipelines. By providing 
        a platform that can help prevent the waste of hundreds of millions of dollars 
        on failed compounds, our tsGPT solution can command premium subscription or service fees.
      </p>

      <p className="roboto-slab-light text-base mb-8 mt-2 leading-relaxed">
        Our suite of offerings reflects a dual‐track strategy: 
        first, a SaaS or subscription‐based model for our AI platform, 
        and second, a selective approach to internally developed drug candidates. 
        We carefully craft this combination to leverage the most scalable parts of our 
        technology, while also capturing value when opportunities for drug discovery arise.
      </p>

      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        1. A SaaS‐Driven Services Model
      </h3>
      <p className="roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <strong>Our core offering revolves around a subscription‐based platform</strong> 
        that gives pharmaceutical and biotech customers access to tsGPT’s multi‐species 
        toxicity and efficacy predictions. This structure follows a well‐proven SaaS business model:
      </p>
      <ul className="list-disc pl-8 roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <li><strong>Annual License/Subcription Fees: </strong>Clients pay for ongoing access to tsGPT’s 
          predictive analytics suite. This includes regular model updates and the ability 
          to run new compounds through multi‐species screens without building or managing 
          in‐house AI infrastructure.</li>
        <li><strong>Premium Features & Custom Integrations: </strong>Pharmaceutical enterprises often require 
          specialized modules—such as advanced synergy predictions or custom pathways 
          for specific therapeutic areas. These features are available as add‐ons or 
          enterprise tiers.</li>
        <li><strong>Strategic Data Partnerships: </strong>We can also form data‐for‐discount arrangements, 
          where certain fees are offset if the client shares proprietary 
          single‐cell datasets. This helps us continually expand and refine tsGPT’s knowledge.
        </li>
      </ul>
      <p className="roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        This recurring revenue model ensures our core business remains scalable, 
        allowing us to invest in the platform’s ongoing development. 
        Critically, <strong>we remain primarily a “disease pathways understanding” 
        and “discovery” company,</strong> rather than a chemistry operation—reinforcing 
        that our expertise is in bioinformatics and advanced AI.
      </p>


      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        2. Select Internal Development: Following a Schrödinger‐Type Model
      </h3>
      <p className="roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <strong>We carefully choose certain indications</strong>—such as rare diseases 
        or high‐potential oncology pathways—where we believe tsGPT can rapidly identify 
        novel molecular interventions. By taking a handful of these candidates forward 
        to proof‐of‐concept, we can:
      </p>
      <ul className="list-disc pl-8 roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <li>
          <strong>Out‐License or Sell Drug Programs: </strong>Just as Schrödinger packaged its 
          computationally developed candidate into a subsidiary and sold it to Takeda for $4 
          billion after Phase II validation, we would similarly monetize these assets by licensing 
          or selling them to pharma partners for later‐stage clinical development. Recent industry 
          precedents include Merck acquiring Modifi Biosciences&apos; pre‐clinical oncology assets for 
          up to $1.3 billion and Bristol Myers Squibb&apos;s $300 million upfront payment to IFM 
          Therapeutics for pre‐clinical immune-oncology programs.
        </li>
        <li>
          <strong>Retain Our Core Focus: </strong>Because the heavy lift of conducting Phase II 
          and III trials remains with partners, we preserve our R&D resources for what we do 
          best—building and refining advanced AI capabilities for multi‐species drug discovery. 
          This strategic focus allows us to rapidly iterate, generating multiple promising 
          candidates while remaining lean and efficient.
        </li>
      </ul>

      <div className="mb-6">
        <h4 className="roboto-slab-medium text-md text-gray-dark mb-3">Recent Pre-Clinical Success Stories:</h4>
        <ul className="list-disc pl-8 roboto-slab-light text-base text-verydark leading-relaxed">
          <li>
            <strong>Merck & Modifi Biosciences (2024):</strong> $30M upfront and up to $1.3B total for pre-clinical oncology assets.
          </li>
          <li>
            <strong>Bristol Myers Squibb & IFM Therapeutics (2017):</strong> $300M upfront with potential milestones exceeding $1B for immune-oncology assets.
          </li>
          <li>
            <strong>AstraZeneca & Dogma Therapeutics (2020):</strong> Acquisition of pre-clinical oral PCSK9 inhibitor program aimed at cardiovascular disease.
          </li>
          <li>
            <strong>Gilead & Galapagos NV (2019):</strong> $3.95B upfront deal, significant value placed on pre-clinical and discovery-stage assets.
          </li>
        </ul>
      </div>

        <p className="roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
          This approach enables us to participate in the successes of our best leads while avoiding 
          operational overextension into domains like high‐volume medicinal chemistry or large 
          clinical trial management—capabilities better suited to big pharma. It&apos;s a model proven 
          successful in the computational biology space.
        </p>



      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        3. Drug Repurposing as a Quick‐Win Pipeline
      </h3>
      <p className="roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <strong>Many diseases lack effective therapies, yet thousands of clinically validated compounds remain on the shelf.</strong> With tsGPT, we can efficiently screen these compounds for viability in new indications, leveraging our “all‐vs‐all” computational approach where multi‐species gene signatures are compared across hundreds of disease contexts and existing drugs. Successful computational repurposing stories underscore this opportunity:
      </p>
      <ul className="list-disc pl-8 roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <li>
          <strong>Rapid Timelines: </strong>Repurposed therapies can sometimes move into Phase II proof‐of‐concept within 3–5 years, significantly faster than the 7–10 year horizon for de novo drug development. For example, the Exscalate4Cov consortium rapidly identified raloxifene—an osteoporosis medication—as a promising COVID-19 treatment candidate within months using computational screening.
        </li>
        <li>
          <strong>Value Proposition: </strong>The safety profile of these compounds is typically established, drastically lowering clinical development risks. Companies like Biovista and SOM Biotech have successfully demonstrated efficacy in repurposed drugs for neurological and rare diseases, leveraging established safety profiles to accelerate clinical progress.
        </li>
        <li>
          <strong>Revenue Potential: </strong>We may structure these repurposing collaborations similarly, offering resulting intellectual property or exclusive licenses to pharma partners for clinical advancement. This approach can rapidly generate revenue streams through milestone payments and licensing agreements.
        </li>
      </ul>
      <div className="mb-6">
        <h4 className="roboto-slab-medium text-md text-gray-dark mb-3">
          Recent Pre-Clinical Success Stories:
        </h4>
        <ul className="list-disc pl-8 roboto-slab-light text-base text-verydark leading-relaxed">
          <li>
            <strong>Exscalate4Cov Consortium (2020):</strong> Repurposed raloxifene as a COVID-19 candidate, expediting clinical evaluation within months.
          </li>
          <li>
            <strong>Biovista Inc. (since 2005):</strong> Secured strategic partnerships with upfront deals in the tens-of-millions for repurposing compounds in CNS and rare diseases.
          </li>
          <li>
            <strong>SOM Biotech (est. 2009):</strong> Repositioned SOM3355 for Huntington’s chorea, achieving milestone deals reportedly exceeding $50M.
          </li>
          <li>
            <strong>Insilico Medicine (founded 2014):</strong> Leveraged the PandaOmics platform to drive multi-million dollar licensing agreements for repurposed drug candidates.
          </li>
          <li>
            <strong>COVID Moonshot Initiative (2020):</strong> Crowdsourced over 10,000 compound designs, advancing select candidates into preclinical testing within 6 months.
          </li>
        </ul>
      </div>
      <p className="roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        This complements our core SaaS and early‐stage development efforts, delivering near‐to‐mid‐term gains when a repurposed candidate quickly demonstrates efficacy in a new indication, mirroring successes seen with modern computational biology platforms like Insilico Medicine and the COVID Moonshot initiative.
      </p>





      <h3 className="roboto-slab-medium text-lg text-gray-dark mb-4">
        4. Our Core Competency: AI and Biological Network Mastery
      </h3>
      <p className="roboto-slab-light text-base text-verydark mb-6 leading-relaxed">
        <strong> We want to stay focused </strong> 
        on an understanding of biology from the gene networks perspective. We are not aiming 
        to build a complex chemistry operation nor run human clinical trials. Instead, 
        we strive to master pre-clinical predictions of the effects of drugs on 
        disease pathways.
      </p>

      <p className="roboto-slab-light text-base text-verydark mt-12 mb-12 leading-relaxed">
        <strong>In short, our revenue strategy</strong> combines stable recurring 
        SaaS revenues from enterprise customers alongside larger milestone‐based cash 
        inflows from selectively developed drug assets or repurposed therapy partnerships. 
        This balanced model supports ongoing platform innovation, fuels our data‐driven 
        growth, and allows Zeroshot Biolabs to stay at the frontier of 
        biological foundation model breakthroughs.
      </p>
    </>
  );
};

export default C_BusinessModel;
