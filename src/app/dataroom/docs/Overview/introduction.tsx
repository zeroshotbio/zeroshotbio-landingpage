'use client';
import React from 'react';

const Introduction: React.FC = () => {
  return (
    <>
      <h2 className="roboto-slab-semibold text-xl text-gray-800 mb-4">
        Welcome to the Zeroshot Bio Data Room
      </h2>
      <p className="roboto-slab-regular text-base text-gray-semidark leading-relaxed mb-4">
        Welcome to the data room of <strong className="roboto-slab-semibold">Zeroshot Bio</strong>—a dedicated space where 
        innovation meets clarity. Here, you will find a comprehensive overview of our groundbreaking approach to drug 
        development, leveraging advanced AI-driven biological foundation models alongside the unique strengths of zebrafish 
        research.
      </p>
      <p className="roboto-slab-regular text-base text-gray-semidark leading-relaxed mb-4">
        Our data room has been designed with sophistication and transparency in mind. In the sections that follow, you’ll explore 
        our business strategy, technological advancements, and market positioning—all presented with the clarity and precision 
        that underscore our commitment to data-driven innovation. Each section is meticulously curated to offer deep insights 
        into the science behind our platform and the strategic opportunities that set us apart in the competitive biotech landscape.
      </p>
      <p className="roboto-slab-regular text-base text-gray-semidark leading-relaxed mb-4">
        Whether you are a potential investor, industry partner, or simply curious about the future of preclinical research, 
        this data room provides an engaging, informative look into how Zeroshot Bio is reshaping drug discovery. Our integrated 
        approach combines massive, high-quality single-cell data with state-of-the-art AI analytics, ensuring that every new 
        experiment enriches our understanding and enhances our predictive capabilities.
      </p>
      <p className="roboto-slab-regular text-base text-gray-semidark leading-relaxed">
        For further information or to discuss potential collaborations, please contact us at{' '}
        <a href="mailto:steven@zeroshot.bio" className="text-blue-600 hover:underline">
          steven@zeroshot.bio
        </a>.
      </p>
    </>
  );
};

export default Introduction;
