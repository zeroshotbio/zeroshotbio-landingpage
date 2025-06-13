import Image from "next/image";
import Link from "next/link";

const DesktopContent = () => (
  <main className="hidden sm:flex flex-col items-center justify-between sm:p-32 md:p-32 md:flex-col md:items-center">
    <div>
      <Image
        className="relative mx-auto"
        src="/images/zeroshot_bio_gritty.png"
        alt="zeroshotBio Logo"
        width={300}
        height={500}
        priority
      />
      {/* Text between images */}
      <p className="roboto-slab-medium text-lg text-gray-medium text-center mt-2 mb-4">
        Biology foundation models for therapeutic confidence.
      </p>
      <Image
        className="relative"
        src="/images/zeroshot_workflow_transparent.png"
        alt="zeroshotBio Logo"
        width={700}
        height={500}
        priority
      />
    </div>
      
    <div className="textboxmain w-full px-10 text-center mt-12 sm:mt-6 md:mt-12 lg:mt-16 sm:max-w-md md:max-w-md lg:max-w-md text-gray-dark">
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-tight mb-4 sm:whitespace-normal">
        AI-driven understanding of gene expression is beginning to deliver powerful new capabilities for therapeutics developers.
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-4 sm:whitespace-normal">
        At <strong>zeroshot bio</strong>,
        we create fine-tuning pipelines that translate zebrafish drug-exposure experiments
        into human pre-clincal insights.
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-2 sm:whitespace-normal">
        <strong>Why zebrafish?</strong>
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-8 sm:whitespace-normal">
        It&#39;s an increasingly popular animal model that provides whole-organism vertebrate physiology with unit-economics 
        ideally suited to the scale of data necessary for AI training.
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-12 sm:whitespace-normal">
        Combined with high-throughput scRNA sequencing, our team is able to create optimized compound rankings that accelerate 
        hit-to-lead decisions for therapeutics customers.
      </p>
      
      {/* Case Study Button */}
      <Link href="/case_study">
        <button className="group relative mb-16 px-8 py-3 border border-gray-400 text-gray-semidark roboto-slab-regular text-sm hover:border-gray-600 transition-all duration-300 ease-in-out transform hover:scale-105">
          <span className="relative z-10"> Demo: Embedding Space Visualization </span>
          <div className="absolute inset-0 bg-gray-100 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-in-out origin-left"></div>
        </button>
      </Link>
      
      <p className="roboto-slab-regular text-xxsm sm:text-sm md:text-sm text-gray-light leading-snug sm:whitespace-normal">
        Email <span className="text-gray-dark">steven@zeroshot.bio</span> 
      </p>
      <p className="roboto-slab-regular text-xxsm sm:text-sm md:text-sm text-gray-light leading-snug mb-4 sm:whitespace-normal">
        if you&#39;d like to get in touch. 
      </p>
      <dl className="w-1/2 mx-auto italic roboto-slab-regular text-xxxsm sm:text-xxsm md:text-xxsm text-gray-verylight leading-snug mb-4 mt-12 sm:whitespace-normal">
        <dt>
          zeroshot&nbsp;<span className="lowercase">/ˈziː.roʊ ˌʃɒt/</span>
        </dt>
        <dd className="mt-1">
          A model&#39;s ability to generate accurate predictions for contexts it was never explicitly trained on.
        </dd>
      </dl>
    </div>
  </main>
);

const MobileContent = () => (
  <main className="flex sm:hidden flex-col items-center justify-between md:p-24 md:flex-col md:items-center pb-20">
    <div className="pt-20">
      <Image
        className="block relative mx-auto"
        src="/images/zeroshot_bio_gritty.png"
        alt="zeroshotBio Logo"
        width={275}
        height={500}
        priority
      />
      {/* Text between images */}
      <p className="leading-tight roboto-slab-semibold text-base text-gray-medium text-center mt-4+">
        Biology foundation models for
      </p>
      <p className="leading-tight roboto-slab-semibold text-base text-gray-medium text-center mb-8">
        therapeutic confidence.
      </p>
      <Image
        className="block relative mx-auto"
        src="/images/fundamental_flow_for_mobile.png"
        alt="zeroshotBio Logo"
        width={350}
        height={500}
        priority
      />
    </div>
      
    <div className="textboxmain w-full px-10 text-center mt-12 sm:mt-6 md:mt-12 lg:mt-16 sm:max-w-md md:max-w-md lg:max-w-md text-gray-dark">
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-tight mb-4 sm:whitespace-normal">
        AI-driven understanding of gene expression is beginning to deliver powerful new capabilities for therapeutics developers.
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-4 sm:whitespace-normal">
        At <strong>zeroshot bio</strong>,
        we create fine-tuning pipelines that translate zebrafish drug-exposure experiments
        into human pre-clincal insights.
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-2 sm:whitespace-normal">
        <strong>Why zebrafish?</strong>
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-8 sm:whitespace-normal">
        It&#39;s an increasingly popular animal model that provides whole-organism vertebrate physiology with unit-economics 
        ideally suited to the scale of data necessary for AI training.
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-12 sm:whitespace-normal">
        Combined with high-throughput scRNA sequencing, our team is able to create optimized compound rankings that accelerate 
        hit-to-lead decisions for therapeutics customers.
      </p>
      
      {/* Case Study Button - Mobile */}
      <Link href="/case_study">
        <button className="group relative mb-16 px-6 py-3 border border-gray-400 text-gray-semidark roboto-slab-regular text-sm hover:border-gray-600 transition-all duration-300 ease-in-out transform hover:scale-105">
          <span className="relative z-10"> Demo: Embedding Space Visualization </span>
          <div className="absolute inset-0 bg-gray-100 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-in-out origin-left"></div>
        </button>
      </Link>
      
      <p className="roboto-slab-regular text-xxsm sm:text-sm md:text-sm text-gray-light leading-snug sm:whitespace-normal">
        Email <span className="text-gray-dark">steven@zeroshot.bio</span> 
      </p>
      <p className="roboto-slab-regular text-xxsm sm:text-sm md:text-sm text-gray-light leading-snug mb-4 sm:whitespace-normal">
        if you&#39;d like to get in touch. 
      </p>
      <dl className="w-1/2 mx-auto italic roboto-slab-regular text-xxxsm sm:text-xxsm md:text-xxsm text-gray-verylight leading-snug mb-4 mt-12 sm:whitespace-normal">
        <dt>
          zeroshot&nbsp;<span className="lowercase">/ˈziː.roʊ ˌʃɒt/</span>
        </dt>
        <dd className="mt-1">
          A model&#39;s ability to generate accurate predictions for contexts it was never explicitly trained on.
        </dd>
      </dl>
    </div>
  </main>
);

export default function Home() {
  return (
    <>
      <DesktopContent />
      <MobileContent />
    </>
  );
}