'use client';
import React, { useEffect, useState } from 'react';
import * as d3 from 'd3';

const ClientOnlyD3Treemap: React.FC = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Your D3 code goes here.
    // This example creates a simple SVG with a title.
    const container = d3.select("#d3-treemap");
    container.selectAll("*").remove(); // Clear any previous content.
    
    const svg = container
      .append("svg")
      .attr("width", 900)
      .attr("height", 600);
      
    svg.append("text")
      .attr("x", 20)
      .attr("y", 40)
      .text("Interactive D3 Treemap")
      .attr("font-size", "24px")
      .attr("fill", "#333");
      
    // Insert your actual D3 treemap code here...
  }, []);

  if (!mounted) return null;

  return <div id="d3-treemap" />;
};

export default ClientOnlyD3Treemap;
