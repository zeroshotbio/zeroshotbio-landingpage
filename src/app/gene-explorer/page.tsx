"use client";

import React, { useEffect, useRef, useState } from "react";
// We can install 'vis-network' by running: npm install vis-network
// Then import from 'vis-network' or from 'vis-network/standalone'
// Importing directly from "vis-network" as there are no official @types for it
import { DataSet, Network } from "vis-network/standalone";

// We'll define a small type for the JSON we get back from /api/analyze
interface VisData {
  nodes: {
    id: string;
    label: string;
    title: string;
    depth: number;
    degree: number;
    is_source: boolean;
  }[];
  edges: {
    from: string;
    to: string;
    score: number;
    depth: number;
    value: number;
    title: string;
  }[];
  summary: {
    num_nodes: number;
    num_edges: number;
    max_depth: number;
  };
  target_id: string;
}

interface MyNode {
    id: string;
    label: string;
    title: string;
    // optionally include other fields such as depth, degree, etc.
  }
  
  interface MyEdge {
    id: string; // add id property
    from: string;
    to: string;
    title: string;
    value: number;
  }
export default function GeneExplorerPage() {
  // References to the DOM container for the Vis.js network
  const networkRef = useRef<HTMLDivElement | null>(null);
  const [networkInstance, setNetworkInstance] = useState<Network | null>(null);

  // Form states
  const [geneName, setGeneName] = useState("klf3");
  const [timepoint, setTimepoint] = useState("2dpf");
  const [devStage, setDevStage] = useState("larval-2dpf");
  const [anatomy, setAnatomy] = useState("central_nervous_system");
  const [maxDepth, setMaxDepth] = useState(2);
  const [topGenes, setTopGenes] = useState(15);

  // We'll store the fetched network data here
  const [visData, setVisData] = useState<VisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // We'll also store an error message if something goes wrong
  const [errorMessage, setErrorMessage] = useState("");

  // On first render, initialize the Vis network with empty datasets
  useEffect(() => {
    if (networkRef.current && !networkInstance) {
      const nodes = new DataSet([]);
      const edges = new DataSet([]);
      const container = networkRef.current;

      const options = {
        // your initial Vis.js config
        physics: {
          enabled: true,
          barnesHut: {
            gravitationalConstant: -5000,
            springLength: 150,
            springConstant: 0.02,
            damping: 0.09,
          },
        },
        interaction: {
          hover: true,
          navigationButtons: true,
        },
        nodes: {
          shape: "dot",
        },
      };

      const network = new Network(container, { nodes, edges }, options);
      setNetworkInstance(network);
    }
  }, [networkRef, networkInstance]);

  // Function to fetch the data from the Flask back-end
  async function analyzeGeneNetwork() {
    if (!geneName) {
      alert("Please select a gene name first.");
      return;
    }
    setIsLoading(true);
    setErrorMessage("");
    setVisData(null);

    try {
      // Replace this with your actual server address + /api/analyze
      // For example, if your Flask is on: http://1.2.3.4:5000
        const FLASK_ENDPOINT = process.env.NEXT_PUBLIC_FLASK_ENDPOINT || "http://localhost:5000";

        const response = await fetch(`${FLASK_ENDPOINT}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            gene_name: geneName,
            timepoint: timepoint,
            dev_stage: devStage,
            anatomy: anatomy,
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
    } catch (err: any) {
      setErrorMessage(err.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  // Whenever visData changes, draw the network
  useEffect(() => {
    if (visData && networkInstance) {
      const nodes = new DataSet<MyNode>(
        visData.nodes.map((n) => ({
          id: n.id,
          label: n.label,
          title: n.title,
          // You can add other properties here if needed.
        }))
      );
      const edges = new DataSet<MyEdge>(
        visData.edges.map((e, index) => ({
          id: `edge-${index}`, // unique id for each edge
          from: e.from,
          to: e.to,
          title: e.title,
          value: e.value,
        }))
      );
      
      networkInstance.setData({ nodes, edges });
      networkInstance.fit({ animation: true });
    }
  }, [visData, networkInstance]);
  

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Gene Network Explorer</h1>

      {/* Controls */}
      <div className="mb-4">
        <label className="block mb-1">Gene Name</label>
        <input
          type="text"
          value={geneName}
          onChange={(e) => setGeneName(e.target.value)}
          className="border p-1 w-full mb-2"
        />

        <label className="block mb-1">Timepoint</label>
        <input
          type="text"
          value={timepoint}
          onChange={(e) => setTimepoint(e.target.value)}
          className="border p-1 w-full mb-2"
        />

        <label className="block mb-1">Developmental Stage</label>
        <input
          type="text"
          value={devStage}
          onChange={(e) => setDevStage(e.target.value)}
          className="border p-1 w-full mb-2"
        />

        <label className="block mb-1">Anatomy</label>
        <input
          type="text"
          value={anatomy}
          onChange={(e) => setAnatomy(e.target.value)}
          className="border p-1 w-full mb-2"
        />

        <label className="block mb-1">Max Depth</label>
        <input
          type="number"
          value={maxDepth}
          onChange={(e) => setMaxDepth(parseInt(e.target.value))}
          className="border p-1 w-full mb-2"
        />

        <label className="block mb-1">Top Genes per Level</label>
        <input
          type="number"
          value={topGenes}
          onChange={(e) => setTopGenes(parseInt(e.target.value))}
          className="border p-1 w-full mb-2"
        />

        <button
          onClick={analyzeGeneNetwork}
          className="bg-blue-600 text-white px-3 py-2 rounded"
        >
          {isLoading ? "Analyzing..." : "Analyze Gene Network"}
        </button>
      </div>

      {/* Error or status messages */}
      {errorMessage && (
        <div className="text-red-500 mb-2">Error: {errorMessage}</div>
      )}

      {/* The network container */}
      <div
        ref={networkRef}
        style={{ height: "600px", border: "1px solid #ccc" }}
      />

      {/* Summaries or detail about the network */}
      {visData && (
        <div className="mt-4 p-2 border">
          <h2 className="font-bold">Network Summary</h2>
          <p>Target ID: {visData.target_id}</p>
          <p>Number of Nodes: {visData.summary.num_nodes}</p>
          <p>Number of Edges: {visData.summary.num_edges}</p>
          <p>Max Depth: {visData.summary.max_depth}</p>
        </div>
      )}
    </div>
  );
}
