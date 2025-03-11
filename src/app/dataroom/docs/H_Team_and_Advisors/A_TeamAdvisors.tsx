'use client';
import React from 'react';

const TeamAdvisors: React.FC = () => {
  return (
    <div className="team-advisors-page">
      <h2 className="roboto-slab-bold text-xl text-gray-verydark mb-6">
        Core Team
      </h2>

      {/* Co-Founders Section */}
      <div className="team-category mb-8">
        <h3 className="roboto-slab-medium text-lg text-gray-dark mb-2">
          Co-Founders
        </h3>
        <ul className="list-disc ml-8">
          <li className="mb-4">
            <strong>CEO – Steven ten Holder -- 40%</strong>
            <p className="roboto-slab-regular text-base text-gray-semidark ml-4 mt-1 leading-relaxed">
              Steven is a bioengineer and entrepreneur from the University of Waterloo. He co-founded 
              Acorn Biolabs—a biotech startup focused on non-invasive cell collection and cryopreservation—accelerated 
              by Y Combinator and backed by over $11M in investments. Credited as an inventor on key patents, he 
              also developed a CRISPR anti-viral system for Arabidopsis, earning recognition from iGEM. Steven brings his
              leadership, strategic, and technical capabilities to Zeroshot Biolabs as its CEO.
            </p>
          </li>
          <li className="mb-4">
            <strong>CTO – Darien Schettler -- 25%</strong>
            <p className="roboto-slab-regular text-base text-gray-semidark ml-4 mt-1 leading-relaxed">
              Darien is an accomplished machine learning engineer at VMware, specializing in advanced generative 
              AI systems. With a strong interdisciplinary background in Biological Sciences and Systems 
              Engineering, he bridges the gap between computational innovation and real-world biological 
              challenges. His work in developing baseline models for histopathologic cancer detection, 
              along with his expertise in deep learning and large-scale model deployment, positions him 
              as a key leader in tackling data-intensive biotech problems.
            </p>
          </li>
          <li className="mb-4">
            <strong>CSO – Patrick Pumputis -- 25%</strong>
            <p className="roboto-slab-regular text-base text-gray-semidark ml-4 mt-1 leading-relaxed">
              Patrick is a dedicated scientist and cell biology researcher pursuing a PhD in Molecular Genetics 
              at the University of Toronto. With a Master&apos;s in Cellular Biology and a Bachelor&apos;s in Biological 
              and Biomedical Sciences from the University of Waterloo, he co-founded Acorn Biolabs. As Science 
              Ambassador, he has driven core technology development and study design. His research, exemplified 
              by his recent preprint on oxidative stress and ECM remodeling, highlights his commitment to 
              innovative biological discovery. 
            </p>
          </li>
        </ul>
      </div>

      {/* Regular Team Section */}
      <div className="team-category mb-8">
        <h3 className="roboto-slab-medium text-lg text-gray-dark mb-2">
          Founding Scientist
        </h3>
        <ul className="list-disc ml-8">
          <li className="mb-4">
            <strong>Head of Research - Harsha Murthy -- 4%</strong>
            <p className="roboto-slab-regular text-base text-gray-semidark ml-4 mt-1 leading-relaxed">
              Harsha is a seasoned zebrafish wrangler and expert laboratory technician with a Master’s in 
              Basic Medical Sciences from Wayne State University and a strong foundation in research from 
              the University of Waterloo. His extensive experience in managing zebrafish colonies and conducting 
              precise lab operations—honed at The Hospital for Sick Children—ensures high standards in 
              experimental execution and data collection. Harsha&apos;s hands-on expertise is critical for 
              maintaining our cutting-edge animal model systems.
            </p>
          </li>
        </ul>
      </div>

      {/* Advisory Team Section */}
      <div className="team-category mb-8">
        <h3 className="roboto-slab-medium text-lg text-gray-dark mb-2">
          Advisers
        </h3>
        <ul className="list-disc ml-8">
          <li className="mb-4">
            <strong> Dr. Sam Scanga </strong>
            <p className="roboto-slab-regular text-base text-gray-semidark ml-4 mt-1 leading-relaxed">
              ​Dr. Sam Scanga is a distinguished researcher and leader in the field of genetics, currently serving 
              as the Director of Research at NeuroTheryX. He earned his Ph.D. in Genetics from the University of 
              Toronto in 1998, following a Master of Science in Genetics and Developmental Biology from the same 
              institution. Dr. Scanga&apos;s extensive expertise in genetic research has been instrumental in advancing 
              NeuroTheryX&apos;s mission to develop innovative therapies for neurological disorders. His leadership and 
              scientific acumen have positioned him as a key figure in the biotechnology sector, contributing 
              significantly to the understanding and treatment of complex genetic conditions.
            </p>
          </li>
        </ul>
      </div>

    </div>
  );
};

export default TeamAdvisors;
