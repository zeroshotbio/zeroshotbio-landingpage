'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// Types
interface Gene {
  id: string;
  name: string;
  category: string;
  gridPosition: number;
  functionalAnnotation: string;
}

interface GenePosition {
  x: number;
  y: number;
  gene: Gene;
  index: number;
}

interface OrthologMapping {
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  zebrafishIndices: number[];
  humanIndices: number[];
  confidence: number;
  validated: boolean;
  targetGenes?: Gene[];
}

interface HoveredGene {
  species: 'zebrafish' | 'human';
  index: number;
  gene: Gene;
  position: GenePosition;
}

interface BandPosition {
  y: number;
  label: string;
}

interface Statistics {
  coverage: string;
  mappingTypes: Record<string, number>;
  totalMappings: number;
}

// Configuration
const CONFIG = {
  canvas: {
    width: 800,
    height: 600,
    backgroundColor: '#ffffff',
    margin: { top: 80, right: 80, bottom: 80, left: 80 }
  },
  bands: {
    height: 50,
    separation: 240,
    backgroundColor: 'rgba(240, 240, 240, 0.5)',
    borderColor: 'rgba(0, 0, 0, 0.15)',
    borderWidth: 1
  },
  genes: {
    count: 80,
    nodeRadius: 3,
    nodeSpacing: 8,
    healthyColor: '#059669',
    diseaseColor: '#dc2626',
    drugTargetColor: '#f59e0b',
    neutralColor: '#9ca3af',
    hoverRadius: 15
  },
  orthologs: {
    minOpacity: 0.15,
    maxOpacity: 0.5,
    minWidth: 0.5,
    maxWidth: 2.5,
    baseColor: 'rgba(0, 0, 0, ',
    highlightColor: 'rgba(245, 158, 11, ',
    oneToManyFanAngle: 0.25
  },
  panel: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    textColor: '#374151',
    titleColor: '#111827'
  }
} as const;

// Gene categories
const GENE_CATEGORIES = {
  HEALTHY_MARKER: 'healthy_marker',
  DISEASE_MARKER: 'disease_marker',
  DRUG_TARGET: 'drug_target',
  NEUTRAL: 'neutral'
} as const;

type GeneCategoryType = typeof GENE_CATEGORIES[keyof typeof GENE_CATEGORIES];

// Generate genes with properties
const generateGenes = (count: number): Gene[] => {
  const genes: Gene[] = [];
  
  for (let i = 0; i < count; i++) {
    // Assign categories with realistic distribution
    let category: GeneCategoryType;
    const rand = Math.random();
    if (rand < 0.15) {
      category = GENE_CATEGORIES.HEALTHY_MARKER;
    } else if (rand < 0.3) {
      category = GENE_CATEGORIES.DISEASE_MARKER;
    } else if (rand < 0.4) {
      category = GENE_CATEGORIES.DRUG_TARGET;
    } else {
      category = GENE_CATEGORIES.NEUTRAL;
    }
    
    genes.push({
      id: `gene_${i}`,
      name: `Gene${i + 1}`,
      category,
      gridPosition: i,
      functionalAnnotation: generateFunctionalAnnotation(category)
    });
  }
  
  return genes;
};

// Generate functional annotations
const generateFunctionalAnnotation = (category: GeneCategoryType): string => {
  const annotations: Record<GeneCategoryType, string[]> = {
    [GENE_CATEGORIES.HEALTHY_MARKER]: [
      'Cell cycle regulation',
      'DNA repair pathway',
      'Apoptosis control',
      'Growth factor signaling'
    ],
    [GENE_CATEGORIES.DISEASE_MARKER]: [
      'Oncogene activation',
      'Tumor suppressor loss',
      'Metastasis promotion',
      'Angiogenesis factor'
    ],
    [GENE_CATEGORIES.DRUG_TARGET]: [
      'Kinase inhibitor target',
      'Checkpoint blockade',
      'Metabolic vulnerability',
      'Synthetic lethality'
    ],
    [GENE_CATEGORIES.NEUTRAL]: [
      'Housekeeping gene',
      'Structural protein',
      'Metabolic enzyme',
      'Transport protein'
    ]
  };
  
  const categoryAnnotations = annotations[category];
  return categoryAnnotations[Math.floor(Math.random() * categoryAnnotations.length)];
};

// Generate diverse ortholog mappings
const generateOrthologMappings = (zebrafishGenes: Gene[], humanGenes: Gene[]): OrthologMapping[] => {
  const mappings: OrthologMapping[] = [];
  const usedHumanIndices = new Set<number>();
  const usedZebrafishIndices = new Set<number>();
  
  // Create diverse mapping examples
  let zIndex = 0;
  
  // Add some one-to-one mappings (high confidence)
  for (let i = 0; i < 30 && zIndex < zebrafishGenes.length; i++, zIndex++) {
    if (!usedZebrafishIndices.has(zIndex)) {
      let hIndex = zIndex + Math.floor((Math.random() - 0.5) * 5);
      hIndex = Math.max(0, Math.min(humanGenes.length - 1, hIndex));
      
      if (!usedHumanIndices.has(hIndex)) {
        usedZebrafishIndices.add(zIndex);
        usedHumanIndices.add(hIndex);
        mappings.push({
          type: 'one-to-one',
          zebrafishIndices: [zIndex],
          humanIndices: [hIndex],
          confidence: 0.7 + Math.random() * 0.3,
          validated: Math.random() < 0.4
        });
      }
    }
  }
  
  // Add one-to-many mappings (medium confidence)
  for (let i = 0; i < 10 && zIndex < zebrafishGenes.length - 5; i++, zIndex += 2) {
    if (!usedZebrafishIndices.has(zIndex)) {
      const numTargets = 2 + Math.floor(Math.random() * 2); // 2-3 targets
      const targets: number[] = [];
      
      for (let j = 0; j < numTargets; j++) {
        let hIndex = zIndex + j * 3 + Math.floor(Math.random() * 2);
        hIndex = Math.max(0, Math.min(humanGenes.length - 1, hIndex));
        
        if (!usedHumanIndices.has(hIndex)) {
          targets.push(hIndex);
          usedHumanIndices.add(hIndex);
        }
      }
      
      if (targets.length > 0) {
        usedZebrafishIndices.add(zIndex);
        mappings.push({
          type: 'one-to-many',
          zebrafishIndices: [zIndex],
          humanIndices: targets,
          confidence: 0.4 + Math.random() * 0.3,
          validated: false
        });
      }
    }
  }
  
  // Add many-to-one mappings (lower confidence)
  for (let i = 0; i < 8 && zIndex < zebrafishGenes.length - 3; i++, zIndex += 3) {
    if (!usedZebrafishIndices.has(zIndex) && !usedZebrafishIndices.has(zIndex + 1)) {
      let hIndex = zIndex + Math.floor(Math.random() * 3);
      hIndex = Math.max(0, Math.min(humanGenes.length - 1, hIndex));
      
      if (!usedHumanIndices.has(hIndex)) {
        usedZebrafishIndices.add(zIndex);
        usedZebrafishIndices.add(zIndex + 1);
        usedHumanIndices.add(hIndex);
        mappings.push({
          type: 'many-to-one',
          zebrafishIndices: [zIndex, zIndex + 1],
          humanIndices: [hIndex],
          confidence: 0.3 + Math.random() * 0.3,
          validated: false
        });
      }
    }
  }
  
  // Add a few many-to-many mappings (low confidence)
  for (let i = 0; i < 3 && zIndex < zebrafishGenes.length - 4; i++, zIndex += 4) {
    if (!usedZebrafishIndices.has(zIndex) && !usedZebrafishIndices.has(zIndex + 1)) {
      const targets: number[] = [];
      for (let j = 0; j < 2; j++) {
        let hIndex = zIndex + j * 2 + Math.floor(Math.random() * 2);
        hIndex = Math.max(0, Math.min(humanGenes.length - 1, hIndex));
        
        if (!usedHumanIndices.has(hIndex)) {
          targets.push(hIndex);
          usedHumanIndices.add(hIndex);
        }
      }
      
      if (targets.length > 0) {
        usedZebrafishIndices.add(zIndex);
        usedZebrafishIndices.add(zIndex + 1);
        mappings.push({
          type: 'many-to-many',
          zebrafishIndices: [zIndex, zIndex + 1],
          humanIndices: targets,
          confidence: 0.3 + Math.random() * 0.2,
          validated: false
        });
      }
    }
  }
  
  return mappings;
};

const OrthologMappingVisualization: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [zebrafishGenes] = useState<Gene[]>(() => generateGenes(CONFIG.genes.count));
  const [humanGenes] = useState<Gene[]>(() => generateGenes(CONFIG.genes.count));
  const [orthologMappings] = useState<OrthologMapping[]>(() => generateOrthologMappings(zebrafishGenes, humanGenes));
  const [hoveredGene, setHoveredGene] = useState<HoveredGene | null>(null);
  
  // Calculate band positions
  const bandPositions = useMemo<{ zebrafish: BandPosition; human: BandPosition }>(() => {
    const centerY = CONFIG.canvas.height / 2;
    return {
      zebrafish: {
        y: centerY - CONFIG.bands.separation / 2,
        label: 'Zebrafish genes'
      },
      human: {
        y: centerY + CONFIG.bands.separation / 2,
        label: 'Human genes'
      }
    };
  }, []);
  
  // Calculate gene positions on grid
  const genePositions = useMemo<{ zebrafish: GenePosition[]; human: GenePosition[] }>(() => {
    const positions: { zebrafish: GenePosition[]; human: GenePosition[] } = { zebrafish: [], human: [] };
    const availableWidth = CONFIG.canvas.width - CONFIG.canvas.margin.left - CONFIG.canvas.margin.right;
    const totalSpacing = (CONFIG.genes.count - 1) * CONFIG.genes.nodeSpacing;
    const startX = CONFIG.canvas.margin.left + (availableWidth - totalSpacing) / 2;
    
    zebrafishGenes.forEach((gene, index) => {
      positions.zebrafish.push({
        x: startX + index * CONFIG.genes.nodeSpacing,
        y: bandPositions.zebrafish.y,
        gene,
        index
      });
    });
    
    humanGenes.forEach((gene, index) => {
      positions.human.push({
        x: startX + index * CONFIG.genes.nodeSpacing,
        y: bandPositions.human.y,
        gene,
        index
      });
    });
    
    return positions;
  }, [zebrafishGenes, humanGenes, bandPositions]);
  
  // Get color for gene category
  const getGeneColor = useCallback((category: string): string => {
    switch (category) {
      case GENE_CATEGORIES.HEALTHY_MARKER:
        return CONFIG.genes.healthyColor;
      case GENE_CATEGORIES.DISEASE_MARKER:
        return CONFIG.genes.diseaseColor;
      case GENE_CATEGORIES.DRUG_TARGET:
        return CONFIG.genes.drugTargetColor;
      default:
        return CONFIG.genes.neutralColor;
    }
  }, []);
  
  // Calculate statistics
  const statistics = useMemo<Statistics>(() => {
    const mappingTypes: Record<string, number> = {
      'one-to-one': 0,
      'one-to-many': 0,
      'many-to-one': 0,
      'many-to-many': 0
    };
    
    orthologMappings.forEach(m => {
      mappingTypes[m.type] = (mappingTypes[m.type] || 0) + 1;
    });
    
    const totalGenes = zebrafishGenes.length;
    const mappedGenes = new Set<number>();
    
    orthologMappings.forEach(mapping => {
      mapping.zebrafishIndices.forEach(idx => mappedGenes.add(idx));
    });
    
    return {
      coverage: ((mappedGenes.size / totalGenes) * 100).toFixed(1),
      mappingTypes,
      totalMappings: orthologMappings.length
    };
  }, [orthologMappings, zebrafishGenes.length]);
  
  // Main draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = CONFIG.canvas.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw bands
    const bandWidth = CONFIG.canvas.width - CONFIG.canvas.margin.left - CONFIG.canvas.margin.right;
    
    // Zebrafish band
    ctx.fillStyle = CONFIG.bands.backgroundColor;
    ctx.fillRect(
      CONFIG.canvas.margin.left,
      bandPositions.zebrafish.y - CONFIG.bands.height / 2,
      bandWidth,
      CONFIG.bands.height
    );
    ctx.strokeStyle = CONFIG.bands.borderColor;
    ctx.lineWidth = CONFIG.bands.borderWidth;
    ctx.strokeRect(
      CONFIG.canvas.margin.left,
      bandPositions.zebrafish.y - CONFIG.bands.height / 2,
      bandWidth,
      CONFIG.bands.height
    );
    
    // Human band
    ctx.fillStyle = CONFIG.bands.backgroundColor;
    ctx.fillRect(
      CONFIG.canvas.margin.left,
      bandPositions.human.y - CONFIG.bands.height / 2,
      bandWidth,
      CONFIG.bands.height
    );
    ctx.strokeRect(
      CONFIG.canvas.margin.left,
      bandPositions.human.y - CONFIG.bands.height / 2,
      bandWidth,
      CONFIG.bands.height
    );
    
    // Draw band labels
    ctx.font = '14px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = CONFIG.panel.titleColor;
    ctx.textAlign = 'left';
    ctx.fillText(
      bandPositions.zebrafish.label,
      CONFIG.canvas.margin.left,
      bandPositions.zebrafish.y - CONFIG.bands.height / 2 - 10
    );
    ctx.fillText(
      bandPositions.human.label,
      CONFIG.canvas.margin.left,
      bandPositions.human.y + CONFIG.bands.height / 2 + 20
    );
    
    // Sort mappings by confidence to draw weaker connections first
    const sortedMappings = [...orthologMappings].sort((a, b) => a.confidence - b.confidence);
    
    // Draw ortholog connections
    sortedMappings.forEach(mapping => {
      const opacity = CONFIG.orthologs.minOpacity + 
        (CONFIG.orthologs.maxOpacity - CONFIG.orthologs.minOpacity) * mapping.confidence;
      const width = CONFIG.orthologs.minWidth + 
        (CONFIG.orthologs.maxWidth - CONFIG.orthologs.minWidth) * mapping.confidence;
      
      // Check if this mapping involves the hovered gene
      const isHighlighted = hoveredGene && (
        (hoveredGene.species === 'zebrafish' && mapping.zebrafishIndices.includes(hoveredGene.index)) ||
        (hoveredGene.species === 'human' && mapping.humanIndices.includes(hoveredGene.index))
      );
      
      if (isHighlighted) {
        ctx.strokeStyle = CONFIG.orthologs.highlightColor + '0.8)';
        ctx.lineWidth = width * 2;
      } else {
        ctx.strokeStyle = CONFIG.orthologs.baseColor + opacity + ')';
        ctx.lineWidth = width;
      }
      
      if (mapping.type === 'one-to-one') {
        const zPos = genePositions.zebrafish[mapping.zebrafishIndices[0]];
        const hPos = genePositions.human[mapping.humanIndices[0]];
        
        if (zPos && hPos) {
          ctx.beginPath();
          ctx.moveTo(zPos.x, zPos.y);
          const cp1y = zPos.y + (hPos.y - zPos.y) * 0.3;
          const cp2y = hPos.y - (hPos.y - zPos.y) * 0.3;
          ctx.bezierCurveTo(zPos.x, cp1y, hPos.x, cp2y, hPos.x, hPos.y);
          ctx.stroke();
        }
      } else if (mapping.type === 'one-to-many') {
        const zPos = genePositions.zebrafish[mapping.zebrafishIndices[0]];
        if (zPos) {
          mapping.humanIndices.forEach((hIndex, i) => {
            const hPos = genePositions.human[hIndex];
            if (hPos) {
              const angle = (i - (mapping.humanIndices.length - 1) / 2) * CONFIG.orthologs.oneToManyFanAngle;
              
              ctx.beginPath();
              ctx.moveTo(zPos.x, zPos.y);
              const midY = (zPos.y + hPos.y) / 2;
              const cp1x = zPos.x + Math.sin(angle) * 30;
              const cp1y = zPos.y + (midY - zPos.y) * 0.6;
              const cp2x = hPos.x + Math.sin(angle) * 20;
              const cp2y = hPos.y - (hPos.y - midY) * 0.6;
              ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, hPos.x, hPos.y);
              ctx.stroke();
            }
          });
        }
      } else if (mapping.type === 'many-to-one') {
        const hPos = genePositions.human[mapping.humanIndices[0]];
        if (hPos) {
          mapping.zebrafishIndices.forEach((zIndex) => {
            const zPos = genePositions.zebrafish[zIndex];
            if (zPos) {
              ctx.beginPath();
              ctx.moveTo(zPos.x, zPos.y);
              ctx.bezierCurveTo(
                zPos.x, zPos.y + (hPos.y - zPos.y) * 0.3,
                hPos.x, hPos.y - (hPos.y - zPos.y) * 0.3,
                hPos.x, hPos.y
              );
              ctx.stroke();
            }
          });
        }
      } else if (mapping.type === 'many-to-many') {
        // Draw from each zebrafish gene to each human gene
        mapping.zebrafishIndices.forEach(zIndex => {
          const zPos = genePositions.zebrafish[zIndex];
          if (zPos) {
            mapping.humanIndices.forEach(hIndex => {
              const hPos = genePositions.human[hIndex];
              if (hPos) {
                ctx.beginPath();
                ctx.moveTo(zPos.x, zPos.y);
                ctx.bezierCurveTo(
                  zPos.x, zPos.y + (hPos.y - zPos.y) * 0.3,
                  hPos.x, hPos.y - (hPos.y - zPos.y) * 0.3,
                  hPos.x, hPos.y
                );
                ctx.stroke();
              }
            });
          }
        });
      }
    });
    
    // Draw gene nodes
    genePositions.zebrafish.forEach((pos, index) => {
      const isHovered = hoveredGene?.species === 'zebrafish' && hoveredGene?.index === index;
      ctx.fillStyle = getGeneColor(pos.gene.category);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isHovered ? CONFIG.genes.nodeRadius * 1.5 : CONFIG.genes.nodeRadius, 0, Math.PI * 2);
      ctx.fill();
      
      if (isHovered) {
        ctx.strokeStyle = CONFIG.orthologs.highlightColor + '1)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
    
    genePositions.human.forEach((pos, index) => {
      const isHovered = hoveredGene?.species === 'human' && hoveredGene?.index === index;
      ctx.fillStyle = getGeneColor(pos.gene.category);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isHovered ? CONFIG.genes.nodeRadius * 1.5 : CONFIG.genes.nodeRadius, 0, Math.PI * 2);
      ctx.fill();
      
      if (isHovered) {
        ctx.strokeStyle = CONFIG.orthologs.highlightColor + '1)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
    
  }, [bandPositions, genePositions, orthologMappings, hoveredGene, getGeneColor]);
  
  // Animation loop
  useEffect(() => {
    const animate = () => {
      draw();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [draw]);
  
  // Handle mouse movement
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check for gene hover with large detection radius
    let foundGene: HoveredGene | null = null;
    let minDistance = Infinity;
    
    // Check zebrafish genes
    genePositions.zebrafish.forEach((pos, index) => {
      const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
      if (distance < CONFIG.genes.hoverRadius && distance < minDistance) {
        minDistance = distance;
        foundGene = {
          species: 'zebrafish',
          index,
          gene: pos.gene,
          position: pos
        };
      }
    });
    
    // Check human genes
    genePositions.human.forEach((pos, index) => {
      const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
      if (distance < CONFIG.genes.hoverRadius && distance < minDistance) {
        minDistance = distance;
        foundGene = {
          species: 'human',
          index,
          gene: pos.gene,
          position: pos
        };
      }
    });
    
    setHoveredGene(foundGene);
  }, [genePositions]);
  
  // Get ortholog info for hovered gene
  const getOrthologInfo = useCallback(() => {
    if (!hoveredGene) return null;
    
    const relevantMappings = orthologMappings.filter(m => {
      if (hoveredGene.species === 'zebrafish') {
        return m.zebrafishIndices.includes(hoveredGene.index);
      } else {
        return m.humanIndices.includes(hoveredGene.index);
      }
    });
    
    if (relevantMappings.length === 0) {
      return { type: 'No ortholog mapping', mappings: [] };
    }
    
    return {
      mappings: relevantMappings.map(m => ({
        ...m,
        targetGenes: hoveredGene.species === 'zebrafish' 
          ? m.humanIndices.map(i => humanGenes[i])
          : m.zebrafishIndices.map(i => zebrafishGenes[i])
      }))
    };
  }, [hoveredGene, orthologMappings, humanGenes, zebrafishGenes]);
  
  const orthologInfo = getOrthologInfo();
  
  // Default gene info when nothing is hovered
  const defaultGeneInfo = {
    name: 'Hover over a gene',
    category: 'Select a gene to see details',
    annotation: 'Mouse over any gene node to explore ortholog relationships',
    species: ''
  };
  
  const displayGene = hoveredGene || {
    gene: {
      name: defaultGeneInfo.name,
      category: defaultGeneInfo.category,
      functionalAnnotation: defaultGeneInfo.annotation
    },
    species: defaultGeneInfo.species
  };
  
  return (
    <div className="flex flex-col items-center p-8 bg-gray-50 min-h-screen">
      <div className="mb-8 text-center max-w-4xl">
        <h1 className="text-2xl font-light text-gray-800 mb-4">
          Cross-Species Ortholog Mapping
        </h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          Gene orthology between zebrafish and human genomes. Curved connections show various ortholog relationships: 
          one-to-one (thick lines), one-to-many (fan patterns), many-to-one (converging lines), and many-to-many (complex webs). 
          Connection thickness and opacity encode confidence levels.
        </p>
      </div>
      
      <div className="flex gap-6">
        {/* Main visualization */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={CONFIG.canvas.width}
            height={CONFIG.canvas.height}
            className="bg-white border border-gray-200 shadow-sm cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredGene(null)}
          />
        </div>
        
        {/* Side panels - always visible */}
        <div className="space-y-4">
          {/* Gene Categories */}
          <div className="w-64 bg-white border border-gray-200 p-4 rounded shadow-sm">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Gene Categories</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CONFIG.genes.healthyColor }} />
                <span className="text-xs text-gray-600">Healthy markers</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CONFIG.genes.diseaseColor }} />
                <span className="text-xs text-gray-600">Disease markers</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CONFIG.genes.drugTargetColor }} />
                <span className="text-xs text-gray-600">Drug targets</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CONFIG.genes.neutralColor }} />
                <span className="text-xs text-gray-600">Other genes</span>
              </div>
            </div>
          </div>
          
          {/* Gene Information - always visible */}
          <div className="w-64 bg-white border border-gray-200 p-4 rounded shadow-sm">
            <h3 className="font-medium text-gray-800 mb-3">
              {displayGene.species && `${displayGene.species === 'zebrafish' ? 'Zebrafish' : 'Human'} `}
              {displayGene.gene.name}
            </h3>
            
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Category:</span>{' '}
                {hoveredGene ? (
                  <span className="font-medium" style={{ color: getGeneColor(hoveredGene.gene.category) }}>
                    {hoveredGene.gene.category.replace(/_/g, ' ')}
                  </span>
                ) : (
                  <span className="text-gray-400 italic text-xs">{displayGene.gene.category}</span>
                )}
              </div>
              
              <div>
                <span className="text-gray-500">Function:</span>{' '}
                <span className={hoveredGene ? "text-gray-700" : "text-gray-400 italic text-xs"}>
                  {displayGene.gene.functionalAnnotation}
                </span>
              </div>
              
              {hoveredGene && orthologInfo && (
                <>
                  <div className="pt-2 border-t border-gray-100">
                    <span className="text-gray-500">Ortholog mappings:</span>{' '}
                    <span className="font-medium text-gray-700">
                      {orthologInfo.mappings.length > 0 ? orthologInfo.mappings[0].type : 'None'}
                    </span>
                  </div>
                  
                  {orthologInfo.mappings.length > 0 && (
                    <div className="space-y-2">
                      {orthologInfo.mappings.map((mapping, i) => (
                        <div key={i} className="pl-4 border-l-2 border-orange-200">
                          <div className="text-xs text-gray-500">
                            Confidence: <span className="font-medium">{(mapping.confidence * 100).toFixed(0)}%</span>
                            {mapping.validated && (
                              <span className="ml-2 text-green-600">✓ Validated</span>
                            )}
                          </div>
                          {mapping.targetGenes && (
                            <div className="text-xs text-gray-600 mt-1">
                              {hoveredGene.species === 'zebrafish' ? '→' : '←'} 
                              {' '}{mapping.targetGenes.map(g => g.name).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* Mapping Statistics */}
          <div className="w-64 bg-white border border-gray-200 p-4 rounded shadow-sm">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Mapping Statistics</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Coverage:</span>
                <span className="font-medium text-gray-800">{statistics.coverage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total mappings:</span>
                <span className="font-medium text-gray-800">{statistics.totalMappings}</span>
              </div>
              <div className="pt-2 border-t border-gray-100 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">One-to-one:</span>
                  <span className="font-medium text-gray-800">{statistics.mappingTypes['one-to-one']}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">One-to-many:</span>
                  <span className="font-medium text-gray-800">{statistics.mappingTypes['one-to-many']}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Many-to-one:</span>
                  <span className="font-medium text-gray-800">{statistics.mappingTypes['many-to-one']}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Many-to-many:</span>
                  <span className="font-medium text-gray-800">{statistics.mappingTypes['many-to-many'] || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 max-w-3xl text-center">
        <p className="text-sm text-gray-600 leading-relaxed">
          This visualization reveals the complexity of cross-species ortholog mapping. While one-to-one mappings 
          (thick, high-confidence lines) provide the most reliable basis for therapeutic translation, 
          the presence of one-to-many and many-to-one relationships shows why additional validation is often needed 
          before translating zebrafish discoveries to human applications.
        </p>
      </div>
    </div>
  );
};

export default OrthologMappingVisualization;