import Image from "next/image";

const teamData1 = [
  {
    name: "Steven ten Holder",
    role: "Founder | CEO",
    description: "Steven is a biologist with years of experience...",
    image: "/images/S.png",
    link: "https://www.linkedin.com/in/steventen/",
  },
  {
    name: "Graham Fleming",
    role: "Founder | CTO",
    description: "Graham is an engineer with years of experience...",
    image: "/images/G.png",
    link: "https://grahamfleming.com/",
  },
];

const teamData2 = [
  {
    name: "Darien Schettler",
    role: "Adviser, Generative AI",
    description: "Darien has expertise in generative AI...",
    image: "/images/D.png",
    link: "https://www.linkedin.com/in/darien-schettler-bb0a5086/",
  },
  {
    name: "Patrick Pumputs",
    role: "Adviser, Molecular Genetics",
    description: "Patrick specializes in molecular genetics...",
    image: "/images/P.png",
    link: "https://www.linkedin.com/in/patrick-pumputis-856803131/",
  },
  {
    name: "Dr. Sam Scanga",
    role: "Adviser, Genetics and Embryology",
    description: "Dr. Sam is a renowned expert in genetics and embryology...",
    image: "/images/SS.png",
    link: "https://www.linkedin.com/in/steventen/",
  },
];

function Team() {
  return (
    <section className="text-gray-600 body-font">
      <div className="container px-5 py-12 mx-auto">

        <div className="flex flex-wrap justify-center items-center">
          {teamData1.map((member, index) => (
            <div key={index} className="p-2 md:w-1/4 text-center">
              <a href={member.link} target="_blank" rel="noopener noreferrer">
                <Image
                  src={member.image}
                  alt={member.name}
                  width={200}
                  height={150}
                  className="object-cover object-center mx-auto"
                />
                <h2 className="title-font font-medium text-base text-gray-900 mt-2">
                  {member.name}
                </h2>
                <h3 className="text-xs text-gray-500 mb-1">
                  {member.role}
                </h3>
              </a>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center items-center">
          {teamData2.map((member, index) => (
            <div key={index} className="p-2 md:w-1/5 text-center">
              <a href={member.link} target="_blank" rel="noopener noreferrer">
                <Image
                  src={member.image}
                  alt={member.name}
                  width={320}
                  height={240}
                  className="object-cover object-center mx-auto"
                />
                <h2 className="title-font font-medium text-sm text-gray-900 mt-2">
                  {member.name}
                </h2>
                <h3 className="text-xs text-gray-500 mb-1">
                  {member.role}
                </h3>
              </a>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

export default Team;
