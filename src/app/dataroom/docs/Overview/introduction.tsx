'use client';
import React from 'react';

const Introduction: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-medium text-xl text-gray-black mb-4 mt-4">
        Zeroshot Biolabs Data Room
      </h2>
      <p className="roboto-slab-regular text-base text-gray-black leading-relaxed mt-12 mb-4">
        Welcome.
      </p>
      <p className="roboto-slab-regular text-base text-gray-black leading-relaxed mb-8">
        Here you&apos;ll find documentation outlining our company&apos;s strategic outlook.
      </p>
      <ul className="list-disc ml-6 mb-4">
        <li className="roboto-slab-regular text-base text-gray-dark leading-relaxed">
          How do we think about the problem of biology?
        </li>
        <li className="roboto-slab-regular text-base text-gray-dark leading-relaxed">
          What aspects of AI do we believe will most successfully map to biology?
        </li>
        <li className="roboto-slab-regular text-base text-gray-dark leading-relaxed">
          How do we think about customers and our business model?
        </li>
        <li className="roboto-slab-regular text-base text-gray-dark leading-relaxed">
          Why do we believe polygenic AI-driven drug development will dominate the near future?
        </li>
      </ul>
      <p className="roboto-slab-regular text-base text-gray-black leading-relaxed mb-8 mt-8">
        Whether you are a potential investor, industry partner, customer, or community connector,
        we&apos;re excited to share our vision of the future of AI-driven biology with you.
      </p>
      <p className="roboto-slab-regular text-base text-gray-black leading-relaxed">
        For the most up-to-date information, please contact Steven:
      </p>
      <p className="mb-20">
        <a href="mailto:steven@zeroshot.bio" className="text-blue-600 hover:underline">
          steven@zeroshot.bio
        </a>.
      </p>
    </>
  );
};

export default Introduction;
