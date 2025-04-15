"use client";

import React, { useEffect, useRef, useState, useCallback, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { DataSet, Network } from "vis-network/standalone";

/* -----------------------------------------------
   DarkMode (mirroring the approach from dataroom)
----------------------------------------------- */

type ThemeOption = "light" | "dark";

const SHOW_DARK_MODE_TOGGLE = false;
const DEFAULT_THEME: ThemeOption = "light";
const RESPECT_USER_PREFERENCE = true;

function DarkMode({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (RESPECT_USER_PREFERENCE) {
      const storedTheme = localStorage.getItem("theme") as ThemeOption | null;
      if (storedTheme === "dark") {
        document.documentElement.classList.add("dark");
        setDarkMode(true);
      } else {
        document.documentElement.classList.remove("dark");
        if (!storedTheme) {
          localStorage.setItem("theme", DEFAULT_THEME);
        }
      }
    } else {
      if (DEFAULT_THEME === "dark") {
        document.documentElement.classList.add("dark");
        setDarkMode(true);
      } else {
        document.documentElement.classList.remove("dark");
        setDarkMode(false);
      }
      localStorage.setItem("theme", DEFAULT_THEME);
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const newMode = !prev;
      localStorage.setItem("theme", newMode ? "dark" : "light");
      document.documentElement.classList.toggle("dark", newMode);
      return newMode;
    });
  };

  return (
    <>
      {SHOW_DARK_MODE_TOGGLE && (
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={toggleDarkMode}
            className={`relative inline-flex h-6 w-11 items-center rounded-full focus:outline-none cursor-pointer`}
            role="switch"
            aria-checked={darkMode}
          >
            <span
              className={`absolute inset-0 rounded-full transition duration-200 ease-in-out ${
                darkMode ? "bg-gray-700" : "bg-gray-300"
              }`}
            ></span>
            <span
              className={`absolute h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                darkMode ? "translate-x-5" : "translate-x-1"
              }`}
            ></span>
          </button>
        </div>
      )}
      {children}
    </>
  );
}

/* -----------------------------------------------
   Gene Explorer Constants & Types
----------------------------------------------- */

const DEVELOPMENTAL_STAGE_OPTIONS = [
  "0 somites",
  "05 somites",
  "10 somites",
  "15 somites",
  "20 somites",
  "30 somites",
  "larval-2dpf",
  "larval-3dpf",
  "larval-5dpf",
  "larval-10dpf",
];
const ANATOMY_OPTIONS = [
  "neural_crest",
  "central_nervous_system",
  "paraxial_mesoderm",
  "lateral_mesoderm",
  "mesenchyme",
  "intermediate_mesoderm",
  "hematopoietic_system",
  "periderm",
  "notochord",
  "endoderm",
];

interface NodeData {
  id: string;
  label: string;
  title: string;
  depth: number;
  degree: number;
  is_source: boolean;
}

interface EdgeData {
  from: string;
  to: string;
  title: string;
  value: number;
  depth: number;
}

interface VisData {
  nodes: NodeData[];
  edges: EdgeData[];
  summary: {
    num_nodes: number;
    num_edges: number;
    max_depth: number;
  };
  target_id: string;
  target_gene?: string;
}

/* -----------------------------------------------
   Presets for Visual/Physics Configurations
----------------------------------------------- */

const presets = {
  default: {
    physics: {
      gravity: -5000,
      springLength: 150,
      springConstant: 0.02,
      centralGravity: 0.1,
      damping: 0.09,
    },
    appearance: {
      nodeScale: 1.0,
      edgeOpacity: 0.6,
      fontSize: 14,
    },
  },
  spread: {
    physics: {
      gravity: -8000,
      springLength: 250,
      springConstant: 0.01,
      centralGravity: 0.05,
      damping: 0.09,
    },
    appearance: {
      nodeScale: 1.2,
      edgeOpacity: 0.4,
      fontSize: 16,
    },
  },
  "network-centric": {
    physics: {
      gravity: -20000,
      springLength: 500,
      springConstant: 0.01,
      centralGravity: 0,
      damping: 0.08,
    },
    appearance: {
      nodeScale: 1.0,
      edgeOpacity: 0.6,
      fontSize: 14,
    },
  },
  hierarchical: {
    physics: {
      gravity: -2000,
      springLength: 200,
      springConstant: 0.05,
      centralGravity: 0.1,
      damping: 0.09,
    },
    appearance: {
      nodeScale: 1.0,
      edgeOpacity: 0.7,
      fontSize: 14,
    },
    layout: {
      hierarchical: {
        enabled: true,
        direction: "UD",
        sortMethod: "directed",
        nodeSpacing: 120,
        treeSpacing: 200,
        levelSeparation: 150,
      },
    },
  },
  minimal: {
    physics: {
      gravity: -4000,
      springLength: 150,
      springConstant: 0.02,
      centralGravity: 0.1,
      damping: 0.09,
    },
    appearance: {
      nodeScale: 0.7,
      edgeOpacity: 0.4,
      fontSize: 12,
    },
  },
};

/* -----------------------------------------------
   Main Gene Explorer Component
----------------------------------------------- */

export default function GeneExplorerPage() {
  const networkRef = useRef<HTMLDivElement | null>(null);
  const [networkInstance, setNetworkInstance] = useState<Network | null>(null);

  const [geneName, setGeneName] = useState("klf3");
  const [devStage, setDevStage] = useState("0 somites");
  const [anatomy, setAnatomy] = useState("neural_crest");
  const [maxDepth, setMaxDepth] = useState(3);
  const [topGenes, setTopGenes] = useState(10);

  const [geneOptions, setGeneOptions] = useState<string[]>([]);
  const [visData, setVisData] = useState<VisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [directConnections, setDirectConnections] = useState<any[]>([]);

  // Physics & appearance settings
  const [physicsEnabled, setPhysicsEnabled] = useState(true);
  const [gravity, setGravity] = useState(-10000);
  const [springLength, setSpringLength] = useState(290);
  const [springConstant, setSpringConstant] = useState(0.01);
  const [centralGravity, setCentralGravity] = useState(0);
  const [damping, setDamping] = useState(0.16);
  const [nodeScale, setNodeScale] = useState(1.0);
  const [edgeOpacity, setEdgeOpacity] = useState(0.6);
  const [fontSize, setFontSize] = useState(16);

  // For highlighting the active tab
  const pathname = usePathname();

  // Fetch gene names from public/gene_names.json
  useEffect(() => {
    async function fetchGeneNames() {
      try {
        const res = await fetch("/gene_names.json");
        const data = await res.json();
        if (data?.gene_names) {
          setGeneOptions(data.gene_names);
        }
      } catch (err) {
        console.error("Error fetching gene names:", err);
      }
    }
    fetchGeneNames();
  }, []);

  // Initialize the Vis Network once on mount
  useEffect(() => {
    if (networkRef.current && !networkInstance) {
      const nodes = new DataSet([]);
      const edges = new DataSet([]);
      const container = networkRef.current;

      const options = {
        physics: {
          enabled: physicsEnabled,
          barnesHut: {
            gravitationalConstant: gravity,
            springLength: springLength,
            springConstant: springConstant,
            damping: damping,
            avoidOverlap: 0.5,
            centralGravity: centralGravity,
          },
        },
        interaction: {
          hover: true,
          navigationButtons: true,
          tooltipDelay: 200,
        },
        nodes: {
          shape: "dot",
        },
        edges: {
          smooth: {
            enabled: true,
            type: "continuous",
            roundness: 0.5,
          },
          width: 1,
        },
        layout: {
          hierarchical: {
            enabled: false,
          },
        },
      };

      const network = new Network(container, { nodes, edges }, options);

      // MINIMAL CHANGE: Double-click on a node to run inference for that node’s gene
      network.on("doubleClick", (params) => {
        if (params.nodes.length > 0 && visData) {
          const nodeId = params.nodes[0];
          const node = visData.nodes.find((n) => n.id === nodeId);
          if (node) {
            setGeneName(node.label);
            analyzeGeneNetwork(node.label);
          }
        }
      });

      setNetworkInstance(network);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On first load, automatically run the network analysis with defaults
  useEffect(() => {
    if (networkInstance && !visData) {
      analyzeGeneNetwork();
    }
  }, [networkInstance, visData]);

  const analyzeGeneNetwork = useCallback(
    async (geneOverride?: string) => {
      const finalGene = geneOverride || geneName;
      if (!finalGene) {
        alert("Please select a gene name first.");
        return;
      }
      setIsLoading(true);
      setErrorMessage("");

      try {
        const FLASK_ENDPOINT =
          process.env.NEXT_PUBLIC_FLASK_ENDPOINT || "http://localhost:5000";
        const response = await fetch(`${FLASK_ENDPOINT}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gene_name: finalGene,
            dev_stage: devStage,
            anatomy,
            max_depth: maxDepth,
            top_genes: topGenes,
          }),
        });
        if (!response.ok) {
          const errorBody = await response.json();
          throw new Error(errorBody.error || "Network request failed");
        }
        const data: VisData = await response.json();
        setVisData(data);
        setErrorMessage("");

        const directEdges = data.edges.filter(
          (e) => e.from === data.target_id || e.to === data.target_id
        );
        directEdges.sort((a, b) => b.value - a.value);
        setDirectConnections(directEdges.slice(0, 10));
      } catch (err: any) {
        setErrorMessage(err.message || "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    },
    [geneName, devStage, anatomy, maxDepth, topGenes]
  );

  // Update the network data whenever visData or appearance changes
  useEffect(() => {
    if (visData && networkInstance) {
      const nodesDS = new DataSet(
        visData.nodes.map((n) => {
          const baseSize = n.is_source
            ? 25
            : Math.max(8, Math.min(20, 10 + n.degree));
          const nodeSize = baseSize * nodeScale;
          let backgroundColor = "#D4BE92";
          if (n.depth === 1) backgroundColor = "#8BADA3";
          if (n.depth === 2) backgroundColor = "#7E9CB0";
          if (n.is_source) backgroundColor = "#D1818F";
          return {
            id: n.id,
            label: n.label,
            title: n.title,
            size: nodeSize,
            font: { size: n.is_source ? fontSize + 4 : fontSize },
            color: {
              background: backgroundColor,
              highlight: backgroundColor,
              hover: backgroundColor,
              border: "#333",
            },
            borderWidth: n.is_source ? 3 : 2,
          };
        })
      );

      const edgesDS = new DataSet(
        visData.edges.map((e, index) => {
          const baseWidth = Math.max(0.5, Math.min(3, e.value * 0.3));
          let color = "#D4BE92";
          if (e.depth === 1) color = "#8BADA3";
          if (e.depth === 2) color = "#7E9CB0";
          return {
            id: `edge-${index}`,
            from: e.from,
            to: e.to,
            title: e.title,
            value: e.value,
            width: baseWidth,
            color: {
              color: `rgba(${hexToRgb(color)}, ${edgeOpacity})`,
              highlight: color,
              hover: color,
            },
          };
        })
      );

      networkInstance.setData({ nodes: nodesDS, edges: edgesDS });
      networkInstance.fit({ animation: true });
    }
  }, [visData, networkInstance, nodeScale, edgeOpacity, fontSize]);

  // Update physics options in real time
  useEffect(() => {
    if (networkInstance) {
      networkInstance.setOptions({
        physics: {
          enabled: physicsEnabled,
          barnesHut: {
            gravitationalConstant: gravity,
            springLength: springLength,
            springConstant: springConstant,
            damping: damping,
            avoidOverlap: 0.5,
            centralGravity: centralGravity,
          },
        },
      });
    }
  }, [
    physicsEnabled,
    gravity,
    springLength,
    springConstant,
    damping,
    centralGravity,
    networkInstance,
  ]);

  function hexToRgb(hex: string) {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }

  function applyPreset(preset: keyof typeof presets) {
    const config = presets[preset];
    setGravity(config.physics.gravity);
    setSpringLength(config.physics.springLength);
    setSpringConstant(config.physics.springConstant);
    setCentralGravity(config.physics.centralGravity);
    setDamping(config.physics.damping);
    setNodeScale(config.appearance.nodeScale ?? 1);
    setEdgeOpacity(config.appearance.edgeOpacity ?? 0.6);
    setFontSize(config.appearance.fontSize ?? 14);
  }

  function resetControls() {
    setPhysicsEnabled(true);
    setGravity(-10000);
    setSpringLength(290);
    setSpringConstant(0.01);
    setCentralGravity(0);
    setDamping(0.16);
    setNodeScale(1.0);
    setEdgeOpacity(0.6);
    setFontSize(16);
  }

  return (
    <DarkMode>
      <div className="min-h-screen bg-white dark:bg-gray-900 relative">
        {/* Mobile-Only View */}
        <div className="block sm:hidden w-full h-screen bg-white dark:bg-gray-900 flex flex-col items-center justify-center">
          <Image
            src="/images/zeroshot_bio_gritty.png"
            alt="zeroshot logo"
            width={250}
            height={250}
            className="object-contain mb-4"
          />
          <h3 className="text-base text-center roboto-slab-light text-black dark:text-white pt-8 px-16">
            The Gene Explorer is formatted for viewing on desktop computers.
          </h3>
          <h3 className="text-base text-center roboto-slab-light text-black dark:text-white pt-8 px-16">
            You <strong>can</strong> rotate your screen horizontally to preview it from here.
          </h3>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex justify-center w-full">
          <div className="w-full max-w-[1600px] flex" style={{ minWidth: "640px" }}>
            {/* Left Sidebar (Logo + Gene Explorer Controls) */}
            <aside className="flex flex-col border-r border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-6 sm:py-8 w-[23%] max-w-[320px] sticky top-0 bg-gray-50 dark:bg-gray-800 overflow-y-auto">
              {/* Logo */}
              <div className="flex items-center h-16 sm:h-20 mb-4 sm:mb-6">
                <Image
                  src="/images/zeroshot_bio_gritty.png"
                  alt="zeroshot logo"
                  width={170}
                  height={170}
                  className="object-contain"
                />
              </div>
              <div className="w-full border-t border-gray-200 dark:border-gray-700 mt-2 sm:mt-[5px] mb-4"></div>

              {/* Gene & Context Selection */}
              <div className="mb-6">
                <h2 className="mb-8 mt-8">Gene & Context</h2>
                <label className="block text-sm mt-2">Gene Name</label>
                <select
                  className="border p-1 w-full text-gray-light text-xxsm"
                  value={geneName}
                  onChange={(e) => setGeneName(e.target.value)}
                >
                  <option value="" disabled>
                    Select a gene...
                  </option>
                  {geneOptions.map((gene) => (
                    <option key={gene} value={gene}>
                      {gene}
                    </option>
                  ))}
                </select>

                <label className="block text-sm mt-2">Developmental Stage</label>
                <select
                  className="border p-1 w-full text-gray-light text-xxsm"
                  value={devStage}
                  onChange={(e) => setDevStage(e.target.value)}
                >
                  <option value="" disabled>
                    Select developmental stage...
                  </option>
                  {DEVELOPMENTAL_STAGE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>

                <label className="block text-sm mt-2">Anatomy</label>
                <select
                  className="border p-1 w-full text-gray-light text-xxsm"
                  value={anatomy}
                  onChange={(e) => setAnatomy(e.target.value)}
                >
                  <option value="" disabled>
                    Select anatomy...
                  </option>
                  {ANATOMY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>

                <label className="block text-sm mt-2">Max Depth</label>
                <input
                  type="number"
                  className="border p-1 w-full text-gray-light text-xxsm"
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(parseInt(e.target.value))}
                />

                <label className="block text-sm mt-2">Top Genes per Level</label>
                <input
                  type="number"
                  className="border p-1 w-full text-gray-light text-xxsm"
                  value={topGenes}
                  onChange={(e) => setTopGenes(parseInt(e.target.value))}
                />

                <button
                  onClick={() => analyzeGeneNetwork()}
                  className="mt-3 w-full bg-blue-600 text-white p-2 rounded"
                >
                  {isLoading ? "Analyzing..." : "Run Inference"}
                </button>
              </div>

              {/* Physics Controls */}
              <div className="mb-4">
                <h2 className="mb-6 mt-8">Physics Controls</h2>

                <div className="mt-2 mb-2 flex items-center text-gray-light text-xxsm mb-6">
                  <input
                    type="checkbox"
                    id="physicsToggle"
                    checked={physicsEnabled}
                    onChange={(e) => setPhysicsEnabled(e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="physicsToggle">Physics</label>
                </div>

                <label className="block text-sm mt-2">Presets</label>
                <select
                  onChange={(e) => applyPreset(e.target.value as keyof typeof presets)}
                  className="border p-1 w-full text-gray-light text-xxsm mb-6"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select
                  </option>
                  <option value="default">Default</option>
                  <option value="spread">Spread Out</option>
                  <option value="network-centric">Network-Centric</option>
                  <option value="hierarchical">Hierarchical</option>
                  <option value="minimal">Minimal</option>
                </select>

                <div className="my-2">
                  <label className="block text-gray-light text-xxsm mb-6">
                    Gravity: {gravity}
                    <input
                      type="range"
                      min={-18000}
                      max={-500}
                      step={100}
                      value={gravity}
                      onChange={(e) => setGravity(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </label>
                </div>
                <div className="text-gray-light text-xxsm mb-6">
                  <label className="block">
                    Springiness: {springLength}
                    <input
                      type="range"
                      min={30}
                      max={540}
                      step={10}
                      value={springLength}
                      onChange={(e) => setSpringLength(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </label>
                </div>
                <div className="text-gray-light text-xxsm mb-6">
                  <label className="block">
                    Tightness: {springConstant}
                    <input
                      type="range"
                      min={0.002}
                      max={0.18}
                      step={0.002}
                      value={springConstant}
                      onChange={(e) => setSpringConstant(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </label>
                </div>
                <div className="text-gray-light text-xxsm mb-6">
                  <label className="block">
                    Central Gravity: {centralGravity}
                    <input
                      type="range"
                      min={0}
                      max={1.8}
                      step={0.05}
                      value={centralGravity}
                      onChange={(e) => setCentralGravity(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </label>
                </div>
                <div className="text-gray-light text-xxsm mb-6">
                  <label className="block">
                    Damping: {damping}
                    <input
                      type="range"
                      min={0}
                      max={1.8}
                      step={0.01}
                      value={damping}
                      onChange={(e) => setDamping(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </label>
                </div>

                <div className="mb-6">
                  <h2 className="mb-6 mt-12">Aesthetic Controls</h2>
                </div>

                <div className="text-gray-light text-xxsm mb-6">
                  <label className="block">
                    Node Size Scale: {nodeScale}
                    <input
                      type="range"
                      min={0.1}
                      max={3.6}
                      step={0.1}
                      value={nodeScale}
                      onChange={(e) => setNodeScale(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </label>
                </div>
                <div className="text-gray-light text-xxsm mb-6">
                  <label className="block">
                    Edge Opacity: {edgeOpacity}
                    <input
                      type="range"
                      min={0.02}
                      max={1.8}
                      step={0.02}
                      value={edgeOpacity}
                      onChange={(e) => setEdgeOpacity(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </label>
                </div>
                <div className="text-gray-light text-xxsm mb-6">
                  <label className="block">
                    Label Size: {fontSize}
                    <input
                      type="range"
                      min={4}
                      max={36}
                      step={1}
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </label>
                </div>

                <button
                  onClick={resetControls}
                  className="mt-3 w-full border border-gray-500 text-gray-700 dark:text-gray-200 p-2 rounded"
                >
                  Reset Controls
                </button>
              </div>
            </aside>

            {/* Right Content Area */}
            <main className="flex-1 overflow-y-auto relative">
              {/* Top Header Bar with tabs */}
              <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4 z-10">
                <div className="flex items-center space-x-8">
                  <Link
                    href="/dataroom"
                    className={`roboto-slab-semibold text-base sm:text-xl px-1 pb-1
                      ${
                        pathname === "/dataroom"
                          ? "text-black dark:text-white border-b-2 border-black dark:border-white"
                          : "text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white hover:border-b-2 hover:border-gray-500 transition-all"
                      }`}
                  >
                    Investor Data Room
                  </Link>
                  <Link
                    href="/gene-explorer"
                    className={`roboto-slab-semibold text-base sm:text-xl px-1 pb-1
                      ${
                        pathname === "/gene-explorer"
                          ? "text-black dark:text-white border-b-2 border-black dark:border-white"
                          : "text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white hover:border-b-2 hover:border-gray-500 transition-all"
                      }`}
                  >
                    Gene-Explorer 1.0
                  </Link>
                </div>
              </div>

              {/* Main content area */}
              <div className="pt-6 pb-32 px-4 sm:px-8 max-w-[1200px] mx-auto">
                <h1 className="text-2xl font-bold mb-4">Gene Network Explorer</h1>
                <p className="mb-4">
                  This interactive visualization of gene regulatory networks is powered 
                  by tsGPT 2.0.7, a small biological foundation model we created to demonstrate 
                  our end-to-end training, inference, and visualization capabilities. This particular instance 
                  was trained on publicly available zebrafish embryology data from the Chan Zuckerberg Initiative (CZI). 
                  It contains gene expression data from over <strong>120,000 cells</strong> with rich metadata annotation 
                  across zebrafish developmental stages and anatomical regions.
                </p>
                <p className="mb-4"> 
                  <strong>When you press the &apos;Run Inference&apos; button,</strong> the pipeline begins by creating an
                  input tensor with the target gene&apos;s token ID positioned at the center. The biological context you select is added as 
                  a metadata embedding vector. In plain English, you’re effectively
                  asking the model, “Given this central gene and its biological context, what are the relationships with surrounding genes?”
                  The forward pass computes attention scores across all genes, and these relationships are mapped into the visualization below.
                </p>
                <p className="mb-4">
                  We&apos;re building future versions with more robust
                  datasets, larger parameter counts, and built-in perturbation 
                  prediction that model basic drug effects.
                </p>

                <div
                  className="border rounded mb-4 relative"
                  style={{ height: 700 }}
                >
                  {isLoading && (
                    <div
                      style={{
                        position: "absolute",
                        zIndex: 10,
                        backgroundColor: "rgba(255,255,255,0.9)",
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {/* DNA letter animation */}
                      <div className="relative w-64 h-16 mb-2 overflow-hidden">
                        <style jsx>{`
                          @keyframes fadeInUp {
                            0% {
                              transform: translateY(100%);
                              opacity: 0;
                            }
                            20% {
                              transform: translateY(0);
                              opacity: 1;
                            }
                            70% {
                              transform: translateY(0);
                              opacity: 1;
                            }
                            100% {
                              transform: translateY(-100%);
                              opacity: 0;
                            }
                          }
                          .letter-container {
                            position: relative;
                            width: 100%;
                            height: 100%;
                            display: flex;
                            justify-content: space-between;
                          }
                          .letter-column {
                            position: relative;
                            width: 25%;
                            height: 100%;
                          }
                          .dna-letter {
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 2.5rem;
                            font-weight: bold;
                            font-family: monospace;
                            opacity: 0;
                            animation-duration: 2s;
                            animation-name: fadeInUp;
                            animation-timing-function: ease-in-out;
                            animation-iteration-count: infinite;
                          }
                          .letter-a {
                            color: #3b82f6;
                            animation-delay: 0s;
                          }
                          .letter-t {
                            color: #ef4444;
                            animation-delay: 0.5s;
                          }
                          .letter-c {
                            color: #10b981;
                            animation-delay: 1s;
                          }
                          .letter-g {
                            color: #f59e0b;
                            animation-delay: 1.5s;
                          }
                        `}</style>

                        <div className="letter-container">
                          <div className="letter-column">
                            <div className="dna-letter letter-a">A</div>
                          </div>
                          <div className="letter-column">
                            <div className="dna-letter letter-t">T</div>
                          </div>
                          <div className="letter-column">
                            <div className="dna-letter letter-c">C</div>
                          </div>
                          <div className="letter-column">
                            <div className="dna-letter letter-g">G</div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 text-gray-600 font-semibold text-lg">
                        Running Inference... (this can take up to 60 seconds)
                      </div>
                    </div>
                  )}
                  <div ref={networkRef} style={{ width: "100%", height: "100%" }} />
                </div>

                {/* Legend & Network Info side-by-side */}
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                  {/* Legend */}
                  <div className="border rounded p-2 w-full md:w-1/2">
                    <h2 className="font-bold mb-2">Legend</h2>
                    <div className="flex items-center mb-1">
                      <div
                        className="w-4 h-4 rounded-full mr-2"
                        style={{ backgroundColor: "#D1818F" }}
                      />
                      <span>Source Gene</span>
                    </div>
                    <div className="flex items-center mb-1">
                      <div
                        className="w-4 h-4 rounded-full mr-2"
                        style={{ backgroundColor: "#8BADA3" }}
                      />
                      <span>Primary Connection</span>
                    </div>
                    <div className="flex items-center mb-1">
                      <div
                        className="w-4 h-4 rounded-full mr-2"
                        style={{ backgroundColor: "#7E9CB0" }}
                      />
                      <span>Secondary Connection</span>
                    </div>
                    <div className="flex items-center mb-1">
                      <div
                        className="w-4 h-4 rounded-full mr-2"
                        style={{ backgroundColor: "#D4BE92" }}
                      />
                      <span>Tertiary Connection</span>
                    </div>
                  </div>

                  {/* Network Info */}
                  {visData && (
                    <div className="border rounded p-2 w-full md:w-1/2">
                      <h2 className="font-bold mb-2">Network Information</h2>
                      <p>
                        Target Gene:{" "}
                        <strong>
                          {visData.target_gene || visData.target_id}
                        </strong>
                      </p>
                      <p>Total Nodes: {visData.summary.num_nodes}</p>
                      <p>Total Edges: {visData.summary.num_edges}</p>
                      <p>Max Depth: {visData.summary.max_depth}</p>
                      <div className="mt-2">
                        <h3 className="font-medium">Direct Connections</h3>
                        {directConnections.length > 0 ? (
                          <ul className="list-disc list-inside">
                            {directConnections.map((edge, idx) => {
                              const other =
                                edge.from === visData.target_id
                                  ? edge.to
                                  : edge.from;
                              const otherNode = visData.nodes.find(
                                (n) => n.id === other
                              );
                              return (
                                <li key={idx} className="mb-1">
                                  {otherNode?.label || other}{" "}
                                  <span className="text-blue-500 float-right">
                                    {(edge.value / 5).toFixed(4)}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p>No direct connections found</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Error message, if any */}
                {errorMessage && (
                  <div className="text-red-500 mb-2">Error: {errorMessage}</div>
                )}
              </div>
            </main>
          </div>
        </div>
      </div>
    </DarkMode>
  );
}
