'use client';
import React from 'react';

const TeamAdvisors: React.FC = () => {
  return (
    <div className="team-advisors-page">
      <h2 className="roboto-slab-medium text-xl text-gray-dark mb-8 mt-4">
        The Zeroshot Biolabs Founding Team
      </h2>

      <p className="roboto-slab-light text-base mb-6 leading-relaxed">
        As a brief introduction to the team, Steven ten Holder and Patrick Pumputis previously co-founded and exited from 
        Acorn Biolabs, a YC-backed biology startup still growing today (Acorn just finished Series A; Steven & Patrick&apos;s 
        exit was via secondary). Darien Schettler is a Staff II (L6) generative AI architect and 2x Kaggle Grandmaster 
        who previously worked with Steven and Patrick at Acorn. Last but not least, Harsha Murthy is an expert zebrafish 
        wrangler and scientist.k
      </p>

      {/* Co-Founders Section */}
      <div className="team-category mb-8">
        <h3 className="roboto-slab-medium text-lg text-gray-dark mb-2">
          Co-Founders
        </h3>
        <ul className="list-disc ml-8">
          <li className="mb-6">
            CEO – Steven ten Holder -- 40%
            <p className="roboto-slab-light text-base mb-6 leading-relaxed">
              Steven is a bioengineer and entrepreneur from the University of Waterloo. He co-founded 
              Acorn Biolabs—a biotech startup focused on non-invasive cell collection and cryopreservation—accelerated 
              by Y Combinator and backed by over $11M in investments. Credited as an inventor on key patents, it was his
              original vision, organization, leadership and execution that enabled Acorn Biolabs to get off the ground.
              He also previously developed a CRISPR anti-viral system for Arabidopsis, and worked with mathematical modelers
              from Waterloo&apos;s applied math department to recreate genetic engineered biology systems to study plasmid
              incompatibility. Steven brings leadership, strategic, and technical capabilities to Zeroshot Biolabs as its CEO.
            </p>
          </li>
          <li className="mb-6">
            CTO – Darien Schettler -- 25%
            <p className="roboto-slab-light text-base mb-6 leading-relaxed">
              Darien is an accomplished machine learning engineer at VMware, specializing in advanced generative 
              AI systems. With a strong interdisciplinary background in biological sciences and systems 
              engineering, he bridges the gap between computational innovation and real-world biological 
              challenges. His work in developing baseline models for histopathologic cancer detection, 
              along with his expertise in deep learning and large-scale model deployment positions him 
              as a key leader in tackling data-intensive biotech problems.
              Notably, Darien has achieved the rank of Discussions Grandmaster on Kaggle, reflecting his significant 
              contributions to the machine learning community.
            </p>
          </li>
          <li className="mb-4">
            CSO – Patrick Pumputis -- 25%
            <p className="roboto-slab-light text-base mb-6 leading-relaxed">
              Patrick is an exited biotech founder and cell biology researcher currently finishing his PhD in Molecular Genetics 
              at the University of Toronto. He also has a Master&apos;s in Cellular Biology and a Bachelor&apos;s in Biological 
              and Biomedical Sciences from the University of Waterloo. Patrick previously co-founded Acorn Biolabs with Steven 
              ten Holder where he laid down the foundational scientific groundwork for Acorn and led the execution
              of the bioengineering workflows necessary to launch the Acorn cell cryopreservation service itself. 
              His PhD research leverages zebrafish models to uncover the molecular drivers 
              behind adolescent idiopathic scoliosis, highlighting groundbreaking links between oxidative stress, 
              spinal stiffness, and skeletal deformities.
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
            Head of Research - Harsha Murthy -- 4%
            <p className="roboto-slab-light text-base mb-6 leading-relaxed">
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
            <p className="roboto-slab-light text-base mb-6 leading-relaxed">
              <strong>Dr. Brian Ciruna</strong> is a Senior Scientist and Head of the Developmental, Stem Cell & Cancer 
              Biology program at The Hospital for Sick Children (SickKids) in Toronto, as well as a Professor in the 
              Department of Molecular Genetics at the University of Toronto. He earned his Ph.D. in Genetics from 
              the University of Toronto and completed postdoctoral training in zebrafish developmental genetics at 
              the NYU School of Medicine. Dr. Ciruna&apos;s research focuses on understanding the molecular and genetic 
              mechanisms that govern embryonic development, particularly the formation of the brain and spinal cord, 
              and how disruptions in these processes can lead to birth defects and pediatric diseases. Utilizing 
              zebrafish as a model organism, his lab combines experimental embryology with advanced genetic and live 
              imaging technologies to study these developmental processes.
            </p>
          </li>
        </ul>
        <ul className="list-disc ml-8">
          <li className="mb-4">
            <p className="roboto-slab-light text-base mb-6 leading-relaxed">
              ​<strong>Dr. Sam Scanga</strong> is a researcher and leader in the field of genetics, currently serving 
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
