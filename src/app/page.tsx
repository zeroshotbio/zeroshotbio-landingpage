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
        Computational models of biology for therapeutic confidence.
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
        we create computational pipelines that explore how zebrafish can contribute to pre-clinical insights for humans.
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-2 sm:whitespace-normal">
        <strong>Why zebrafish?</strong>
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-8 sm:whitespace-normal">
        Humans and zebrafish are both vertebrates, and zebrafish embryos can produce whole-vertebrate drug-response
        readouts at scale. One experiment records a compound&#39;s effect across every tissue, cell by cell.
        It&#39;s an increasingly popular animal model, with ideal unit-economics for AI-scale training and rapid turnaround time.
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-12 sm:whitespace-normal">
        By pairing high-throughput scRNA sequencing of drug-perturbed zebrafish with phenotypic screening,
        we aim to combine molecular and whole-animal evidence into features a model can learn from and a drug developer will actually care about.
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
        Computational models of biology
      </p>
      <p className="leading-tight roboto-slab-semibold text-base text-gray-medium text-center mb-8">
        for therapeutic confidence.
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
        we create computational pipelines that explore how zebrafish can contribute to pre-clinical insights for humans.
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-2 sm:whitespace-normal">
        <strong>Why zebrafish?</strong>
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-8 sm:whitespace-normal">
        Humans and zebrafish are both vertebrates, and zebrafish embryos can produce whole-vertebrate drug-response
        readouts at scale. One experiment records a compound&#39;s effect across every tissue, cell by cell.
        It&#39;s an increasingly popular animal model, with ideal unit-economics for AI-scale training and rapid turnaround time.
      </p>
      <p className="roboto-slab-regular text-xsm sm:text-base md:text-m text-gray-semidark leading-snug mb-12 sm:whitespace-normal">
        By pairing high-throughput scRNA sequencing of drug-perturbed zebrafish with phenotypic screening,
        we aim to combine molecular and whole-animal evidence into features a model can learn from and a drug developer will actually care about.
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