'use client';

import React, { useState, useMemo } from 'react';

// --- CONFIGURATION ---
// All model and chart parameters are defined here for easy modification.
const modelConfig = {
  simulation: {
    // The number of simulated cells in the population. Higher numbers create a smoother-looking distribution.
    numCells: 5000,
  },
  sliders: {
    basalMean:          { min: -15, max: 6, step: 0.1, initial: -13 },
    basalStd:           { min: 0.1,  max: 8,   step: 0.1, initial: 2.3 },
    perturbationEffect: { min: -20, max: 30, step: 0.1, initial: 19 },
    heterogeneityLevel: { min: 0,    max: 20,  step: 0.1, initial: 4 },
    noiseLevel:         { min: 0,    max: 20, step: 0.1, initial: 7 },
    numBins:            { min: 50,   max: 200, step: 1,   initial: 100 }
  },
  chart: {
    // The fixed viewing window for the x-axis.
    // This should be wide enough to contain the data given the slider ranges.
    minX: -25,
    maxX: 25,
  }
};
// --- END CONFIGURATION ---


const PerturbationModelViz = () => {
  // Parameters for each component, initialized from the config
  const [basalMean, setBasalMean] = useState(modelConfig.sliders.basalMean.initial);
  const [basalStd, setBasalStd] = useState(modelConfig.sliders.basalStd.initial);
  const [perturbationEffect, setPerturbationEffect] = useState(modelConfig.sliders.perturbationEffect.initial);
  const [heterogeneityLevel, setHeterogeneityLevel] = useState(modelConfig.sliders.heterogeneityLevel.initial);
  const [noiseLevel, setNoiseLevel] = useState(modelConfig.sliders.noiseLevel.initial);
  const [numBins, setNumBins] = useState(modelConfig.sliders.numBins.initial);

  // Generate deterministic normal distribution data points
  const generateNormalData = (mean: number, std: number, n: number, seed: number = 42) => {
    const data: number[] = [];
    let rng = seed;
    const nextRandom = () => {
      rng = (rng * 1664525 + 1013904223) % (2**32);
      return rng / (2**32);
    };
    
    for (let i = 0; i < n; i++) {
      const u1 = nextRandom();
      const u2 = nextRandom();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      data.push(mean + std * z);
    }
    return data.sort((a, b) => a - b);
  };

  // Generate baseline data that responds to parameter changes
  const basalData = useMemo(() => {
    return generateNormalData(basalMean, basalStd, modelConfig.simulation.numCells, 42);
  }, [basalMean, basalStd]);

  // Calculate combined distribution with all effects
  const combinedData = useMemo(() => {
    let rng = 123; // Different seed for effects
    const nextRandom = () => {
      rng = (rng * 1664525 + 1013904223) % (2**32);
      return rng / (2**32);
    };
    
    return basalData.map(val => {
      // Apply perturbation effect
      let perturbedVal = val + perturbationEffect;
      // Apply biological heterogeneity
      perturbedVal += (nextRandom() - 0.5) * heterogeneityLevel * 2;
      // Apply technical noise
      perturbedVal += (nextRandom() - 0.5) * noiseLevel * 2;
      return perturbedVal;
    }).sort((a, b) => a - b);
  }, [basalData, perturbationEffect, heterogeneityLevel, noiseLevel]);

  // Create histogram data
  const createHistogram = (data: number[], bins: number) => {
    if (data.length === 0) return [];
    const min = Math.min(...data);
    const max = Math.max(...data);
    const binWidth = (max - min) / bins;
    const histogram = new Array(bins).fill(0);
    
    data.forEach(val => {
      const binIndex = Math.min(Math.floor((val - min) / binWidth), bins - 1);
      if(histogram[binIndex] !== undefined) histogram[binIndex]++;
    });
    
    return histogram.map((count, i) => ({
      x: min + (i + 0.5) * binWidth,
      y: count,
      width: binWidth
    }));
  };

  const basalHist = useMemo(() => createHistogram(basalData, numBins), [basalData, numBins]);
  const combinedHist = useMemo(() => createHistogram(combinedData, numBins), [combinedData, numBins]);

  // Calculate chart bounds
  const allYData = [...basalHist.map(d => d.y), ...combinedHist.map(d => d.y)];
  const maxY = allYData.length > 0 ? Math.max(...allYData) : 1;
  
  const minX = modelConfig.chart.minX;
  const maxX = modelConfig.chart.maxX;

  const width = 800;
  const height = 280;
  const margin = { top: 15, right: 15, bottom: 35, left: 35 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const xScale = (x: number) => ((x - minX) / (maxX - minX)) * plotWidth;
  const yScale = (y: number) => plotHeight - (y / maxY) * plotHeight;

  return (
    <div className="w-full max-w-6xl mx-auto p-3 h-screen flex flex-col">
      {/* Header - Compact */}
      <div className="text-center mb-3">
        <h1 className="text-xl font-light text-gray-800 mb-1">Single Cell Perturbation Model</h1>
        <div className="text-sm text-gray-600 mb-1 font-mono bg-white border border-gray-200 rounded px-2 py-1 inline-block">
          X̂<sub>p</sub> ~ T<sub>p</sub>(D<sub>basal</sub>) + H(D<sub>basal</sub>) + ε
        </div>
        <p className="text-xs text-gray-600 max-w-4xl mx-auto">
          This visualization shows how single-cell perturbation experiments work. Each component transforms the baseline population into the final observed state.
        </p>
      </div>
      
      {/* Row 1: Controls - Compact */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Baseline Parameters */}
        <div className="bg-white border border-gray-200 rounded p-3">
          <h3 className="text-sm font-medium mb-2 text-gray-700">Baseline Population (D<sub>basal</sub>)</h3>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-gray-700">
                  Mean: {basalMean.toFixed(1)}
                </label>
              </div>
              <input
                type="range"
                min={modelConfig.sliders.basalMean.min}
                max={modelConfig.sliders.basalMean.max}
                step={modelConfig.sliders.basalMean.step}
                value={basalMean}
                onChange={(e) => setBasalMean(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-1">
                Average expression level across unperturbed cells. Shifts the blue baseline distribution left/right.
              </p>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-gray-700">
                  Std Dev: {basalStd.toFixed(1)}
                </label>
              </div>
              <input
                type="range"
                min={modelConfig.sliders.basalStd.min}
                max={modelConfig.sliders.basalStd.max}
                step={modelConfig.sliders.basalStd.step}
                value={basalStd}
                onChange={(e) => setBasalStd(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-1">
                Natural cell-to-cell variation in the baseline population. Makes the blue distribution wider/narrower.
              </p>
            </div>
          </div>
        </div>

        {/* Experimental Effects */}
        <div className="bg-white border border-gray-200 rounded p-3">
          <h3 className="text-sm font-medium mb-2 text-gray-700">Experimental Effects</h3>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-red-700">
                  T<sub>p</sub> Effect: {perturbationEffect.toFixed(1)}
                </label>
              </div>
              <input
                type="range"
                min={modelConfig.sliders.perturbationEffect.min}
                max={modelConfig.sliders.perturbationEffect.max}
                step={modelConfig.sliders.perturbationEffect.step}
                value={perturbationEffect}
                onChange={(e) => setPerturbationEffect(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-1">
                Systematic shift caused by drug treatment. Moves the purple distribution relative to blue baseline.
              </p>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-green-700">
                  H Heterogeneity: {heterogeneityLevel.toFixed(1)}
                </label>
              </div>
              <input
                type="range"
                min={modelConfig.sliders.heterogeneityLevel.min}
                max={modelConfig.sliders.heterogeneityLevel.max}
                step={modelConfig.sliders.heterogeneityLevel.step}
                value={heterogeneityLevel}
                onChange={(e) => setHeterogeneityLevel(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-1">
                Additional biological variation during experiment. Makes purple distribution more spread out.
              </p>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-orange-700">
                  ε Noise: {noiseLevel.toFixed(1)}
                </label>
              </div>
              <input
                type="range"
                min={modelConfig.sliders.noiseLevel.min}
                max={modelConfig.sliders.noiseLevel.max}
                step={modelConfig.sliders.noiseLevel.step}
                value={noiseLevel}
                onChange={(e) => setNoiseLevel(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-1">
                Technical measurement errors from sequencing and other procedures. Adds random scatter to purple.
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-gray-700">
                  Measurement Resolution: {numBins}
                </label>
              </div>
              <input
                type="range"
                min={modelConfig.sliders.numBins.min}
                max={modelConfig.sliders.numBins.max}
                step={modelConfig.sliders.numBins.step}
                value={numBins}
                onChange={(e) => setNumBins(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-1">
                Analogous to instrument sensitivity. Higher values create more, narrower bars for finer detail, but can introduce noise.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Visualization - Takes remaining space */}
      <div className="bg-white border border-gray-200 rounded p-3 mb-3 flex-1 flex flex-col">
        <h3 className="text-sm font-medium mb-2 text-gray-700 text-center">Distribution Comparison</h3>
        
        <div className="flex-1 flex justify-center items-center">
          <svg width={width} height={height} className="border rounded">
            <g transform={`translate(${margin.left}, ${margin.top})`}>
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map(frac => (
                <line
                  key={frac}
                  x1={0}
                  x2={plotWidth}
                  y1={yScale(frac * maxY)}
                  y2={yScale(frac * maxY)}
                  stroke="#f0f0f0"
                  strokeWidth={1}
                />
              ))}
              
              {/* Baseline distribution */}
              {basalHist.map((d, i) => (
                <rect
                  key={`basal-${i}`}
                  x={xScale(d.x - d.width/2)}
                  y={yScale(d.y)}
                  width={Math.max(1, xScale(d.x + d.width/2) - xScale(d.x - d.width/2))}
                  height={plotHeight - yScale(d.y)}
                  fill="rgba(59, 130, 246, 0.6)"
                  stroke="rgba(59, 130, 246, 0.8)"
                  strokeWidth={1}
                />
              ))}
              
              {/* Combined distribution */}
              {combinedHist.map((d, i) => (
                <rect
                  key={`combined-${i}`}
                  x={xScale(d.x - d.width/2)}
                  y={yScale(d.y)}
                  width={Math.max(1, xScale(d.x + d.width/2) - xScale(d.x - d.width/2))}
                  height={plotHeight - yScale(d.y)}
                  fill="rgba(147, 51, 234, 0.4)"
                  stroke="rgba(147, 51, 234, 0.7)"
                  strokeWidth={1}
                />
              ))}
              
              {/* Perturbation effect arrow */}
              {perturbationEffect !== 0 && (
                <g>
                  <defs>
                    <marker id="arrowhead" markerWidth="8" markerHeight="5" 
                            refX="7" refY="2.5" orient="auto">
                      <polygon points="0 0, 8 2.5, 0 5" fill="#ef4444" />
                    </marker>
                  </defs>
                  <line
                    x1={xScale(basalMean)}
                    y1={plotHeight/2}
                    x2={xScale(basalMean + perturbationEffect)}
                    y2={plotHeight/2}
                    stroke="#ef4444"
                    strokeWidth={2}
                    markerEnd="url(#arrowhead)"
                  />
                  <text
                    x={xScale(basalMean + perturbationEffect/2)}
                    y={plotHeight/2 - 8}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#ef4444"
                    fontWeight="bold"
                  >
                    T<tspan baselineShift="sub">p</tspan> effect
                  </text>
                </g>
              )}
              
              {/* Axes */}
              <line x1={0} y1={plotHeight} x2={plotWidth} y2={plotHeight} stroke="black" strokeWidth={1}/>
              <line x1={0} y1={0} x2={0} y2={plotHeight} stroke="black" strokeWidth={1}/>
              
              {/* Axis labels */}
              <text x={plotWidth/2} y={plotHeight + 25} textAnchor="middle" fontSize="12" fill="#374151">
                Expression Level
              </text>
              <text x={-25} y={plotHeight/2} textAnchor="middle" fontSize="12" fill="#374151" 
                    transform={`rotate(-90, -25, ${plotHeight/2})`}>
                Cell Count
              </text>
            </g>
          </svg>
        </div>
        
        <div className="flex justify-center mt-2">
          <div className="flex items-center space-x-4 text-xs text-gray-600">
            <div className="flex items-center">
              <div className="w-3 h-2 bg-blue-500 mr-1 opacity-60"></div>
              <span>Baseline D<sub>basal</sub></span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-2 bg-purple-600 mr-1 opacity-60"></div>
              <span>Final observed X̂<sub>p</sub></span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-1 bg-red-500 mr-1"></div>
              <span>Perturbation effect T<sub>p</sub></span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Model Understanding - Compact */}
      <div className="bg-white border border-gray-200 rounded p-3">
        <h4 className="text-sm font-medium mb-1 text-gray-700">Model Understanding</h4>
        <p className="text-xs text-gray-600">
          Single-cell experiments measure thousands of cells to understand how treatments affect gene expression. 
          The model separates the main treatment effect from natural cell-to-cell variation and technical noise, 
          helping researchers identify true biological responses versus experimental artifacts and detect subtle but consistent treatment effects across cell populations.
        </p>
      </div>
    </div>
  );
};

export default PerturbationModelViz;
