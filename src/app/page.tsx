import Image from "next/image";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-between p-4 sm:p-8 md:p-24 md:flex-col md:items-center md:justify-between md:min-h-screen">
      <div className="relative flex flex-col items-center justify-center before:absolute before:h-[300px] before:w-[480px] before:-translate-x-1/2 before:rounded-full before:bg-gradient-radial before:from-white before:to-transparent before:blur-2xl before:content-[''] after:absolute after:-z-20 after:h-[180px] after:w-[240px] after:translate-x-1/3 after:bg-gradient-conic after:from-gray-200 after:via-gray-200 after:blur-2xl after:content-[''] before:lg:h-[360px] z-[-1]">
        <Image
          className="relative"
          src="/images/headerpic.png"
          alt="zeroshotBio Logo"
          width={500}
          height={500}
          priority
        />
      </div>
      <div className="textboxmain w-full mt-10 mx-auto text-center sm:max-w-xl md:max-w-md text-gray-800">
        <p className="text-sm sm:text-base md:text-m text-my-teal leading-relaxed mb-4 sm:whitespace-normal">
          We believe AI-driven genomic design will deliver exciting new categories of capability for bioengineers.
        </p>
        <p className="text-sm sm:text-base md:text-m text-my-teal leading-relaxed mb-4 sm:whitespace-normal">
          From agriculture to biomaterials, from human longevity to environmental remediation, engineered sequences could help improve the world.
        </p>
        <p className="text-sm sm:text-base md:text-m text-my-teal leading-relaxed mb-4 sm:whitespace-normal">
          It&apos;s very early, but we&apos;re excited to search the maze for emergent capability as this new intersection unfolds.
        </p>
        <p className="text-sm sm:text-base md:text-m text-my-teal leading-relaxed mb-4 sm:whitespace-normal">
          We&apos;re starting with a focus on generated DNA for bioengineering workflows as we move up the stack toward our north star, zero-shot biology.
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