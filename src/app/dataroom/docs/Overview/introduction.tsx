'use client';
import React from 'react';

const Introduction: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-verydark mb-4 mt-4">
        Zeroshot Biolabs Data Room
      </h2>
      <p className="roboto-slab-regular text-base text-gray-semidark leading-relaxed mt-12 mb-4">
        Welcome.
      </p>
      <p className="roboto-slab-regular text-base text-gray-semidark leading-relaxed mb-8">
        Here you&apos;ll find further documentation outlining our company&apos;s strategic, data-driven outlooks.
      </p>
      <ul className="list-disc ml-6 mb-4">
        <li className="roboto-slab-regular text-base text-gray-semidark leading-relaxed">
          How do we think about the problem of biology?
        </li>
        <li className="roboto-slab-regular text-base text-gray-semidark leading-relaxed">
          What aspects of AI do we believe will fruitfuly map to biology?
        </li>
        <li className="roboto-slab-regular text-base text-gray-semidark leading-relaxed">
          How do we think about customers and our business model?
        </li>
        <li className="roboto-slab-regular text-base text-gray-semidark leading-relaxed">
          Why do we believe polygenic AI-driven drug-development will dominate the near future?
        </li>
      </ul>
      <p className="roboto-slab-regular text-base text-gray-semidark leading-relaxed mb-8 mt-8">
        Whether you are a potential investor, industry partner, customer, or community connector,
        we&apos;re excited to share our vision of the future of AI-driven biology with you.
      </p>
      <p className="roboto-slab-regular text-base text-gray-semidark leading-relaxed mb-12">
        For further information or to discuss potential collaborations, please contact us at{' '}
        <a href="mailto:steven@zeroshot.bio" className="text-blue-600 hover:underline">
          steven@zeroshot.bio
        </a>.
      </p>
    </>
  );
};

export default Introduction;
