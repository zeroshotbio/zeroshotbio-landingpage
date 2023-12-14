import Image from "next/image";
const teamData = [
  {
    name: "Steven ten Holder",
    role: "Founder | CEO",
    description: "Steven is a biologist with years of experience...",
    image: "/images/S.jpg",
    link: "https://www.linkedin.com/in/steventen/",
  },
  {
    name: "Graham Fleming",
    role: "Founder | CTO",
    description: "Graham is a engineer with years of experience...",
    image: "/images/G.jpg",
    link: "https://grahamfleming.com/",
  },
];

function Team() {
  return (
    <section className="text-gray-600 body-font">
      <div className="container px-5 py-24 mx-auto">
        <div className="flex flex-wrap -m-4 justify-center">
          {teamData.map((member, index) => (
            <div key={index} className="p-4 md:w-1/2 lg:w-1/3">
              <a href={member.link} target="_blank">
                <div className="h-full border-2 border-gray-200 border-opacity-60 rounded-lg overflow-hidden max-w-lg">
                  <Image
                    src={member.image}
                    alt={member.name}
                    width={800}
                    height={600}
                    className="lg:h-48 md:h-36 object-cover object-center"
                  />

                  <div className="p-6">
                    <h2 className="title-font font-medium text-lg text-gray-900 text-center">
                      {member.name}
                    </h2>
                    <h3 className="text-gray-500 mb-3 text-center">
                      {member.role}
                    </h3>
                    {/* <p className="leading-relaxed mb-3">{member.description}</p> */}
                  </div>
                </div>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Team;
