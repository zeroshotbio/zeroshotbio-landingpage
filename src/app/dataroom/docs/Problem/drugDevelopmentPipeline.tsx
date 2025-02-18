'use client';
import React from 'react';
import Image from 'next/image';

const DrugDevelopmentPipeline: React.FC = () => {
  return (
    <div>
      <h2 className="roboto-slab-semibold text-xl text-gray-800 mb-4">
        Confidence from Pre-Clinical Studies is Poor
      </h2>
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Text Column */}
        <div className="flex-1">
        <h2 className="roboto-slab-semibold text-xl text-gray-800 mb-4">

        </h2>
          <p className="roboto-slab-regular text-base text-gray-semidark leading-relaxed mb-4">
            <strong>Very poor pre-clinical confidence</strong> is holding drugs back.{' '}
            <strong>Phase I drug success rates</strong> are low and declining.
          </p>
          <ul className="list-disc ml-6 mb-4">
            <li className="roboto-slab-regular text-base text-gray-semidark leading-relaxed">
              <strong>Before 2006:</strong> ~21.5%
            </li>
            <li className="roboto-slab-regular text-base text-gray-semidark leading-relaxed">
              <strong>2006 - 2015:</strong> ~9.6%
            </li>
            <li className="roboto-slab-regular text-base text-gray-semidark leading-relaxed">
              <strong>2014 - 2023:</strong> ~6.7%
            </li>
          </ul>
          <p className="roboto-slab-regular text-base text-gray-semidark leading-relaxed mb-4">
            This bottleneck is very expensive.
          </p>
          <p className="roboto-slab-regular text-base text-gray-semidark leading-relaxed mb-4">
            <strong>Ambitious therapeutics</strong> go unattempted, and{' '}
            <strong>lucrative opportunities</strong> remain unexplored.
          </p>
          <ul className="list-disc ml-6">
            <li className="roboto-slab-regular text-base text-gray-semidark leading-relaxed">
              Animal models frequently fail to translate well to human results.
            </li>
            <li className="roboto-slab-regular text-base text-gray-semidark leading-relaxed">
              Crucial toxicities are missed and efficacy is misrepresented.
            </li>
          </ul>
        </div>
        {/* Image Column */}
        <div className="w-full sm:w-1/2">
          <Image 
            src="/images/dataroom_images/Re-Done Clinical Trials Graphic.png"
            alt="Revised Clinical Trials Graphic"
            width={800}
            height={450}
            className="object-contain"
          />
        </div>
      </div>
    </div>
  );
};

export default DrugDevelopmentPipeline;
