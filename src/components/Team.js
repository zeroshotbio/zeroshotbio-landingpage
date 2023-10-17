import Image from "next/image";

const teamData = [
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
    description: "Graham is a engineer with years of experience...",
    image: "/images/G.png",
    link: "https://grahamfleming.com/",
  },
];

const teamData2 = [
  {
    name: "Darien Schettler",
    role: "Adviser, Generative AI",
    description: "Steven is a biologist with years of experience...",
    image: "/images/D.png",
    link: "https://www.linkedin.com/in/darien-schettler-bb0a5086/",
  },
  {
    name: "Patrick Pumputs",
    role: "Adviser, Molecular Genetics",
    description: "Graham is a engineer with years of experience...",
    image: "/images/P.png",
    link: "https://www.linkedin.com/in/patrick-pumputis-856803131/",
  },
  {
    name: "Dr. Sam Scanga",
    role: "Adviser, Genetics and Embryology",
    description: "Steven is a biologist with years of experience...",
    image: "/images/SS.png",
    link: "https://www.linkedin.com/in/steventen/",
  },
]


function Team() {
  return (
    <section className="text-gray-600 body-font">
      <div className="container px-5 py-12 mx-auto">
        <div className="flex flex-wrap justify-center items-center">
          {teamData.map((member, index) => (
            <div 
              key={index} 
              className={`p-2 ${index < 2 ? 'md:w-1/4' : 'md:w-1/5'} text-center`}
            >
              <a href={member.link} target="_blank" rel="noopener noreferrer">
                <Image
                  src={member.image}
                  alt={member.name}
                  width={index < 2 ? 200 : 320}  // Making Darien, Patrick, and Sam's images slightly smaller
                  height={index < 2 ? 150 : 240} // Making Darien, Patrick, and Sam's images slightly smaller
                  className="object-cover object-center mx-auto"
                />
                <h2 
                  className={`title-font font-medium ${index < 2 ? 'text-base' : 'text-sm'} ${index >= 2 ? 'text-gray-700' : 'text-gray-900'} mt-2`}
                >
                  {member.name}
                </h2>
                <h3 className={`text-xs ${index >= 2 ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                  {member.role}
                </h3>
              </a>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center items-center">
          {teamData2.map((member, index) => (
            <div 
              key={index} 
              className={`p-2 ${index < 2 ? 'md:w-1/4' : 'md:w-1/5'} text-center`}
            >
              <a href={member.link} target="_blank" rel="noopener noreferrer">
                <Image
                  src={member.image}
                  alt={member.name}
                  width={index < 2 ? 200 : 320}  // Making Darien, Patrick, and Sam's images slightly smaller
                  height={index < 2 ? 150 : 240} // Making Darien, Patrick, and Sam's images slightly smaller
                  className="object-cover object-center mx-auto"
                />
                <h2 
                  className={`title-font font-medium ${index < 2 ? 'text-base' : 'text-sm'} ${index >= 2 ? 'text-gray-700' : 'text-gray-900'} mt-2`}
                >
                  {member.name}
                </h2>
                <h3 className={`text-xs ${index >= 2 ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
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



