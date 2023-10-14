import Image from "next/image";

import Team from "../components/Team";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="relative flex flex-col items-center justify-center before:absolute before:h-[300px] before:w-[480px] before:-translate-x-1/2 before:rounded-full before:bg-gradient-radial before:from-white before:to-transparent before:blur-2xl before:content-[''] after:absolute after:-z-20 after:h-[180px] after:w-[240px] after:translate-x-1/3 after:bg-gradient-conic after:from-gray-200 after:via-gray-200 after:blur-2xl after:content-['']  before:lg:h-[360px] z-[-1]">
        <div>
          <h1 className="mb-3 text-6xl text-my-teal font-semibold">zeroshotBio</h1>
        </div>
        <Image
          className="relative"
          src="/images/headerpic.png"
          alt="zeroshotBio Logo"
          width={500}
          height={500}
          priority
        />
      </div>
      <div className="textboxmain w-3/4 mt-10">
        <p className="text-lg text-my-teal leading-relaxed mb-4 text-center">
          There&apos;s a certain excitement around the recent achievements and
          growth of computation. No other new field of science has produced an
          engineering platform as productivity-boosting and lifestyle-enhancing
          as it. We&apos;re confident it will continue to improve and generate
          new phenomena, including the exciting possibility of artificial
          general intelligence.
          <br />
          <br />
          Biology quietly reminds us to appreciate how powerful that operating
          system can be. Every cell in our body, from the neurons firing in our
          brains to the white blood cells fighting off infections, operates
          through a complex network of biochemical reactions, regulated by our
          DNA &ndash; nature&apos;s programming language.
          <br />
          <br />
          AI-driven genomic designs are emerging and we&apos;re excited to
          explore how this space will unfold.
          <br />
          <br />
          We&apos;re starting with simple bioengineering workflow tasks and
          moving up the stack toward our North Star: zero-shot genomics.
        </p>
      </div>
      <div className="flex justify-center items-center w-full h-[appropriate-height]">
        <Team />
      </div>
    </main>
  );
}
