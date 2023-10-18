import Image from "next/image";

const teamData1 = [
  {
    name: "Steven ten Holder",
    role: "BioEng/Vision/Strategy",
    description: "Steven is a biologist with years of experience...",
    image: "/images/S.png",
    link: "https://www.linkedin.com/in/steventen/",
  },
  {
    name: "Graham Fleming",
    role: "Software/Architecture",
    description: "Graham is an engineer with years of experience...",
    image: "/images/G.png",
    link: "https://grahamfleming.com/",
  },
];

const teamData2 = [
  {
    name: "Darien Schettler",
    role: "Advisor, Generative AI",
    description: "Darien has expertise in generative AI...",
    image: "/images/D.png",
    link: "https://www.linkedin.com/in/darien-schettler-bb0a5086/",
  },
  {
    name: "Patrick Pumputis",
    role: "Advisor, Molecular Genetics",
    description: "Patrick specializes in molecular genetics...",
    image: "/images/P.png",
    link: "https://www.linkedin.com/in/patrick-pumputis-856803131/",
  },
  {
    name: "Dr. Sam Scanga",
    role: "Advisor, Genetics and Embryology",
    description: "Dr. Sam is a renowned expert in genetics and embryologys...",
    image: "/images/SS.png",
    link: "https://www.linkedin.com/in/sam-scanga-phd-10481442/",
  },
];



function Team() {
  return (
    <section className="text-gray-600 body-font">
      <div className="container px-4 py-9 mx-auto">

        <div className="flex flex-wrap justify-center items-center">
          {teamData1.map((member, index) => (
            <div key={index} className="p-2 md:w-3/16 text-center">
              <a href={member.link} target="_blank" rel="noopener noreferrer">
                <Image
                  src={member.image}
                  alt={member.name}
                  width={150}
                  height={150}
                  className="object-cover object-center mx-6"
                />
                <h2 className="title-font font-medium text-s text-gray-800 mt-1 mx-3">
                  {member.name}
                </h2>
                <h3 className="text-xs text-gray-400 mb-10">
                  {member.role}
                </h3>
              </a>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center items-center">
          {teamData2.map((member, index) => (
            <div key={index} className="p-2 md:w-3/16 text-center">
              <a href={member.link} target="_blank" rel="noopener noreferrer">
                <Image
                  src={member.image}
                  alt={member.name}
                  width={125}
                  height={125}
                  className="object-cover object-center mx-6"
                />
                <h2 className="title-font font-medium text-s text-gray-800 mt-1 mx-3">
                  {member.name}
                </h2>
                <h3 className="text-xs text-gray-400 mb-10">
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
