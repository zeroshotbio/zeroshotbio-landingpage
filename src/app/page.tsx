import Image from "next/image";

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
        AI-driven understanding of gene expression patterns are delivering powerful new capabilities for therapeutics developers.
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-4 sm:whitespace-normal">
        At <strong>zeroshot bio</strong>, we create customized gene expression foundation models that deliver drug discovery confidence.
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-8 sm:whitespace-normal">
        We specialize in cross-species fine-tuning that enables translation between large-scale animal-model drug-exposure experiments
        and human-relevant insights.
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-2 sm:whitespace-normal">
        Our first animal-model-of-choice?
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-2 sm:whitespace-normal">
        <strong>Zebrafish.</strong>
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-8 sm:whitespace-normal">
        Whole-organism vertebrate physiology at scale.
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-20 sm:whitespace-normal">
        Combined with high-throughput scRNA screening, our team is able to create optimized compound rankings that accelerate 
        hit-to-lead decisions for therapeutics customers.
      </p>
      
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
          A model’s ability to generate accurate predictions for contexts it was never explicitly trained on.
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
        AI-driven understanding of gene expression patterns are delivering powerful new capabilities for therapeutics developers.
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-4 sm:whitespace-normal">
        At <strong>zeroshot bio</strong>, we create customized gene expression foundation models that deliver drug discovery confidence.
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-8 sm:whitespace-normal">
        We specialize in cross-species fine-tuning that enables translation between large-scale animal-model drug-exposure experiments
        and human-relevant insights.
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-2 sm:whitespace-normal">
        Our first animal-model-of-choice?
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-2 sm:whitespace-normal">
        <strong>Zebrafish.</strong>
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-8 sm:whitespace-normal">
        Whole-organism vertebrate physiology at scale.
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-20 sm:whitespace-normal">
        Combined with high-throughput scRNA screening, our team is able to create optimized compound rankings that accelerate 
        hit-to-lead decisions for therapeutics customers.
      </p>
      
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
          A model’s ability to generate accurate predictions for contexts it was never explicitly trained on.
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





// The term "zero-shot biology," especially in the context you've provided, seems to imply a future state of bioengineering where systems or models can predict, design, or understand biological outcomes without having been explicitly trained on those specific outcomes. 
// This concept is akin to zero-shot learning in AI, where an AI system can accurately make predictions about data it was not directly trained on.
// Here's a breakdown:
// AI-driven genomic design: This suggests the use of artificial intelligence to understand and manipulate genetic structures, potentially creating new forms of life, treatments for diseases, or even genetic modifications in existing organisms.
// Zero-shot: In AI, "zero-shot" learning refers to the system's ability to handle tasks that it hasn't seen before during training. Translating this to "zero-shot biology," 
// it suggests a system capable of predicting biological outcomes, behaviors, interactions, or designing biological systems and solutions without having prior specific examples or instructions. 
// It implies a model or method that understands the underlying principles of biology so well that it can apply this understanding to novel problems or create novel organisms or biological processes that serve specific purposes.
// In the context of your statement, "zero-shot biology" seems to be an aspirational concept indicating the ultimate goal of creating biological solutions in a way that's currently unprecedented. It suggests developing systems 
// that understand the fundamental "language" of biology to such an extent that they can interpret, predict, and create without needing direct guidance or previous examples in the specific area they are applied to.
// As to whether it's appropriate, it does fit the ambitious, forward-looking tone of your text. It signals that you're working on the cutting edge of bioengineering and AI, looking to pioneer unique solutions.
//  \However, since "zero-shot biology" is likely an unfamiliar term to many, it's essential to be prepared to explain this concept in simpler terms, perhaps with metaphors or specific examples, especially in outreach or marketing materials.