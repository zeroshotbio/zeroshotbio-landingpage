import Image from "next/image";

const teamData1 = [
  {
    name: "Steven ten Holder",
    role: "BioEng, Vision, Strategy",
    description: "Steven is a biologist with years of experience...",
    image: "/images/S.png",
    link: "https://www.linkedin.com/in/steventen/",
  },
  {
    name: "Graham Fleming",
    role: "Software, Architecture",
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
    description: "Dr. Sam is a renowned expert in genetics and embryology...",
    image: "/images/SS.png",
    link: "https://www.linkedin.com/in/steventen/",
  },
];

// Calculated new dimensions
const newWidth1 = Math.floor(150 * 0.75);
const newHeight1 = Math.floor(112.5 * 0.75);
const newWidth2 = Math.floor(240 * 0.75);
const newHeight2 = Math.floor(180 * 0.75);


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
                  width={newWidth1}
                  height={newHeight1}
                  className="object-cover object-center mx-auto"
                />
                <h2 className="title-font font-medium text-2xs text-gray-900 mt-2"
                  style={member.name === 'Patrick Pumputis' ? { whiteSpace: 'nowrap' } : {}}
                >
                  {member.name}
                </h2>
                <h3 className="text-3xs text-gray-500 mb-1">
                  {member.role}
                </h3>
              </a>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center items-center">
          {teamData2.map((member, index) => (
            <div key={index} className="p-2 md:w-3/20 lg:w-1/5 text-center">
              <a href={member.link} target="_blank" rel="noopener noreferrer">
                <Image
                  src={member.image}
                  alt={member.name}
                  width={newWidth2}
                  height={newHeight2}
                  className="object-cover object-center mx-auto"
                />
                <h2 className="title-font font-medium text-2xs text-gray-900 mt-2"
                  style={member.name === 'Patrick Pumputis' ? { whiteSpace: 'nowrap' } : {}}
                >
                  {member.name}
                </h2>
                <h3 className="text-3xs text-gray-500 mb-1">
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
