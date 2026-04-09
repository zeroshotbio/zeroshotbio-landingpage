'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import type { MouseEvent } from 'react';

// ============================================================================
// AESTHETIC AND GEOMETRIC CONFIGURATION - Tweak these values for visual adjustments
// ============================================================================

// MAJOR REGION LABEL STYLING
const REGION_LABEL_CONFIG = {
  fontSize: {
    desktop: 15,
    mobile: 12
  },
  fontFamily: 'ui-serif, Georgia, serif', // Match roboto-slab style
  fontWeight: '300',
  textColor: 'rgba(0, 0, 0, 0.7)', // Desaturated gray text
  strokeColor: 'rgba(0, 0, 0, 0.8)', // Subtle white outline
  strokeWidth: 0.1
};

// DOT COLORS AND INTENSITY
const DOT_CONFIG = {
  baseIntensity: 0.25, // Higher base intensity for better edge visibility
  regionIntensityBoost: {
    healthy: 1.0, // Don't darken healthy region
    disease: 0.85 // Darken disease regions for better contrast
  },
  flashlightRegionBoost: {
    withRegion: 1.6,
    withoutRegion: 1.2
  },
  drugIlluminationBoost: {
    withRegion: 1.8,
    withoutRegion: 1.3
  },
  saturationMultiplier: 1.6, // Higher saturation + darker dots
  backgroundBlend: {
    r: 240, // Darker background blend
    g: 240,
    b: 240
  },
  dotRadius: 0.8,
  globalNoiseIntensity: 0.08,
  edgeFadeIntensity: 0.01,
  edgeFadePower: 2.5
};

// DRUG ILLUMINATION GOLDEN TINT
const DRUG_ILLUMINATION_CONFIG = {
  goldTintIntensity: 0.8,
  goldR: 200,
  goldG: 180,
  goldBReduction: 0.3
};

// ARROW STYLING
const ARROW_CONFIG = {
  // Region arrows (disease progression/homeostasis)
  region: {
    baseOpacity: 0.4, // Always visible base opacity
    flashlightBoost: 0.6, // Additional opacity from flashlight
    minVisibilityBoost: 0.3, // Ensure minimum visibility
    lineWidth: 0.8,
    headLength: 3,
    headAngle: Math.PI / 5,
    arrowLength: 30
  },
  // Drug arrows (therapeutic vectors)
  drug: {
    glowLineWidth: 4,
    mainLineWidth: 3.3,
    headLength: 12,
    headAngle: Math.PI / 4,
    lineCap: 'round' as const,
    glowColor: '#fbbf24',
    mainColor: '#f59e0b',
    baseOpacity: 0.7
  }
};

// DRUG LABEL STYLING
const DRUG_LABEL_CONFIG = {
  fontSize: 9,
  fontFamily: 'ui-serif, Georgia, serif',
  fontWeight: '200',
  textAlign: 'center' as const,
  textBaseline: 'middle' as const,
  backgroundColor: 'rgba(255, 248, 220, 0.95)', // Slightly more opaque
  borderColor: 'rgba(245, 158, 11, 0.4)', // Slightly more visible border
  textColor: '#92400e', // Dark yellow/brown text
  borderWidth: 1,
  padding: {
    horizontal: 3,
    vertical: 2
  },
  offsetDistance: 20, // Increased distance from arrow
  zIndexPriority: true // Draw last for top z-index
};

// DRUG TOOLTIP STYLING
const DRUG_TOOLTIP_CONFIG = {
  backgroundColor: 'bg-yellow-50/95',
  backdropBlur: 'backdrop-blur-sm',
  borderColor: 'border-yellow-200',
  titleColor: 'text-yellow-800',
  mechanismColor: 'text-yellow-700',
  scoreColor: 'text-yellow-600',
  offset: { x: 15, y: -10 }
};

// FLASHLIGHT EFFECT
const FLASHLIGHT_CONFIG = {
  radius: 120,
  intensityPower: 0.7,
  intensityBoost: 0.5
};

// DRUG ANIMATION TIMING - Smooth raindrop effect
const DRUG_ANIMATION_CONFIG = {
  totalDuration: 8000,
  candidateCount: 120,
  spawnInterval: 30, // Spawn new candidates every 30ms initially
  spawnAcceleration: 1.15, // Exponentially increase spawn interval
  maxSpawnInterval: 300, // Maximum time between spawns
  fadeInDuration: 400,
  fadeOutDuration: 600,
  eliminationWaves: [
    { time: 2000, keepTop: 50 },
    { time: 3500, keepTop: 25 },
    { time: 5000, keepTop: 15 },
    { time: 6500, keepTop: 10 }
  ],
  motionDamping: 0.95, // Smooth motion
  illuminationGrowthRate: 0.02
};

// UMAP POINT CLOUD GENERATION
const POINT_CLOUD_CONFIG = {
  spacing: 8, // Denser for smaller canvas
  worldScale: 4, // World coordinate scaling
  organicNoise: {
    healthy: {
      x: { freq1: 4, amp1: 0.15, freq2: 3.2, amp2: 0.12 },
      y: { freq1: 3.8, amp1: 0.13, freq2: 4.1, amp2: 0.11 }
    },
    disease: {
      x: { freq1: 5, amp1: 0.08, freq2: 4.5, amp2: 0.06 },
      y: { freq1: 4.2, amp1: 0.07, freq2: 5.3, amp2: 0.09 }
    }
  },
  heterogeneity: {
    intensity: 0.12,
    frequencies: { x: 6, y: 5.5, combined: 3.2 }
  },
  falloffPower: {
    healthy: 1.0,
    disease: 0.6
  },
  intensityBoost: {
    healthy: 0.95,
    disease: 0.75
  },
  internalNoise: {
    healthy: { intensity: 0.08, freqX: 8, freqY: 7 },
    disease: { minIntensity: 0.01, maxIntensity: 1.0 }
  }
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Point {
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
  baseIntensity: number;
  region: string | null;
  centerDistance: number;
}

interface DrugCandidate {
  id: number;
  drugName: string;
  mechanism: string;
  startScreenX: number;
  startScreenY: number;
  endScreenX: number;
  endScreenY: number;
  therapeuticScore: number;
  spawnTime: number;
  opacity: number;
  targetOpacity: number;
  scale: number;
  glowIntensity: number;
  illuminationRadius: number;
  targetIlluminationRadius: number;
  eliminated: boolean;
  eliminatedTime?: number;
  labelBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface DrugAnimationState {
  isRunning: boolean;
  startTime: number;
  duration: number;
  drugCandidates: DrugCandidate[];
  nextSpawnIndex: number;
  currentSpawnInterval: number;
  lastSpawnTime: number;
}

interface ZebrafishEmbeddingVisualizationProps {
  width?: number;
  height?: number;
}

// ============================================================================
// DISEASE MODEL DEFINITIONS - Based on actual GSE datasets
// ============================================================================

// Define the healthy region and multiple disease lobes
const HEALTHY_REGION = {
  center: [-1.3, 0.2],
  baseRadius: 0.8,
  label: 'Healthy',
  color: '#059669',
  description: 'Normal zebrafish melanocytes'
};

const DISEASE_LOBES = [
  {
    center: [1.4, -0.6],
    baseRadius: 0.9,
    elongation: { angle: Math.PI * 0.3, ratio: 1.6 },
    label: 'ZMEL1-INV',
    color: '#dc2626',
    description: 'ZMEL1 invasive metastatic progression (GSE152998)',
    shortDesc: 'Metastatic invasion & progression model',
    gseId: 'GSE152998',
    id: 'zmel1_inv'
  },
  {
    center: [0.8, 1.2],
    baseRadius: 0.7,
    elongation: { angle: Math.PI * 1.1, ratio: 1.4 },
    label: 'MITF-low',
    color: '#b91c1c',
    description: 'MITF-low resistance model (GSE136900)',
    shortDesc: 'MAPK inhibitor resistance states',
    gseId: 'GSE136900',
    id: 'mitf_low'
  },
  {
    center: [2.0, 0.4],
    baseRadius: 0.6,
    elongation: { angle: Math.PI * 0.8, ratio: 1.3 },
    label: 'Mucosal',
    color: '#ef4444',
    description: 'CCND1/PTEN/TP53 mucosal melanoma (GSE270464)',
    shortDesc: 'Non-MAPK mucosal melanomas',
    gseId: 'GSE270464',
    id: 'mucosal'
  },
  {
    center: [0.3, -1.5],
    baseRadius: 0.5,
    elongation: { angle: Math.PI * 1.7, ratio: 1.2 },
    label: 'Spatial TME',
    color: '#f87171',
    description: 'BRAFV600E spatial transcriptomics (GSE159709)',
    shortDesc: 'Tumor-host interface mapping',
    gseId: 'GSE159709',
    id: 'spatial_tme'
  },
  {
    center: [1.8, 1.8],
    baseRadius: 0.4,
    elongation: { angle: Math.PI * 0.1, ratio: 1.1 },
    label: 'ZMEL1-PRO',
    color: '#fca5a5',
    description: 'ZMEL1 proliferative state (GSE152998)',
    shortDesc: 'Highly proliferative phenotype',
    gseId: 'GSE152998',
    id: 'zmel1_pro'
  },
];

// ============================================================================
// MAIN VISUALIZATION COMPONENT
// ============================================================================

// Generate organic, UMAP-like point distributions
const generateUMAPStylePointCloud = (
  viewportWidth: number,
  viewportHeight: number
): Point[] => {
  const points = [] as Point[];
  const cols = Math.ceil(viewportWidth / POINT_CLOUD_CONFIG.spacing);
  const rows = Math.ceil(viewportHeight / POINT_CLOUD_CONFIG.spacing);
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const screenX = col * POINT_CLOUD_CONFIG.spacing;
      const screenY = row * POINT_CLOUD_CONFIG.spacing;
      
      // Convert to world coordinates
      const worldX = ((screenX - viewportWidth / 2) / Math.min(viewportWidth, viewportHeight)) * POINT_CLOUD_CONFIG.worldScale;
      const worldY = ((screenY - viewportHeight / 2) / Math.min(viewportWidth, viewportHeight)) * POINT_CLOUD_CONFIG.worldScale;
      
      // Edge fading
      const centerDistance = Math.sqrt(worldX * worldX + worldY * worldY);
      const edgeFade = Math.max(DOT_CONFIG.edgeFadeIntensity, Math.min(1, 1 - Math.pow(centerDistance / 3, DOT_CONFIG.edgeFadePower)));
      
      let maxIntensity = DOT_CONFIG.baseIntensity;
      let assignedRegion = null;
      
      // Check healthy region with organic shape
      const healthyDist = Math.sqrt(
        (worldX - HEALTHY_REGION.center[0]) ** 2 + 
        (worldY - HEALTHY_REGION.center[1]) ** 2
      );
      
      if (healthyDist < HEALTHY_REGION.baseRadius * 1.3) {
        const noiseX = Math.sin(worldX * POINT_CLOUD_CONFIG.organicNoise.healthy.x.freq1) * POINT_CLOUD_CONFIG.organicNoise.healthy.x.amp1 + 
                      Math.cos(worldY * POINT_CLOUD_CONFIG.organicNoise.healthy.x.freq2) * POINT_CLOUD_CONFIG.organicNoise.healthy.x.amp2;
        const noiseY = Math.cos(worldX * POINT_CLOUD_CONFIG.organicNoise.healthy.y.freq1) * POINT_CLOUD_CONFIG.organicNoise.healthy.y.amp1 + 
                      Math.sin(worldY * POINT_CLOUD_CONFIG.organicNoise.healthy.y.freq2) * POINT_CLOUD_CONFIG.organicNoise.healthy.y.amp2;
        const organicDist = Math.sqrt(
          (worldX - HEALTHY_REGION.center[0] + noiseX) ** 2 + 
          (worldY - HEALTHY_REGION.center[1] + noiseY) ** 2
        );
        
        if (organicDist < HEALTHY_REGION.baseRadius) {
          const falloff = Math.max(0, 1 - (organicDist / HEALTHY_REGION.baseRadius));
          const intensity = POINT_CLOUD_CONFIG.intensityBoost.healthy * Math.pow(falloff, POINT_CLOUD_CONFIG.falloffPower.healthy);
          const internalNoise = POINT_CLOUD_CONFIG.internalNoise.healthy.intensity * 
                               (Math.sin(worldX * POINT_CLOUD_CONFIG.internalNoise.healthy.freqX) + 
                                Math.cos(worldY * POINT_CLOUD_CONFIG.internalNoise.healthy.freqY));
          const finalIntensity = intensity + internalNoise;
          
          if (finalIntensity > maxIntensity) {
            maxIntensity = finalIntensity;
            assignedRegion = 'healthy';
          }
        }
      }
      
      // Check disease lobes with organic elongated shapes
      DISEASE_LOBES.forEach((lobe) => {
        const dx = worldX - lobe.center[0];
        const dy = worldY - lobe.center[1];
        
        const cos_theta = Math.cos(lobe.elongation.angle);
        const sin_theta = Math.sin(lobe.elongation.angle);
        const rotated_x = dx * cos_theta + dy * sin_theta;
        const rotated_y = -dx * sin_theta + dy * cos_theta;
        
        const organicNoiseX = Math.sin(worldX * POINT_CLOUD_CONFIG.organicNoise.disease.x.freq1 + lobe.center[0]) * POINT_CLOUD_CONFIG.organicNoise.disease.x.amp1 + 
                             Math.cos(worldY * POINT_CLOUD_CONFIG.organicNoise.disease.x.freq2) * POINT_CLOUD_CONFIG.organicNoise.disease.x.amp2;
        const organicNoiseY = Math.cos(worldX * POINT_CLOUD_CONFIG.organicNoise.disease.y.freq1) * POINT_CLOUD_CONFIG.organicNoise.disease.y.amp1 + 
                             Math.sin(worldY * POINT_CLOUD_CONFIG.organicNoise.disease.y.freq2 + lobe.center[1]) * POINT_CLOUD_CONFIG.organicNoise.disease.y.amp2;
        
        const ellipse_dist = Math.sqrt(
          Math.pow((rotated_x + organicNoiseX) / lobe.baseRadius, 2) + 
          Math.pow((rotated_y + organicNoiseY) / (lobe.baseRadius / lobe.elongation.ratio), 2)
        );
        
        if (ellipse_dist < 1.1) {
          const falloff = Math.max(0, 1 - ellipse_dist);
          const heterogeneity = POINT_CLOUD_CONFIG.heterogeneity.intensity * (
            Math.sin(worldX * POINT_CLOUD_CONFIG.heterogeneity.frequencies.x + lobe.center[0] * 10) + 
            Math.cos(worldY * POINT_CLOUD_CONFIG.heterogeneity.frequencies.y + lobe.center[1] * 8) +
            Math.sin((worldX + worldY) * POINT_CLOUD_CONFIG.heterogeneity.frequencies.combined)
          );
          
          const baseIntensity = POINT_CLOUD_CONFIG.intensityBoost.disease + heterogeneity;
          const intensity = baseIntensity * Math.pow(falloff, POINT_CLOUD_CONFIG.falloffPower.disease);
          
          if (intensity > maxIntensity) {
            maxIntensity = intensity;
            assignedRegion = lobe.id;
          }
        }
      });
      
      const globalNoise = (Math.random() - 0.5) * DOT_CONFIG.globalNoiseIntensity;
      const finalIntensity = Math.max(POINT_CLOUD_CONFIG.internalNoise.disease.minIntensity, 
                                     Math.min(POINT_CLOUD_CONFIG.internalNoise.disease.maxIntensity, maxIntensity + globalNoise)) * edgeFade;
      
      points.push({
        screenX,
        screenY,
        worldX,
        worldY,
        baseIntensity: finalIntensity,
        region: assignedRegion,
        centerDistance
      });
    }
  }
  
  return points;
};

const ZebrafishEmbeddingVisualization = ({ width = 600, height = 500 }: ZebrafishEmbeddingVisualizationProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const drugAnimationRef = useRef<number | null>(null);
  
  // Explicit typing for all state variables with type assertions
  const [points, setPoints] = useState([] as Point[]);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 } as {x: number; y: number});
  const [hoveredDrug, setHoveredDrug] = useState(null as DrugCandidate | null);
  const [flashlightRadius] = useState(FLASHLIGHT_CONFIG.radius as number);
  const [drugAnimation, setDrugAnimation] = useState({
    isRunning: false,
    startTime: 0,
    duration: DRUG_ANIMATION_CONFIG.totalDuration,
    drugCandidates: [] as DrugCandidate[],
    nextSpawnIndex: 0,
    currentSpawnInterval: DRUG_ANIMATION_CONFIG.spawnInterval,
    lastSpawnTime: 0
  } as DrugAnimationState);

  useEffect(() => {
    const newPoints = generateUMAPStylePointCloud(width, height) as Point[];
    setPoints(newPoints);
  }, [width, height]);

  // Generate drug candidate vectors
  const generateDrugCandidates = useCallback((count: number): DrugCandidate[] => {
    const candidates: DrugCandidate[] = [];
    
    for (let i = 0; i < count; i++) {
      const startWorldX = (Math.random() - 0.5) * POINT_CLOUD_CONFIG.worldScale;
      const startWorldY = (Math.random() - 0.5) * POINT_CLOUD_CONFIG.worldScale;
      
      const angle = Math.random() * Math.PI * 2;
      const length = 0.3 + Math.random() * 0.4;
      
      const endWorldX = startWorldX + Math.cos(angle) * length;
      const endWorldY = startWorldY + Math.sin(angle) * length;
      
      const startScreenX = width / 2 + startWorldX * Math.min(width, height) / POINT_CLOUD_CONFIG.worldScale;
      const startScreenY = height / 2 + startWorldY * Math.min(width, height) / POINT_CLOUD_CONFIG.worldScale;
      const endScreenX = width / 2 + endWorldX * Math.min(width, height) / POINT_CLOUD_CONFIG.worldScale;
      const endScreenY = height / 2 + endWorldY * Math.min(width, height) / POINT_CLOUD_CONFIG.worldScale;
      
      const vectorX = endWorldX - startWorldX;
      const vectorY = endWorldY - startWorldY;
      
      const toHealthyX = HEALTHY_REGION.center[0] - startWorldX;
      const toHealthyY = HEALTHY_REGION.center[1] - startWorldY;
      const toHealthyLength = Math.sqrt(toHealthyX ** 2 + toHealthyY ** 2);
      
      const vectorLength = Math.sqrt(vectorX ** 2 + vectorY ** 2);
      const dotProduct = toHealthyLength > 0 && vectorLength > 0 ? 
        (vectorX * toHealthyX + vectorY * toHealthyY) / (vectorLength * toHealthyLength) : 0;
      
      // Bonus for starting in disease regions
      let regionBonus = 0;
      let inDiseaseRegion = false;
      DISEASE_LOBES.forEach((lobe) => {
        const distToLobe = Math.sqrt(
          (startWorldX - lobe.center[0]) ** 2 + (startWorldY - lobe.center[1]) ** 2
        );
        if (distToLobe < lobe.baseRadius) {
          regionBonus += 0.2;
          inDiseaseRegion = true;
        }
      });
      
      // Additional bonus for ending closer to healthy region
      const endDistToHealthy = Math.sqrt(
        (endWorldX - HEALTHY_REGION.center[0]) ** 2 + (endWorldY - HEALTHY_REGION.center[1]) ** 2
      );
      const proximityBonus = Math.max(0, 1 - endDistToHealthy / 2) * 0.3;
      
      // Penalty for vectors that don't start in disease regions
      const diseaseRequirement = inDiseaseRegion ? 1 : 0.5;
      
      const finalScore = (dotProduct * 0.5 + regionBonus + proximityBonus + Math.random() * 0.1) * diseaseRequirement;
      
      // Generate drug names and mechanisms - more realistic for melanoma
      const drugNames = [
        'Trametinib', 'Dabrafenib', 'Vemurafenib', 'Cobimetinib', 'Binimetinib',
        'Selumetinib', 'Encorafenib', 'Atezolizumab', 'Pembrolizumab', 'Nivolumab',
        'Ipilimumab', 'Talimogene', 'Imatinib', 'Nilotinib', 'Dasatinib',
        'Tebentafusp', 'Imiquimod', 'Aldesleukin', 'Interferon-α', 'Temozolomide',
        'Dacarbazine', 'Carmustine', 'Fotemustine', 'Cisplatin', 'Carboplatin',
        'Paclitaxel', 'Docetaxel', 'Vincristine', 'Vinblastine', 'Melphalan',
        'Relatlimab', 'Toripalimab', 'Cemiplimab', 'Avelumab', 'Durvalumab',
        'Tremelimumab', 'Dostarlimab', 'Retifanlimab', 'Prolgolimab', 'Sintilimab'
      ];
      
      const mechanisms = [
        'MEK inhibition', 'BRAF V600E inhibition', 'PI3K/AKT pathway', 'mTOR signaling',
        'PD-1 checkpoint', 'PD-L1 blockade', 'CTLA-4 inhibition', 'Oncolytic therapy',
        'c-KIT inhibition', 'Immune activation', 'DNA alkylation', 'Microtubule disruption',
        'Apoptosis induction', 'Angiogenesis inhibition', 'Cell cycle arrest',
        'LAG-3 blockade', 'TIM-3 inhibition', 'TIGIT blockade', 'NK cell activation'
      ];
      
      const drugName = drugNames[i % drugNames.length];
      const mechanism = mechanisms[Math.floor(Math.random() * mechanisms.length)];
      
      candidates.push({
        id: i,
        drugName,
        mechanism,
        startScreenX, startScreenY, endScreenX, endScreenY,
        therapeuticScore: finalScore,
        spawnTime: 0, // Will be set dynamically during animation
        opacity: 0,
        targetOpacity: 0,
        scale: 0.6 + Math.random() * 0.4,
        glowIntensity: 0.5 + Math.random() * 0.5,
        illuminationRadius: 0,
        targetIlluminationRadius: 60 + Math.random() * 30,
        eliminated: false
      });
    }
    
    return candidates.sort((a, b) => b.therapeuticScore - a.therapeuticScore);
  }, [width, height]);

  // Drug animation effect - smooth raindrop style
  useEffect(() => {
    if (!drugAnimation.isRunning) return;

    const updateDrugAnimation = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - drugAnimation.startTime;
      const progress = Math.min(1, elapsed / drugAnimation.duration);
      
      // Update spawn interval (gets slower over time)
      let currentSpawnInterval = drugAnimation.currentSpawnInterval;
      if (elapsed > 1000) {
        currentSpawnInterval = Math.min(
          DRUG_ANIMATION_CONFIG.maxSpawnInterval,
          DRUG_ANIMATION_CONFIG.spawnInterval * Math.pow(DRUG_ANIMATION_CONFIG.spawnAcceleration, elapsed / 1000)
        );
      }
      
      // Spawn new candidates
      let nextSpawnIndex = drugAnimation.nextSpawnIndex;
      let lastSpawnTime = drugAnimation.lastSpawnTime;
      const updatedCandidates = [...drugAnimation.drugCandidates];
      
      if (nextSpawnIndex < DRUG_ANIMATION_CONFIG.candidateCount && 
          currentTime - lastSpawnTime > currentSpawnInterval) {
        const candidate = updatedCandidates[nextSpawnIndex];
        candidate.spawnTime = currentTime;
        candidate.targetOpacity = ARROW_CONFIG.drug.baseOpacity;
        nextSpawnIndex++;
        lastSpawnTime = currentTime;
      }
      
      // Check elimination waves
      const activeNonEliminated = updatedCandidates.filter(c => !c.eliminated && c.spawnTime > 0);
      DRUG_ANIMATION_CONFIG.eliminationWaves.forEach(wave => {
        if (elapsed > wave.time && activeNonEliminated.length > wave.keepTop) {
          const toEliminate = activeNonEliminated.slice(wave.keepTop);
          toEliminate.forEach(candidate => {
            if (!candidate.eliminated) {
              candidate.eliminated = true;
              candidate.eliminatedTime = currentTime;
              candidate.targetOpacity = 0;
              candidate.targetIlluminationRadius = 0;
            }
          });
        }
      });
      
      // Update individual candidates with smooth transitions
      const finalCandidates = updatedCandidates.map((candidate: DrugCandidate) => {
        if (candidate.spawnTime === 0) return candidate;
        
        const age = currentTime - candidate.spawnTime;
        
        // Smooth opacity transitions
        const opacityDiff = candidate.targetOpacity - candidate.opacity;
        candidate.opacity += opacityDiff * 0.1;
        
        // Smooth illumination radius growth
        if (!candidate.eliminated && candidate.illuminationRadius < candidate.targetIlluminationRadius) {
          candidate.illuminationRadius = Math.min(
            candidate.targetIlluminationRadius,
            candidate.illuminationRadius + (candidate.targetIlluminationRadius * DRUG_ANIMATION_CONFIG.illuminationGrowthRate)
          );
        } else if (candidate.eliminated) {
          const radiusDiff = candidate.targetIlluminationRadius - candidate.illuminationRadius;
          candidate.illuminationRadius += radiusDiff * 0.1;
        }
        
        return candidate;
      });
      
      setDrugAnimation(prev => ({
        ...prev,
        drugCandidates: finalCandidates,
        nextSpawnIndex,
        currentSpawnInterval,
        lastSpawnTime
      }));
      
      if (progress < 1 || finalCandidates.some(c => Math.abs(c.opacity - c.targetOpacity) > 0.01)) {
        drugAnimationRef.current = requestAnimationFrame(updateDrugAnimation);
      } else {
        // Animation complete - keep only top candidates
        const survivors: DrugCandidate[] = finalCandidates
          .filter((c: DrugCandidate) => !c.eliminated)
          .slice(0, DRUG_ANIMATION_CONFIG.eliminationWaves[DRUG_ANIMATION_CONFIG.eliminationWaves.length - 1].keepTop)
          .map((c: DrugCandidate) => ({ 
            ...c, 
            opacity: ARROW_CONFIG.drug.baseOpacity,
            targetOpacity: ARROW_CONFIG.drug.baseOpacity,
            illuminationRadius: c.targetIlluminationRadius,
            eliminated: false 
          }));
        
        setDrugAnimation(prev => ({
          ...prev,
          isRunning: false,
          drugCandidates: survivors
        }));
      }
    };
    
    drugAnimationRef.current = requestAnimationFrame(updateDrugAnimation);
    
    return () => {
      if (drugAnimationRef.current) {
        cancelAnimationFrame(drugAnimationRef.current);
      }
    };
  }, [drugAnimation]);

  const startDrugRanking = useCallback(() => {
    const candidates: DrugCandidate[] = generateDrugCandidates(DRUG_ANIMATION_CONFIG.candidateCount);
    
    setDrugAnimation({
      isRunning: true,
      startTime: Date.now(),
      duration: DRUG_ANIMATION_CONFIG.totalDuration,
      drugCandidates: candidates,
      nextSpawnIndex: 0,
      currentSpawnInterval: DRUG_ANIMATION_CONFIG.spawnInterval,
      lastSpawnTime: 0
    });
  }, [generateDrugCandidates]);
  
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate drug illumination
    const drugIllumination = new Map<number, number>();
    const visibleCandidates = drugAnimation.drugCandidates.filter((c: DrugCandidate) => c.opacity > 0.01);

    visibleCandidates.forEach((candidate: DrugCandidate) => {
      if (candidate.illuminationRadius <= 0) return;
      
      for (let t = 0; t <= 1; t += 0.1) {
        const illuminationX = candidate.startScreenX + t * (candidate.endScreenX - candidate.startScreenX);
        const illuminationY = candidate.startScreenY + t * (candidate.endScreenY - candidate.startScreenY);
        
        points.forEach((point: Point, index: number) => {
          const distToIllumination = Math.sqrt(
            (point.screenX - illuminationX) ** 2 + 
            (point.screenY - illuminationY) ** 2
          );
          
          if (distToIllumination < candidate.illuminationRadius) {
            const illuminationIntensity = Math.max(0, 1 - (distToIllumination / candidate.illuminationRadius));
            const smoothIntensity = Math.pow(illuminationIntensity, 0.6) * candidate.opacity * candidate.glowIntensity;
            
            const currentIllumination = drugIllumination.get(index) || 0;
            drugIllumination.set(index, Math.max(currentIllumination, smoothIntensity));
          }
        });
      }
    });
    
    // Draw points
    points.forEach((point: Point, index: number) => {
      const distanceToMouse = Math.sqrt(
        (point.screenX - mousePosition.x) ** 2 + 
        (point.screenY - mousePosition.y) ** 2
      );
      
      const flashlightIntensity = Math.max(0, 1 - (distanceToMouse / flashlightRadius));
      const smoothFlashlight = Math.pow(flashlightIntensity, FLASHLIGHT_CONFIG.intensityPower);
      const drugIlluminationIntensity = drugIllumination.get(index) || 0;
      
      let intensity = point.baseIntensity;
      
      if (smoothFlashlight > 0) {
        const regionBoost = point.region ? DOT_CONFIG.flashlightRegionBoost.withRegion : DOT_CONFIG.flashlightRegionBoost.withoutRegion;
        intensity = Math.min(1, intensity + (smoothFlashlight * FLASHLIGHT_CONFIG.intensityBoost * regionBoost));
      }
      
      if (drugIlluminationIntensity > 0) {
        const drugBoost = point.region ? DOT_CONFIG.drugIlluminationBoost.withRegion : DOT_CONFIG.drugIlluminationBoost.withoutRegion;
        intensity = Math.min(1, intensity + (drugIlluminationIntensity * 0.6 * drugBoost));
      }
      
      // Get region color
      let pointColor = '#666666';
      if (point.region === 'healthy') {
        pointColor = HEALTHY_REGION.color;
      } else if (point.region) {
        const lobe = DISEASE_LOBES.find(l => l.id === point.region);
        if (lobe) pointColor = lobe.color;
      }
      
      // Convert hex to RGB and enhance saturation
      const hex = pointColor.replace('#', '');
      let r = parseInt(hex.substr(0, 2), 16);
      let g = parseInt(hex.substr(2, 2), 16);
      let b = parseInt(hex.substr(4, 2), 16);
      
      // Apply region intensity boosts
      if (point.region) {
        if (point.region === 'healthy') {
          r = Math.floor(r * DOT_CONFIG.regionIntensityBoost.healthy);
          g = Math.floor(g * DOT_CONFIG.regionIntensityBoost.healthy);
          b = Math.floor(b * DOT_CONFIG.regionIntensityBoost.healthy);
        } else {
          r = Math.floor(r * DOT_CONFIG.regionIntensityBoost.disease);
          g = Math.floor(g * DOT_CONFIG.regionIntensityBoost.disease);
          b = Math.floor(b * DOT_CONFIG.regionIntensityBoost.disease);
        }
      }
      
      // Add golden tint for drug illumination
      let finalR = r, finalG = g, finalB = b;
      if (drugIlluminationIntensity > 0) {
        const goldTint = drugIlluminationIntensity * DRUG_ILLUMINATION_CONFIG.goldTintIntensity;
        finalR = Math.min(255, r + goldTint * DRUG_ILLUMINATION_CONFIG.goldR);
        finalG = Math.min(255, g + goldTint * DRUG_ILLUMINATION_CONFIG.goldG);
        finalB = Math.max(0, b * (1 - goldTint * DRUG_ILLUMINATION_CONFIG.goldBReduction));
      }
      
      const blendFactor = intensity * DOT_CONFIG.saturationMultiplier;
      const blendedR = Math.floor(finalR * blendFactor + DOT_CONFIG.backgroundBlend.r * (1 - blendFactor));
      const blendedG = Math.floor(finalG * blendFactor + DOT_CONFIG.backgroundBlend.g * (1 - blendFactor));
      const blendedB = Math.floor(finalB * blendFactor + DOT_CONFIG.backgroundBlend.b * (1 - blendFactor));
      
      ctx.fillStyle = `rgb(${blendedR}, ${blendedG}, ${blendedB})`;
      ctx.beginPath();
      ctx.arc(point.screenX, point.screenY, DOT_CONFIG.dotRadius, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    // Draw region arrows first (so they appear under drug arrows)
    points.forEach((point: Point) => {
      if (!point.region) return;
      
      const distanceToMouse = Math.sqrt(
        (point.screenX - mousePosition.x) ** 2 + 
        (point.screenY - mousePosition.y) ** 2
      );
      
      const flashlightIntensity = Math.max(0, 1 - (distanceToMouse / flashlightRadius));
      const arrowOpacity = Math.min(1, ARROW_CONFIG.region.baseOpacity + flashlightIntensity * ARROW_CONFIG.region.flashlightBoost);
      
      if (arrowOpacity > 0.1) {
        let dx, dy, arrowColor;
        
        if (point.region === 'healthy') {
          // Healthy arrows point inward toward healthy center (homeostasis)
          dx = HEALTHY_REGION.center[0] - point.worldX;
          dy = HEALTHY_REGION.center[1] - point.worldY;
          arrowColor = HEALTHY_REGION.color;
        } else {
          // Disease arrows point away from healthy center (disease progression)
          dx = point.worldX - HEALTHY_REGION.center[0];
          dy = point.worldY - HEALTHY_REGION.center[1];
          const lobe = DISEASE_LOBES.find(l => l.id === point.region);
          if (!lobe) return;
          arrowColor = lobe.color;
        }
        
        const angle = Math.atan2(dy, dx);
        const arrowLength = ARROW_CONFIG.region.arrowLength * Math.min(1, arrowOpacity + ARROW_CONFIG.region.minVisibilityBoost);
        const arrowEndX = point.screenX + Math.cos(angle) * arrowLength;
        const arrowEndY = point.screenY + Math.sin(angle) * arrowLength;
        
        const alpha = Math.floor(arrowOpacity * 255).toString(16).padStart(2, '0');
        ctx.strokeStyle = arrowColor + alpha;
        ctx.fillStyle = arrowColor + alpha;
        ctx.lineWidth = ARROW_CONFIG.region.lineWidth;
        
        ctx.beginPath();
        ctx.moveTo(point.screenX, point.screenY);
        ctx.lineTo(arrowEndX, arrowEndY);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(arrowEndX, arrowEndY);
        ctx.lineTo(
          arrowEndX - ARROW_CONFIG.region.headLength * Math.cos(angle - ARROW_CONFIG.region.headAngle),
          arrowEndY - ARROW_CONFIG.region.headLength * Math.sin(angle - ARROW_CONFIG.region.headAngle)
        );
        ctx.moveTo(arrowEndX, arrowEndY);
        ctx.lineTo(
          arrowEndX - ARROW_CONFIG.region.headLength * Math.cos(angle + ARROW_CONFIG.region.headAngle),
          arrowEndY - ARROW_CONFIG.region.headLength * Math.sin(angle + ARROW_CONFIG.region.headAngle)
        );
        ctx.stroke();
      }
    });
    
    // Draw permanent region labels (under drug arrows)
    const fontSize = width < 400 ? REGION_LABEL_CONFIG.fontSize.mobile : REGION_LABEL_CONFIG.fontSize.desktop;
    ctx.font = `${REGION_LABEL_CONFIG.fontWeight} ${fontSize}px ${REGION_LABEL_CONFIG.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Healthy label
    const healthyScreenX = width / 2 + HEALTHY_REGION.center[0] * Math.min(width, height) / POINT_CLOUD_CONFIG.worldScale;
    const healthyScreenY = height / 2 + HEALTHY_REGION.center[1] * Math.min(width, height) / POINT_CLOUD_CONFIG.worldScale;
    
    ctx.fillStyle = REGION_LABEL_CONFIG.textColor;
    ctx.strokeStyle = REGION_LABEL_CONFIG.strokeColor;
    ctx.lineWidth = REGION_LABEL_CONFIG.strokeWidth;
    ctx.strokeText(HEALTHY_REGION.label, healthyScreenX, healthyScreenY);
    ctx.fillText(HEALTHY_REGION.label, healthyScreenX, healthyScreenY);
    
    // Disease lobe labels
    DISEASE_LOBES.forEach((lobe) => {
      const lobeScreenX = width / 2 + lobe.center[0] * Math.min(width, height) / POINT_CLOUD_CONFIG.worldScale;
      const lobeScreenY = height / 2 + lobe.center[1] * Math.min(width, height) / POINT_CLOUD_CONFIG.worldScale;
      
      ctx.fillStyle = REGION_LABEL_CONFIG.textColor;
      ctx.strokeStyle = REGION_LABEL_CONFIG.strokeColor;
      ctx.lineWidth = REGION_LABEL_CONFIG.strokeWidth;
      ctx.strokeText(lobe.label, lobeScreenX, lobeScreenY);
      ctx.fillText(lobe.label, lobeScreenX, lobeScreenY);
    });
    
    // Draw drug candidate arrows
    visibleCandidates.forEach((candidate: DrugCandidate) => {
      const alpha = Math.floor(candidate.opacity * 255).toString(16).padStart(2, '0');
      
      // Glow effect
      if (candidate.opacity > 0.3) {
        const glowAlpha = Math.floor(candidate.opacity * 40).toString(16).padStart(2, '0');
        ctx.strokeStyle = ARROW_CONFIG.drug.glowColor + glowAlpha;
        ctx.lineWidth = ARROW_CONFIG.drug.glowLineWidth * candidate.scale;
        ctx.lineCap = ARROW_CONFIG.drug.lineCap;
        
        ctx.beginPath();
        ctx.moveTo(candidate.startScreenX, candidate.startScreenY);
        ctx.lineTo(candidate.endScreenX, candidate.endScreenY);
        ctx.stroke();
      }
      
      // Main arrow
      ctx.strokeStyle = ARROW_CONFIG.drug.mainColor + alpha;
      ctx.fillStyle = ARROW_CONFIG.drug.mainColor + alpha;
      ctx.lineWidth = ARROW_CONFIG.drug.mainLineWidth * candidate.scale;
      
      ctx.beginPath();
      ctx.moveTo(candidate.startScreenX, candidate.startScreenY);
      ctx.lineTo(candidate.endScreenX, candidate.endScreenY);
      ctx.stroke();
      
      // Arrowhead
      const angle = Math.atan2(
        candidate.endScreenY - candidate.startScreenY,
        candidate.endScreenX - candidate.startScreenX
      );
      const headLength = ARROW_CONFIG.drug.headLength * candidate.scale;
      
      ctx.beginPath();
      ctx.moveTo(candidate.endScreenX, candidate.endScreenY);
      ctx.lineTo(
        candidate.endScreenX - headLength * Math.cos(angle - ARROW_CONFIG.drug.headAngle),
        candidate.endScreenY - headLength * Math.sin(angle - ARROW_CONFIG.drug.headAngle)
      );
      ctx.lineTo(
        candidate.endScreenX - headLength * 0.6 * Math.cos(angle),
        candidate.endScreenY - headLength * 0.6 * Math.sin(angle)
      );
      ctx.lineTo(
        candidate.endScreenX - headLength * Math.cos(angle + ARROW_CONFIG.drug.headAngle),
        candidate.endScreenY - headLength * Math.sin(angle + ARROW_CONFIG.drug.headAngle)
      );
      ctx.closePath();
      ctx.fill();
    });
    
    // Draw drug labels LAST (highest z-index priority)
    const finalDrugs = drugAnimation.drugCandidates
      .filter((c: DrugCandidate) => !c.eliminated && c.opacity > 0.5)
      .slice(0, 10); // Always show top 10 if available
    
    if (DRUG_LABEL_CONFIG.zIndexPriority && finalDrugs.length > 0 && !drugAnimation.isRunning) {
      ctx.font = `${DRUG_LABEL_CONFIG.fontWeight} ${DRUG_LABEL_CONFIG.fontSize}px ${DRUG_LABEL_CONFIG.fontFamily}`;
      ctx.textAlign = DRUG_LABEL_CONFIG.textAlign;
      ctx.textBaseline = DRUG_LABEL_CONFIG.textBaseline;
      
      finalDrugs.forEach((drug: DrugCandidate, index: number) => {
        // Position label near the middle of the arrow
        const labelT = 0.5 + (index % 3) * 0.15; // Vary position along arrow to reduce overlap
        const labelX = drug.startScreenX + (drug.endScreenX - drug.startScreenX) * labelT;
        const labelY = drug.startScreenY + (drug.endScreenY - drug.startScreenY) * labelT;
        
        // Smart offset to avoid overlap and stay readable
        const angle = Math.atan2(drug.endScreenY - drug.startScreenY, drug.endScreenX - drug.startScreenX);
        const perpAngle = angle + Math.PI/2;
        
        // Alternate sides and distances for better distribution
        const sideMultiplier = (index % 2 === 0 ? 1 : -1);
        const distanceMultiplier = 1 + (index % 3) * 0.3;
        const offsetX = Math.cos(perpAngle) * DRUG_LABEL_CONFIG.offsetDistance * sideMultiplier * distanceMultiplier;
        const offsetY = Math.sin(perpAngle) * DRUG_LABEL_CONFIG.offsetDistance * sideMultiplier * distanceMultiplier;
        
        const finalLabelX = labelX + offsetX;
        const finalLabelY = labelY + offsetY;
        
        // Draw label background with proper padding
        const labelText = drug.drugName;
        const metrics = ctx.measureText(labelText);
        const labelWidth = metrics.width + DRUG_LABEL_CONFIG.padding.horizontal * 2;
        const labelHeight = DRUG_LABEL_CONFIG.fontSize + DRUG_LABEL_CONFIG.padding.vertical * 2;
        
        // Store label bounds for hover detection
        drug.labelBounds = {
          x: finalLabelX - labelWidth/2,
          y: finalLabelY - labelHeight/2,
          width: labelWidth,
          height: labelHeight
        };
        
        // Draw shadow for better visibility
        const glowPhase = (Date.now() % 2000) / 2000; // 2 second cycle
        const glowIntensity = 0.5 + Math.sin(glowPhase * Math.PI * 2) * 0.3;
        
        ctx.shadowColor = `rgba(245, 158, 11, ${glowIntensity})`;
        ctx.shadowBlur = 4 + glowIntensity * 4;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        ctx.fillStyle = DRUG_LABEL_CONFIG.backgroundColor;
        ctx.fillRect(finalLabelX - labelWidth/2, finalLabelY - labelHeight/2, labelWidth, labelHeight);
        
        // Reset shadow before drawing border
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        ctx.strokeStyle = DRUG_LABEL_CONFIG.borderColor;
        ctx.lineWidth = DRUG_LABEL_CONFIG.borderWidth;
        ctx.strokeRect(finalLabelX - labelWidth/2, finalLabelY - labelHeight/2, labelWidth, labelHeight);
        
        // Draw label text
        ctx.fillStyle = DRUG_LABEL_CONFIG.textColor;
        ctx.fillText(labelText, finalLabelX, finalLabelY);
      });
    }
    
  }, [points, mousePosition, flashlightRadius, drugAnimation.drugCandidates, drugAnimation.isRunning, width, height]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = width;
    canvas.height = height;
    
    const animate = () => {
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw, width, height]);

  const handleMouseMove = useCallback((e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setMousePosition({ x: mouseX, y: mouseY });

    // Check for drug hover (only for final surviving drugs)
    const finalDrugs = drugAnimation.drugCandidates.filter(
      (c: DrugCandidate) => !c.eliminated && c.opacity > 0.5 && !drugAnimation.isRunning
    ).slice(0, 10);

    let newHoveredDrug: DrugCandidate | null = null;
    let minDistance = Infinity;

    finalDrugs.forEach((drug: DrugCandidate) => {
      // First check if hovering over label
      if (drug.labelBounds) {
        if (mouseX >= drug.labelBounds.x && 
            mouseX <= drug.labelBounds.x + drug.labelBounds.width &&
            mouseY >= drug.labelBounds.y && 
            mouseY <= drug.labelBounds.y + drug.labelBounds.height) {
          newHoveredDrug = drug;
          return;
        }
      }
      
      // Then check if hovering over arrow line
      const dx = drug.endScreenX - drug.startScreenX;
      const dy = drug.endScreenY - drug.startScreenY;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length > 0) {
        const t = Math.max(
          0,
          Math.min(
            1,
            ((mouseX - drug.startScreenX) * dx +
              (mouseY - drug.startScreenY) * dy) /
              (length * length)
          )
        );
        const projX = drug.startScreenX + t * dx;
        const projY = drug.startScreenY + t * dy;
        const distance = Math.sqrt(
          (mouseX - projX) ** 2 + (mouseY - projY) ** 2
        );

        if (distance < 10 && distance < minDistance) {
          minDistance = distance;
          newHoveredDrug = drug;
        }
      }
    });

    setHoveredDrug(newHoveredDrug);
  }, [drugAnimation.drugCandidates, drugAnimation.isRunning]);

  
  const activeDrugCount = drugAnimation.drugCandidates.filter((c: DrugCandidate) => !c.eliminated && (drugAnimation.isRunning ? c.opacity > 0.01 : true)).length;
  const lastWave = DRUG_ANIMATION_CONFIG.eliminationWaves[DRUG_ANIMATION_CONFIG.eliminationWaves.length - 1];
  const currentWave = DRUG_ANIMATION_CONFIG.eliminationWaves.find(w => 
    Date.now() - drugAnimation.startTime < w.time
  ) || lastWave;
  
  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="border border-gray-200"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredDrug(null)}
        style={{ 
          width: `${width}px`, 
          height: `${height}px`,
          cursor: hoveredDrug ? 'pointer' : 'crosshair'
        }}
      />
      
      {/* Drug hover tooltip */}
      {hoveredDrug && (
        <div
          className="absolute pointer-events-none z-10 transition-all duration-200 ease-out"
          style={{
            left: mousePosition.x + DRUG_TOOLTIP_CONFIG.offset.x,
            top: mousePosition.y + DRUG_TOOLTIP_CONFIG.offset.y,
          }}
        >
          <div className={`${DRUG_TOOLTIP_CONFIG.backgroundColor} ${DRUG_TOOLTIP_CONFIG.backdropBlur} border ${DRUG_TOOLTIP_CONFIG.borderColor} rounded-sm px-3 py-2 shadow-lg max-w-xs`}>
            <div className="flex items-center justify-between mb-1">
              <div className={`text-sm font-medium ${DRUG_TOOLTIP_CONFIG.titleColor}`}>
                {hoveredDrug.drugName}
              </div>
              <div className="text-xs text-yellow-600 font-medium">
                Rank #{drugAnimation.drugCandidates.filter(c => !c.eliminated).findIndex(c => c.id === hoveredDrug.id) + 1}
              </div>
            </div>
            <div className={`text-xs ${DRUG_TOOLTIP_CONFIG.mechanismColor} mb-1`}>
              Mechanism: {hoveredDrug.mechanism}
            </div>
            <div className={`text-xs ${DRUG_TOOLTIP_CONFIG.scoreColor}`}>
              Therapeutic Score: {(hoveredDrug.therapeuticScore * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}
      
      {/* Drug ranking button - positioned over canvas */}
      <div className="absolute top-3 left-3">
        <button
          onClick={startDrugRanking}
          disabled={drugAnimation.isRunning}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 ${
            drugAnimation.isRunning
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 hover:shadow-md active:scale-95'
          }`}
        >
          {drugAnimation.isRunning ? 'Ranking...' : 'Rank Drug Candidates'}
        </button>
        
        {drugAnimation.isRunning && (
          <div className="text-xs mt-1 text-gray-600 bg-white/90 rounded px-2 py-1">
            <div className="flex items-center space-x-1">
              <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></div>
              <span>
                Evaluating {activeDrugCount} candidates...
              </span>
            </div>
          </div>
        )}
        
        {!drugAnimation.isRunning && activeDrugCount > 0 && activeDrugCount <= 10 && drugAnimation.drugCandidates.length > 0 && (
          <div className="text-xs text-yellow-600 mt-1 font-medium bg-white/90 rounded px-2 py-1">
            ✨ Top {activeDrugCount} drugs identified
          </div>
        )}
      </div>
    </div>
  );
};

const DesktopContent = () => (
  <main className="hidden sm:flex flex-col items-center justify-center min-h-screen p-8">
    {/* Header */}
    <div className="text-center mb-12">
      <Link href="/" className="inline-block mb-6 text-gray-600 hover:text-gray-800 transition-colors roboto-slab-regular text-sm">
        ← Back to Home
      </Link>
      <h1 className="roboto-slab-medium text-2xl text-gray-dark mb-4">
        Zebrafish Melanoma Model Embedding Space
      </h1>
      <p className="roboto-slab-regular text-base text-gray-semidark max-w-2xl mx-auto leading-relaxed">
        Interactive visualization of learned representations from zebrafish melanoma models. 
        Each point represents cellular transcriptional states, clustered by disease phenotype and therapeutic response patterns.
      </p>
    </div>
    
    {/* Visualization and Legend */}
    <div className="flex items-start gap-8 mb-8">
      {/* Visualization */}
      <div>
        <ZebrafishEmbeddingVisualization width={600} height={500} />
      </div>
      
      {/* Legend */}
      <div className="w-80">
        <div className="bg-gray-50 border border-gray-200 rounded px-4 py-3">
          <h3 className="roboto-slab-medium text-base text-gray-dark mb-3">Melanoma Models</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div 
                className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0" 
                style={{ backgroundColor: HEALTHY_REGION.color }}
              />
              <div>
                <div className="roboto-slab-medium text-sm text-gray-dark">
                  {HEALTHY_REGION.label}
                </div>
                <div className="roboto-slab-regular text-xs text-gray-medium leading-relaxed">
                  Normal melanocyte transcriptional states
                </div>
              </div>
            </div>
            {DISEASE_LOBES.map((lobe) => (
              <div key={lobe.id} className="flex items-start gap-3">
                <div 
                  className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0" 
                  style={{ backgroundColor: lobe.color }}
                />
                <div>
                  <div className="roboto-slab-medium text-sm text-gray-dark">
                    {lobe.label}
                  </div>
                  <div className="roboto-slab-regular text-xs text-gray-medium leading-relaxed">
                    {lobe.shortDesc}
                  </div>
                  <div className="roboto-slab-regular text-xs text-gray-400 mt-0.5">
                    {lobe.gseId}
                  </div>
                </div>
              </div>
            ))}
            <div className="border-t border-gray-300 pt-3 mt-3">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="roboto-slab-medium text-sm text-gray-dark">
                    Drug Vectors
                  </div>
                  <div className="roboto-slab-regular text-xs text-gray-medium leading-relaxed">
                    AI-discovered therapeutic pathways toward healthy melanocyte states
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    {/* Description */}
    <div className="max-w-2xl text-center">
      <p className="roboto-slab-regular text-sm text-gray-medium leading-relaxed">
        Hover over the embedding space to explore cellular states and disease vectors. Click &quot;Rank Drug Candidates&quot; 
        to watch AI-driven therapeutic discovery in action, as potential drug vectors are evaluated and ranked 
        based on their ability to guide diseased melanoma cells back toward healthy transcriptional states.
      </p>
    </div>
  </main>
);

const MobileContent = () => (
  <main className="flex sm:hidden flex-col items-center justify-center min-h-screen p-6">
    {/* Header */}
    <div className="text-center mb-8">
      <Link href="/" className="inline-block mb-4 text-gray-600 hover:text-gray-800 transition-colors roboto-slab-regular text-sm">
        ← Back to Home
      </Link>
      <h1 className="roboto-slab-medium text-xl text-gray-dark mb-3">
        Zebrafish Melanoma Model Embedding
      </h1>
      <p className="roboto-slab-regular text-sm text-gray-semidark leading-relaxed">
        Interactive visualization of cellular transcriptional states from zebrafish melanoma models.
      </p>
    </div>
    
    {/* Visualization */}
    <div className="mb-6">
      <ZebrafishEmbeddingVisualization width={350} height={300} />
    </div>
    
    {/* Legend */}
    <div className="w-full max-w-sm mb-6">
      <div className="bg-gray-50 border border-gray-200 rounded px-3 py-3">
        <h3 className="roboto-slab-medium text-sm text-gray-dark mb-2">Melanoma Models</h3>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <div 
              className="w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0" 
              style={{ backgroundColor: HEALTHY_REGION.color }}
            />
            <div>
              <div className="roboto-slab-medium text-xs text-gray-dark">
                {HEALTHY_REGION.label}
              </div>
              <div className="roboto-slab-regular text-xs text-gray-medium leading-tight">
                Normal melanocyte states
              </div>
            </div>
          </div>
          {DISEASE_LOBES.slice(0, 4).map((lobe) => (
            <div key={lobe.id} className="flex items-start gap-2">
              <div 
                className="w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0" 
                style={{ backgroundColor: lobe.color }}
              />
              <div>
                <div className="roboto-slab-medium text-xs text-gray-dark">
                  {lobe.label}
                </div>
                <div className="roboto-slab-regular text-xs text-gray-medium leading-tight">
                  {lobe.shortDesc}
                </div>
                <div className="roboto-slab-regular text-xs text-gray-400 mt-0.5">
                  {lobe.gseId}
                </div>
              </div>
            </div>
          ))}
          <div className="text-xs text-gray-400 pl-4">
            +{DISEASE_LOBES.length - 4} more melanoma models
          </div>
          <div className="border-t border-gray-300 pt-2 mt-2">
            <div className="flex items-start gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="roboto-slab-medium text-xs text-gray-dark">
                  Drug Vectors
                </div>
                <div className="roboto-slab-regular text-xs text-gray-medium leading-tight">
                  AI-discovered therapeutic pathways
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    {/* Description */}
    <div className="text-center">
      <p className="roboto-slab-regular text-xs text-gray-medium leading-relaxed">
        Tap to explore cellular states. Use &quot;Rank Drug Candidates&quot; to see AI-driven 
        therapeutic discovery as potential drugs are evaluated for their ability to guide 
        diseased melanoma cells toward healthy states.
      </p>
    </div>
  </main>
);

export default function CaseStudy() {
  return (
    <>
      <DesktopContent />
      <MobileContent />
    </>
  );
}