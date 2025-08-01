'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// Types
interface Edge {
  zebrafish_id: string;
  human_id: string;
  orthology_type: 'ortholog_one2one' | 'ortholog_one2many' | 'ortholog_many2one' | 'ortholog_many2many';
  confidence: number;
  validated: boolean;
}

interface EdgePayload {
  fishGenes: string[];
  humanGenes: string[];
  edges: Edge[];
  counts: Record<string, number>;
  metadata?: {
    is_subset: boolean;
    subset_size: number;
    full_size: number;
    sampling_ratio: number;

    /** stats for ALL edges in the original file */
    full_stats: {
      total_edges: number;
      total_fish_genes: number;
      total_human_genes: number;
      type_distribution: Record<string, number>;
      confidence_distribution: {
        high: number;
        medium: number;
        low: number;
      };
      validated_count: number;
    };

    /** stats for the SUBSET file (present only when is_subset == true) */
    subset_stats?: {                       // ← added
      total_edges: number;
      total_fish_genes: number;
      total_human_genes: number;
      type_distribution: Record<string, number>;
      confidence_distribution: {
        high: number;
        medium: number;
        low: number;
      };
      validated_count: number;
    };

    subset_method: string;
  };
}

interface FilteredEdge extends Edge {
  fishIndex: number;
  humanIndex: number;
}

// Configuration for large-scale visualization
const CONFIG = {
  canvas: {
    width: 1200,
    height: 600,
    backgroundColor: '#fafafa',
    margin: { top: 40, right: 40, bottom: 40, left: 40 }
  },
  genes: {
    dotRadius: 1.5,
    dotSpacing: 3,
    hoveredRadius: 3.5,
    colors: {
      zebrafish: '#2563eb',
      human: '#dc2626',
      hovered: '#f59e0b'
    }
  },
  connections: {
    baseWidth: 0.3,
    maxWidth: 1.2,
    baseOpacity: 0.05,
    maxOpacity: 0.4,
    hoveredOpacity: 0.8,
    colors: {
      'ortholog_one2one': 'rgba(34, 197, 94,',     // green
      'ortholog_one2many': 'rgba(59, 130, 246,',   // blue  
      'ortholog_many2one': 'rgba(168, 85, 247,',   // purple
      'ortholog_many2many': 'rgba(239, 68, 68,'    // red
    }
  },
  bands: {
    height: 30,
    separation: 400,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderColor: 'rgba(0, 0, 0, 0.1)'
  }
};

// Define a type for the three dataset options
type DataSourceOption =
  | 'custom_ensembl'
  | 'subset_alliance'
  | 'best_training_alliance';

const OrthologVisualization: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [data,        setData]     = useState<EdgePayload | null>(null);
  const [loading,     setLoading]  = useState(true);
  const [dataSource,  setDataSource] =
    useState<DataSourceOption>('custom_ensembl');
  const [metadata,    setMetadata] =
    useState<EdgePayload['metadata'] | null>(null);

  // UI filters
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);
  const [selectedTypes,       setSelectedTypes] =
    useState<Set<string>>(new Set(['ortholog_one2one']));
  const [maxConnections,      setMaxConnections] = useState(1000);
  const [hoveredGene,         setHoveredGene]    =
    useState<{ species: 'zebrafish' | 'human'; index: number } | null>(null);
  const [hoveredConnection,   setHoveredConnection] =
    useState<FilteredEdge | null>(null);

  // Parse TSV data
  const parseTSVData = useCallback((text: string): EdgePayload => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split('\t');
    
    const edges: Edge[] = [];
    const fishGenesSet = new Set<string>();
    const humanGenesSet = new Set<string>();
    
    // Find column indices
    const zebrafishIdIndex = headers.findIndex(h => h.toLowerCase().includes('gene1') || h.toLowerCase().includes('zebrafish'));
    const humanIdIndex = headers.findIndex(h => h.toLowerCase().includes('gene2') || h.toLowerCase().includes('human'));
    const typeIndex = headers.findIndex(h => h.toLowerCase().includes('type') || h.toLowerCase().includes('orthology'));
    const confidenceIndex = headers.findIndex(h => h.toLowerCase().includes('confidence') || h.toLowerCase().includes('score'));
    
    // Parse each line (skip header)
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t');
      if (cols.length < 2) continue;
      
      const zebrafishId = cols[zebrafishIdIndex >= 0 ? zebrafishIdIndex : 0]?.trim();
      const humanId = cols[humanIdIndex >= 0 ? humanIdIndex : 1]?.trim();
      
      // Map orthology types from Alliance format
      let orthologyType: Edge['orthology_type'] = 'ortholog_one2one';
      if (typeIndex >= 0 && cols[typeIndex]) {
        const type = cols[typeIndex].toLowerCase();
        if (type.includes('one') && type.includes('many')) {
          orthologyType = 'ortholog_one2many';
        } else if (type.includes('many') && type.includes('one')) {
          orthologyType = 'ortholog_many2one';
        } else if (type.includes('many') && type.includes('many')) {
          orthologyType = 'ortholog_many2many';
        }
      }
      
      const confidence = confidenceIndex >= 0 && cols[confidenceIndex] ? 
        parseFloat(cols[confidenceIndex]) : 0.75;
      
      if (zebrafishId && humanId && !zebrafishId.startsWith('#')) {
        fishGenesSet.add(zebrafishId);
        humanGenesSet.add(humanId);
        
        edges.push({
          zebrafish_id: zebrafishId,
          human_id: humanId,
          orthology_type: orthologyType,
          confidence: isNaN(confidence) ? 0.75 : Math.min(1, Math.max(0, confidence)),
          validated: false
        });
      }
    }
    
    console.log(`Parsed ${edges.length} ortholog pairs from TSV`);
    
    return {
      fishGenes: Array.from(fishGenesSet).sort(),
      humanGenes: Array.from(humanGenesSet).sort(),
      edges: edges,
      counts: {}
    };
  }, []);

    // Updated data loading effect to handle the three dataset options
    // ────────────────────────────────────────────────────────────
    // 1. load the chosen dataset
    // ────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────
// 1. load the chosen dataset
// ────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);

    const load = (url: string, stripMeta = false) =>
      fetch(url)
        .then(r => r.json())
        .then((p: EdgePayload) => {
          setData(p);
          setMetadata(stripMeta ? null : p.metadata || null);
          setLoading(false);
        })
        .catch(e => {
          console.error(`Load failed for ${url}:`, e);
          setLoading(false);
        });

    switch (dataSource) {
      case 'custom_ensembl':
        load('/api/orthologs', /* stripMeta */ true);
        break;
      case 'subset_alliance':
        load('/data/alliance_subset_5k.json');
        break;
      case 'best_training_alliance':
        load('/data/alliance_best_training.json');
        break;
    }
  }, [dataSource]);   // ✅ only dependency you need


  // Filter and process edges
  const processedData = useMemo(() => {
    if (!data) return null;
    // Create index maps
    const fishIndexMap = new Map(data.fishGenes.map((gene, i) => [gene, i]));
    const humanIndexMap = new Map(data.humanGenes.map((gene, i) => [gene, i]));
    // Filter edges
    let filteredEdges = data.edges
      .filter(edge => edge.confidence >= confidenceThreshold)
      .filter(edge => selectedTypes.has(edge.orthology_type))
      .map(edge => ({
        ...edge,
        fishIndex: fishIndexMap.get(edge.zebrafish_id) || 0,
        humanIndex: humanIndexMap.get(edge.human_id) || 0
      }));
    // Sort by confidence and limit
    filteredEdges = filteredEdges
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxConnections);
    return {
      fishGenes: data.fishGenes,
      humanGenes: data.humanGenes,
      edges: filteredEdges,
      totalEdges: data.edges.length
    };
  }, [data, confidenceThreshold, selectedTypes, maxConnections]);

  // Helper function to get point on bezier curve
  const getBezierPoint = useCallback((t: number, x1: number, y1: number, x2: number, y2: number) => {
    const controlY1 = y1 + (y2 - y1) * 0.3;
    const controlY2 = y2 - (y2 - y1) * 0.3;
    
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;
    
    return {
      x: mt3 * x1 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x2,
      y: mt3 * y1 + 3 * mt2 * t * controlY1 + 3 * mt * t2 * controlY2 + t3 * y2
    };
  }, []);

  // Check if mouse is near a connection line
  const findHoveredConnection = useCallback((mouseX: number, mouseY: number, currentPositions: any) => {
    if (!processedData || !currentPositions) return null;
    
    const threshold = 12; // Increased threshold for easier hovering
    
    for (const edge of processedData.edges) {
      const fishPos = currentPositions.fish[edge.fishIndex];
      const humanPos = currentPositions.human[edge.humanIndex];
      
      if (!fishPos || !humanPos) continue;
      
      // Sample points along the bezier curve
      for (let t = 0; t <= 1; t += 0.025) { // Increase sampling rate for better detection
        const point = getBezierPoint(t, fishPos.x, fishPos.y, humanPos.x, humanPos.y);
        const distance = Math.sqrt((mouseX - point.x) ** 2 + (mouseY - point.y) ** 2);
        
        if (distance < threshold) {
          return edge;
        }
      }
    }
    
    return null;
  }, [processedData, getBezierPoint]);

  const positions = useMemo(() => {
    if (!processedData) return null;
    const { width, height, margin } = CONFIG.canvas;
    const availableWidth = width - margin.left - margin.right;
    const centerY = height / 2;
    const fishY  = centerY - CONFIG.bands.separation / 2;
    const humanY = centerY + CONFIG.bands.separation / 2;
    const fishPositions = processedData.fishGenes.map((_, i) => ({
      x: margin.left + (i / Math.max(1, processedData.fishGenes.length - 1)) * availableWidth,
      y: fishY,
    }));
    const humanPositions = processedData.humanGenes.map((_, i) => ({
      x: margin.left + (i / Math.max(1, processedData.humanGenes.length - 1)) * availableWidth,
      y: humanY,
    }));
    return { fish: fishPositions, human: humanPositions, fishY, humanY };
  }, [processedData]);
  
  // Drawing function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !processedData || !positions) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = CONFIG.canvas;
    
    // Clear canvas
    ctx.fillStyle = CONFIG.canvas.backgroundColor;
    ctx.fillRect(0, 0, width, height);
    // Draw bands
    const bandWidth = width - CONFIG.canvas.margin.left - CONFIG.canvas.margin.right;
    
    // Zebrafish band
    ctx.fillStyle = CONFIG.bands.backgroundColor;
    ctx.fillRect(
      CONFIG.canvas.margin.left,
      positions.fishY - CONFIG.bands.height / 2,
      bandWidth,
      CONFIG.bands.height
    );
    
    // Human band  
    ctx.fillRect(
      CONFIG.canvas.margin.left,
      positions.humanY - CONFIG.bands.height / 2,
      bandWidth,
      CONFIG.bands.height
    );
    // Band borders
    ctx.strokeStyle = CONFIG.bands.borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      CONFIG.canvas.margin.left,
      positions.fishY - CONFIG.bands.height / 2,
      bandWidth,
      CONFIG.bands.height
    );
    ctx.strokeRect(
      CONFIG.canvas.margin.left,
      positions.humanY - CONFIG.bands.height / 2,
      bandWidth,
      CONFIG.bands.height
    );
    // Labels
    ctx.fillStyle = '#374151';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Zebrafish genes', CONFIG.canvas.margin.left, positions.fishY - CONFIG.bands.height / 2 - 8);
    ctx.fillText('Human genes', CONFIG.canvas.margin.left, positions.humanY + CONFIG.bands.height / 2 + 20);
    // Draw connections (sorted by confidence, lowest first)
    const sortedEdges = [...processedData.edges].sort((a, b) => a.confidence - b.confidence);
    
    sortedEdges.forEach(edge => {
      const fishPos = positions.fish[edge.fishIndex];
      const humanPos = positions.human[edge.humanIndex];
      
      if (!fishPos || !humanPos) return;
      // Check if this edge should be highlighted
      const isHighlighted = (hoveredGene && (
        (hoveredGene.species === 'zebrafish' && hoveredGene.index === edge.fishIndex) ||
        (hoveredGene.species === 'human' && hoveredGene.index === edge.humanIndex)
      )) || hoveredConnection === edge;
      const baseColor = CONFIG.connections.colors[edge.orthology_type];
      const opacity = isHighlighted ? 
        CONFIG.connections.hoveredOpacity : 
        CONFIG.connections.baseOpacity + (CONFIG.connections.maxOpacity - CONFIG.connections.baseOpacity) * edge.confidence;
      
      const width = isHighlighted ?
        CONFIG.connections.maxWidth * 2 :
        CONFIG.connections.baseWidth + (CONFIG.connections.maxWidth - CONFIG.connections.baseWidth) * edge.confidence;
      ctx.strokeStyle = baseColor + opacity + ')';
      ctx.lineWidth = width;
      ctx.globalAlpha = 1;
      // Draw smooth curve
      ctx.beginPath();
      ctx.moveTo(fishPos.x, fishPos.y);
      
      const controlY1 = fishPos.y + (humanPos.y - fishPos.y) * 0.3;
      const controlY2 = humanPos.y - (humanPos.y - fishPos.y) * 0.3;
      
      ctx.bezierCurveTo(
        fishPos.x, controlY1,
        humanPos.x, controlY2,
        humanPos.x, humanPos.y
      );
      ctx.stroke();
    });
    // Draw gene dots
    // Zebrafish genes
    positions.fish.forEach((pos, i) => {
      const isHovered = hoveredGene?.species === 'zebrafish' && hoveredGene?.index === i;
      const radius = isHovered ? CONFIG.genes.hoveredRadius : CONFIG.genes.dotRadius;
      const color = isHovered ? CONFIG.genes.colors.hovered : CONFIG.genes.colors.zebrafish;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
      if (isHovered) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
    // Human genes
    positions.human.forEach((pos, i) => {
      const isHovered = hoveredGene?.species === 'human' && hoveredGene?.index === i;
      const radius = isHovered ? CONFIG.genes.hoveredRadius : CONFIG.genes.dotRadius;
      const color = isHovered ? CONFIG.genes.colors.hovered : CONFIG.genes.colors.human;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
      if (isHovered) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }, [processedData, positions, hoveredGene, hoveredConnection]);

  // Animation loop
  useEffect(() => {
    let animationId: number;
    const animate = () => {
      draw();
      animationId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationId);
  }, [draw]);

  // Mouse handling
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!positions) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Get accurate canvas-relative coordinates
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    let foundGene: {species: 'zebrafish' | 'human', index: number} | null = null;
    const hoverRadius = CONFIG.genes.hoveredRadius * 3; // Increase detection radius
    
    // Check zebrafish genes
    positions.fish.forEach((pos, i) => {
      const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
      if (distance < hoverRadius) {
        foundGene = { species: 'zebrafish', index: i };
      }
    });
    
    // Check human genes (if no zebrafish gene found)
    if (!foundGene) {
      positions.human.forEach((pos, i) => {
        const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
        if (distance < hoverRadius) {
          foundGene = { species: 'human', index: i };
        }
      });
    }
    
    // If no gene found, check for connection hover
    let foundConnection: FilteredEdge | null = null;
    if (!foundGene) {
      foundConnection = findHoveredConnection(x, y, positions);
    }
    
    setHoveredGene(foundGene);
    setHoveredConnection(foundConnection);
  }, [positions, findHoveredConnection]);

  // Get connections for hovered gene or connection
  const hoveredConnections = useMemo(() => {
    if (!processedData) return [];
    
    if (hoveredGene) {
      return processedData.edges.filter(edge => 
        (hoveredGene.species === 'zebrafish' && edge.fishIndex === hoveredGene.index) ||
        (hoveredGene.species === 'human' && edge.humanIndex === hoveredGene.index)
      );
    }
    
    if (hoveredConnection) {
      return [hoveredConnection];
    }
    
    return [];
  }, [hoveredGene, hoveredConnection, processedData]);

  // Get dataset source label for display
  const getDataSourceLabel = () => {
    switch (dataSource) {
      case 'custom_ensembl':
        return 'Custom Ensembl 114';
      case 'subset_alliance':
        return 'Subset Orthology Alliance';     // ← match button caption ✅
      case 'best_training_alliance':
        return 'Best-Training Alliance';        // ← match button caption ✅
      default:
        return 'Unknown Source';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading ortholog data...</div>
      </div>
    );
  }

  if (!data || !processedData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-red-500">Failed to load data</div>
      </div>
    );
  }

  const toggleType = (type: string) => {
    const newTypes = new Set(selectedTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setSelectedTypes(newTypes);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-light text-gray-800 mb-1">
          Zebrafish ⇄ Human Ortholog Mapping
        </h1>
        <p className="text-gray-600 text-sm max-w-3xl mx-auto">
          Zeroshot Biolabs relies on zebrafish because the whole-animal model lets us test hundreds of compounds quickly and cheaply—but every insight we generate must ultimately predict what will happen in humans. Ortholog mapping is the molecular &quot;Rosetta Stone&quot; that makes that leap possible: it tells us which zebrafish gene is functionally-equivalent to each human gene, how many copies exist on either side, and how confident we can be in that match. With a clean, well-scored ortholog table in hand we can transfer single-cell expression patterns, CRISPR targets and drug-response signatures across species, train joint embeddings that speak a common genetic language, and rank candidate therapeutics with far higher confidence than animal data alone could provide.
        </p>
        
        {/* Updated Data Source Toggle with three options */}
        <div className="mt-3 flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Data source:</span>
            <div className="inline-flex bg-gray-100 rounded-lg p-1">
              <button
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  dataSource === 'custom_ensembl' 
                    ? 'bg-white text-gray-800 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => {
                  setDataSource('custom_ensembl');
                  setHoveredGene(null);
                  setHoveredConnection(null);
                }}
              >
                Custom Ensembl 114
              </button>
              <button
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  dataSource === 'subset_alliance' 
                    ? 'bg-white text-gray-800 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => {
                  setDataSource('subset_alliance');
                  setHoveredGene(null);
                  setHoveredConnection(null);
                }}
              >
                Representative Subset Alliance
              </button>
              <button
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  dataSource === 'best_training_alliance' 
                    ? 'bg-white text-gray-800 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => {
                  setDataSource('best_training_alliance');
                  setHoveredGene(null);
                  setHoveredConnection(null);
                }}
              >
                Best-Training Alliance
              </button>
            </div>
          </div>
        </div>
        
        {/* Dataset Description Box */}
        <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4 max-w-4xl mx-auto">
          {dataSource === 'custom_ensembl' && (
            <>
              <h3 className="font-medium text-sm text-gray-800 mb-1">Ensembl 114 – full human ⇄ zebrafish dump</h3>
              <p className="text-xs text-gray-600 mb-2">
                Ensembl Compara release 114 lists every orthology relationship the pipeline could infer between human and zebrafish genes. After filtering the 11 GB source file down to just the two species of interest (and discarding one malformed row) we are left with <strong>20 290 gene-pair records</strong>. Each record carries a raw confidence score from 0 – 100 % and is labelled as one-to-one, one-to-many or many-to-many. Because the file preserves <em>every</em> prediction—nearly half of which are under 50 % confidence and only ~44 % curator-validated—it is comprehensive but also noisy; it is ideal for breadth-first scans, not for training a high-precision model.
              </p>
              <h3 className="font-medium text-sm text-gray-800 mb-1">Our &quot;Ensembl 114 subset&quot;</h3>
              <p className="text-xs text-gray-600">
                To make the data usable in a browser we extracted just four essential columns (human ID, zebrafish ID, orthology type and confidence), stored them in a 7 MB Parquet file and loaded that file into the visualisation. No additional filtering was applied, so the subset still reflects the full dump&apos;s class imbalance and mid-range confidence profile—only the payload is smaller on disk. Consequently this view is <em>illustrative</em> rather than authoritative: it shows the raw Ensembl landscape, but users should switch to the <strong>Representative Subset Alliance</strong> or the <strong>Best-Training Alliance</strong> tabs when they need cleaner, higher-confidence anchors for downstream analysis.
              </p>
            </>
          )}
          
          {dataSource === 'subset_alliance' && (
            <>
              <h3 className="font-medium text-sm text-gray-800 mb-1">Representative Subset Alliance (5k stratified sample)</h3>
              <p className="text-xs text-gray-600">
                Here we down-sampled the 25 165-row Alliance orthology table to <strong>exactly 5 000 edges</strong> by stratified sampling: every orthology type was guaranteed at least 10 % representation, and high-confidence ZFIN-validated pairs were given priority. The resulting subset mirrors the full table&apos;s class distribution (about <strong>35 % one-to-one, 27 % one-to-many, 12 % many-to-one and 26 % many-to-many</strong>) while remaining lightweight enough for interactive demos. Roughly <strong>3 700 edges exceed 80 % confidence</strong>, which lets you experiment quickly without losing the overall flavour of the full Alliance data.
              </p>
            </>
          )}
          
          {dataSource === 'best_training_alliance' && (
            <>
              <h3 className="font-medium text-sm text-gray-800 mb-1">Best-Training Alliance (high-confidence anchor set)</h3>
              <p className="text-xs text-gray-600">
                This dataset is an aggressively filtered slice of the Alliance table that keeps only <strong>bidirectional one-to-one orthologs with ≥ 80 % confidence and a ZFIN &quot;best-score&quot; flag</strong>, yielding <strong>6 944 pristine gene pairs</strong>. Every human gene maps to exactly one zebrafish gene and vice versa, and <strong>100 % of the links are both high-confidence and curator-validated</strong>. Because of that deterministic, unambiguous mapping it is the recommended anchor set when you need to train or align cross-species embeddings with minimal noise.
              </p>
            </>
          )}
        </div>
      </div>
      {/* Controls with Hover Info Box */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Controls */}
        <div className="col-span-1 md:col-span-2 bg-white border border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Max Connections */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Show Top: {maxConnections.toLocaleString()} connections
              </label>
              <input
                type="range"
                min={100}
                max={5000}
                step={100}
                value={maxConnections}
                onChange={(e) => setMaxConnections(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            {/* Type Filters */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Ortholog Types
              </label>
              <div className="space-y-1">
                {Object.entries(CONFIG.connections.colors).map(([type, color]) => (
                  <label key={type} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedTypes.has(type)}
                      onChange={() => toggleType(type)}
                      className="mr-2 h-3 w-3"
                    />
                    <div 
                      className="w-2 h-2 rounded mr-2" 
                      style={{ backgroundColor: color + '0.8)' }}
                    />
                    <span className="text-xs text-gray-600">
                      {type.replace('ortholog_', '').replace(/_/g, '-')}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Current Selection - moved to control row */}
        <div className="col-span-1 md:col-span-1 bg-white border border-gray-200 rounded p-4">
          <h3 className="font-medium text-gray-800 text-sm mb-2">
            {hoveredGene ? `${hoveredGene.species === 'zebrafish' ? 'Zebrafish' : 'Human'} Gene` : 
             hoveredConnection ? 'Connection' : 'Hover to Select'}
          </h3>
          <div className="space-y-1 text-xs">
            {hoveredGene && (
              <div>
                <span className="text-gray-600">ID:</span>{' '}
                <span className="font-mono">
                  {hoveredGene.species === 'zebrafish' 
                    ? data.fishGenes[hoveredGene.index]
                    : data.humanGenes[hoveredGene.index]
                  }
                </span>
              </div>
            )}
            {hoveredConnection && (
              <>
                <div>
                  <span className="text-gray-600">Fish:</span>{' '}
                  <span className="font-mono">{hoveredConnection.zebrafish_id}</span>
                </div>
                <div>
                  <span className="text-gray-600">Human:</span>{' '}
                  <span className="font-mono">{hoveredConnection.human_id}</span>
                </div>
                <div>
                  <span className="text-gray-600">Type:</span>{' '}
                  {hoveredConnection.orthology_type.replace('ortholog_', '').replace(/_/g, '-')}
                </div>
                <div>
                  <span className="text-gray-600">Confidence:</span>{' '}
                  {Math.round(hoveredConnection.confidence * 100)}%
                  {hoveredConnection.validated && (
                    <span className="ml-1 text-green-600">✓</span>
                  )}
                </div>
              </>
            )}
            {!hoveredGene && !hoveredConnection && (
              <div className="text-gray-500">
                Hover over genes or connections to see details
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Visualization */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2">
        <canvas
          ref={canvasRef}
          width={CONFIG.canvas.width}
          height={CONFIG.canvas.height}
          className="w-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            setHoveredGene(null);
            setHoveredConnection(null);
          }}
        />
      </div>
      {/* Info Grid - Rearranged into specific rows */}
      <div className="space-y-4">
        {/* Row 1: Relationship Types and Mapping Statistics side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ortholog Types */}
          <div className="bg-white border border-gray-200 rounded p-3">
            <h3 className="font-medium text-gray-800 text-sm mb-2">Relationship Types</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded mt-0.5" style={{ backgroundColor: 'rgba(34, 197, 94, 0.8)' }} />
                <div>
                  <div className="font-medium text-gray-700">One-to-One</div>
                  <div className="text-gray-600">Highest confidence for drug translation</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded mt-0.5" style={{ backgroundColor: 'rgba(59, 130, 246, 0.8)' }} />
                <div>
                  <div className="font-medium text-gray-700">One-to-Many</div>
                  <div className="text-gray-600">Gene duplication in human lineage</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded mt-0.5" style={{ backgroundColor: 'rgba(168, 85, 247, 0.8)' }} />
                <div>
                  <div className="font-medium text-gray-700">Many-to-One</div>
                  <div className="text-gray-600">Duplications in zebrafish</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded mt-0.5" style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)' }} />
                <div>
                  <div className="font-medium text-gray-700">Many-to-Many</div>
                  <div className="text-gray-600">Complex relationships</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Mapping Statistics */}
          <div className="bg-white border border-gray-200 rounded p-3">
            <h3 className="font-medium text-gray-800 text-sm mb-2">
              Mapping Statistics
              {metadata?.is_subset && metadata.subset_size < metadata.full_size && (
                <span className="text-xs font-normal text-amber-600 ml-2">(showing subset)</span>
              )}
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Total pairs:</span>
                <span className="font-mono font-bold">
                  {metadata?.is_subset ? 
                    metadata.full_stats.total_edges.toLocaleString() : 
                    data.edges.length.toLocaleString()
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Visualizing:</span>
                <span className="font-mono">{processedData.edges.length.toLocaleString()}</span>
              </div>
              {Object.entries(CONFIG.connections.colors).map(([type, color]) => {
                const stats = metadata?.is_subset
                  ? (metadata.subset_stats ?? metadata.full_stats)
                  : null;
                const count = stats ? 
                  (stats.type_distribution[type] || 0) :
                  data.edges.filter(e => e.orthology_type === type).length;
                const total = stats ? stats.total_edges : data.edges.length;
                const percentage = ((count / total) * 100).toFixed(1);
                return (
                  <div key={type} className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded" style={{ backgroundColor: color + '0.8)' }} />
                      <span className="text-gray-600">{type.replace('ortholog_', '').replace(/_/g, '-')}</span>
                    </div>
                    <span className="font-mono text-xs">{percentage}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Row 2: Confidence Distribution and Embedding Feasibility side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Confidence Analysis */}
          <div className="bg-white border border-gray-200 rounded p-3">
            <h3 className="font-medium text-gray-800 text-sm mb-2">Confidence Distribution</h3>
            <div className="space-y-1 text-xs">
              {(() => {
                const stats = metadata?.is_subset
                  ? (metadata.subset_stats ?? metadata.full_stats)
                  : null;
                let highConf, medConf, lowConf, validated;
                
                if (stats) {
                  highConf  = stats.confidence_distribution.high   ?? 0;
                  medConf   = stats.confidence_distribution.medium ?? 0;
                  lowConf   = stats.confidence_distribution.low    ?? 0;
                  validated = stats.validated_count               ?? 0;
                } else {
                  highConf = data.edges.filter(e => e.confidence >= 0.8).length;
                  medConf = data.edges.filter(e => e.confidence >= 0.5 && e.confidence < 0.8).length;
                  lowConf = data.edges.filter(e => e.confidence < 0.5).length;
                  validated = data.edges.filter(e => e.validated).length;
                }
                
                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">High (≥80%):</span>
                      <span className="font-mono">{highConf.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Medium (50-79%):</span>
                      <span className="font-mono">{medConf.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Lower (&lt;50%):</span>
                      <span className="font-mono">{lowConf.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-100">
                      <span className="text-gray-600">Validated:</span>
                      <span className="font-mono text-green-600">{validated.toLocaleString()}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
          
          {/* Embedding Feasibility - renamed */}
          <div className="bg-white border border-gray-200 rounded p-3">
            <h3 className="font-medium text-gray-800 text-sm mb-2">
              Zebrafish ⇄ Human Shared Embedding Feasibility
              <span className="text-xs font-normal text-gray-500 ml-2">
                ({getDataSourceLabel()})
              </span>
            </h3>
            {(() => {
              const stats = metadata?.is_subset
                ? (metadata.subset_stats ?? metadata.full_stats)
                : null;
              const total = stats ? stats.total_edges : data.edges.length;
              
              let oneToOneCount, highConfCount;
              if (stats) {
                oneToOneCount = stats.type_distribution['ortholog_one2one'] || 0;
                const highBin   = stats.confidence_distribution.high   ?? 0;
                const mediumBin = stats.confidence_distribution.medium ?? 0;

                highConfCount = highBin + mediumBin * 0.5; // Approx ≥0.7
              } else {
                oneToOneCount = data.edges.filter(e => e.orthology_type === 'ortholog_one2one').length;
                highConfCount = data.edges.filter(e => e.confidence >= 0.7).length;
              }
              
              const oneToOnePercentage = (oneToOneCount / total) * 100;
              const highConfPercentage = (highConfCount / total) * 100;
              
              // Base assessment on metrics
              let feasibilityScore = 'High';
              let feasibilityColor = 'text-green-600';
              let recommendation = '';
              
              if (oneToOnePercentage < 40 || highConfPercentage < 50) {
                feasibilityScore = 'Moderate';
                feasibilityColor = 'text-yellow-600';
              }
              
              if (oneToOnePercentage < 25 || highConfPercentage < 30) {
                feasibilityScore = 'Limited';
                feasibilityColor = 'text-red-600';
              }
              
              // Dataset-specific detailed recommendations
              if (dataSource === 'custom_ensembl') {
                recommendation = 'While this dataset provides comprehensive coverage of potential orthologs, its low signal-to-noise ratio makes it suboptimal for embedding training. Nearly half of the connections have confidence scores below 50%, and many-to-many relationships create ambiguity that can confuse embedding alignment algorithms. Consider using this dataset only for exploratory analysis or to identify candidates for follow-up validation. For embedding training, the Best-Training Alliance dataset would provide cleaner anchors with fewer misleading connections.';
              } else if (dataSource === 'subset_alliance') {
                recommendation = 'This balanced subset preserves the diversity of the full Alliance dataset while remaining computationally manageable. With about 35% one-to-one orthologs and 3,700 high-confidence edges, it offers a reasonable foundation for embedding alignment experiments. However, the presence of complex many-to-many relationships (26%) may introduce noise during training. Consider using confidence-weighted loss functions and potentially filtering further when aligning embedding spaces. Best for intermediate development when you need representative class distribution.';
              } else if (dataSource === 'best_training_alliance') {
                recommendation = 'This dataset is specifically curated for embedding space alignment with only bidirectional one-to-one orthologs and 100% validation rate. Each gene maps deterministically to exactly one gene in the other species, creating clean, unambiguous anchors that minimize training noise. The high confidence threshold (≥80%) ensures that only the most reliable relationships are used. This is the optimal choice for production-grade cross-species embedding alignment, though it sacrifices coverage for precision. Ideal for supervised alignment techniques that benefit from high-quality anchor points.';
              }
              
              return (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-gray-600">Overall Assessment</div>
                    <div className={`text-lg font-bold ${feasibilityColor}`}>{feasibilityScore}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-gray-600">Key Metrics</div>
                    <div className="text-xs">
                      <div>One-to-one: <strong>{oneToOnePercentage.toFixed(1)}%</strong></div>
                      <div>High confidence: <strong>{highConfPercentage.toFixed(1)}%</strong></div>
                    </div>
                  </div>
                  <div className="col-span-2 space-y-1 mt-2">
                    <div className="text-xs text-gray-600">Recommendation</div>
                    <div className="text-xs">{recommendation}</div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrthologVisualization;