import Image from "next/image";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-between md:p-24 md:flex-col md:items-center">
      <div>
        <Image
          className="relative"
          src="/images/headerpic.png"
          alt="zeroshotBio Logo"
          width={500}
          height={500}
          priority
        />
      </div>
      <div className="textboxmain w-full px-20 text-center mt-10 sm:mt-6 md:mt-4 lg:mt-8 sm:max-w-md md:max-w-md lg:max-w-md text-gray-800">
        <p className="text-sm sm:text-base md:text-m text-my-teal leading-relaxed mb-4 sm:whitespace-normal">
          AI-driven genomic design will deliver exciting new categories of capability for bioengineers.
        </p>
        <p className="text-sm sm:text-base md:text-m text-my-teal leading-relaxed mb-4 sm:whitespace-normal">
          From agriculture to biomaterials, from human longevity to environmental remediation, engineered sequences could help improve the world.
        </p>
        <p className="text-sm sm:text-base md:text-m text-my-teal leading-relaxed mb-4 sm:whitespace-normal">
          It&apos;s very early, but the search for emergent capabilities at this new intersection has begun.
        </p>
        <p className="text-sm sm:text-base md:text-m text-my-teal leading-relaxed mb-4 sm:whitespace-normal">
          First, simple short-sequence generated DNA. Next, bioengineering workflow redesign. Finally, zero-shot biology.
        </p>
      </div>
    </main>
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