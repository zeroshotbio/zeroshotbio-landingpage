'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

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
  startWorldX: number;
  startWorldY: number;
  endWorldX: number;
  endWorldY: number;
  startScreenX: number;
  startScreenY: number;
  endScreenX: number;
  endScreenY: number;
  therapeuticScore: number;
  spawnTime: number;
  lifespan: number;
  opacity: number;
  scale: number;
  glowIntensity: number;
  illuminationRadius: number;
  pulsePhase: number;
  eliminated: boolean;
}

interface DrugAnimationState {
  isRunning: boolean;
  startTime: number;
  duration: number;
  drugCandidates: DrugCandidate[];
  currentPhase: 'fast' | 'slowing' | 'final';
}

interface DiseaseRegion {
  center: [number, number];
  baseRadius: number;
  elongation: { angle: number; ratio: number };
  label: string;
  color: string;
  description: string;
  id: string;
}

interface HealthyRegion {
  center: [number, number];
  baseRadius: number;
  label: string;
  color: string;
  description: string;
}

// ============================================================================
// REGION DEFINITIONS
// ============================================================================

// Define the healthy region and multiple disease lobes
const HEALTHY_REGION: HealthyRegion = {
  center: [-1.3, 0.2],
  baseRadius: 0.8,
  label: 'Healthy',
  color: '#059669',
  description: 'Normal zebrafish melanocytes'
};

const DISEASE_LOBES: DiseaseRegion[] = [
  {
    center: [1.4, -0.6],
    baseRadius: 0.9,
    elongation: { angle: Math.PI * 0.3, ratio: 1.6 },
    label: 'Metastatic',
    color: '#dc2626',
    description: 'ZMEL1-PRO → ZMEL1-INV metastasis',
    id: 'metastatic'
  },
  {
    center: [0.8, 1.2],
    baseRadius: 0.7,
    elongation: { angle: Math.PI * 1.1, ratio: 1.4 },
    label: 'MITF-low',
    color: '#b91c1c',
    description: 'Therapy-resistant MITF-low cells',
    id: 'mitf_low'
  },
  {
    center: [2.0, 0.4],
    baseRadius: 0.6,
    elongation: { angle: Math.PI * 0.8, ratio: 1.3 },
    label: 'Mucosal',
    color: '#ef4444',
    description: 'Mucosal melanoma atlas',
    id: 'mucosal'
  },
  {
    center: [0.3, -1.5],
    baseRadius: 0.5,
    elongation: { angle: Math.PI * 1.7, ratio: 1.2 },
    label: 'Spatial',
    color: '#f87171',
    description: 'Spatial transcriptomics architecture',
    id: 'spatial'
  },
  {
    center: [1.8, 1.8],
    baseRadius: 0.4,
    elongation: { angle: Math.PI * 0.1, ratio: 1.1 },
    label: 'Stress',
    color: '#fca5a5',
    description: 'Oxidative stress plasticity',
    id: 'stress'
  },
  {
    center: [-0.2, 1.9],
    baseRadius: 0.45,
    elongation: { angle: Math.PI * 1.4, ratio: 1.25 },
    label: 'Neural-crest',
    color: '#fecaca',
    description: 'Sox10 neural-crest re-emergence',
    id: 'neural_crest'
  },
  {
    center: [2.2, -1.1],
    baseRadius: 0.35,
    elongation: { angle: Math.PI * 0.6, ratio: 1.15 },
    label: 'Uveal',
    color: '#fed7d7',
    description: 'GNAQ-driven uveal precursor',
    id: 'uveal'
  }
];

// Generate organic, UMAP-like point distributions
const generateUMAPStylePointCloud = (viewportWidth: number, viewportHeight: number): Point[] => {
  const points: Point[] = []; // ✅ Explicit typing
  const spacing = 10;
  const cols = Math.ceil(viewportWidth / spacing);
  const rows = Math.ceil(viewportHeight / spacing);
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const screenX = col * spacing;
      const screenY = row * spacing;
      
      // Convert to world coordinates
      const worldX = ((screenX - viewportWidth / 2) / Math.min(viewportWidth, viewportHeight)) * 4;
      const worldY = ((screenY - viewportHeight / 2) / Math.min(viewportWidth, viewportHeight)) * 4;
      
      // Edge fading
      const centerDistance = Math.sqrt(worldX * worldX + worldY * worldY);
      const edgeFade = Math.max(0.01, Math.min(1, 1 - Math.pow(centerDistance / 3, 2.5)));
      
      let maxIntensity = 0.18; // Higher base intensity for better visibility
      let assignedRegion = null;
      
      // Check healthy region with organic shape
      const healthyDist = Math.sqrt(
        (worldX - HEALTHY_REGION.center[0]) ** 2 + 
        (worldY - HEALTHY_REGION.center[1]) ** 2
      );
      
      if (healthyDist < HEALTHY_REGION.baseRadius * 1.3) {
        // Add organic noise to create realistic UMAP blob
        const noiseX = Math.sin(worldX * 4) * 0.15 + Math.cos(worldY * 3.2) * 0.12;
        const noiseY = Math.cos(worldX * 3.8) * 0.13 + Math.sin(worldY * 4.1) * 0.11;
        const organicDist = Math.sqrt(
          (worldX - HEALTHY_REGION.center[0] + noiseX) ** 2 + 
          (worldY - HEALTHY_REGION.center[1] + noiseY) ** 2
        );
        
        if (organicDist < HEALTHY_REGION.baseRadius) {
          const falloff = Math.max(0, 1 - (organicDist / HEALTHY_REGION.baseRadius));
          const intensity = 0.82 * Math.pow(falloff, 1.2); // 50% more visible base intensity
          
          // Add some internal structure variation
          const internalNoise = 0.08 * (Math.sin(worldX * 8) + Math.cos(worldY * 7));
          const finalIntensity = intensity + internalNoise;
          
          if (finalIntensity > maxIntensity) {
            maxIntensity = finalIntensity;
            assignedRegion = 'healthy';
          }
        }
      }
      
      // Check disease lobes with organic elongated shapes
      DISEASE_LOBES.forEach((lobe: DiseaseRegion) => {
        const dx = worldX - lobe.center[0];
        const dy = worldY - lobe.center[1];
        
        // Apply elongation transformation
        const cos_theta = Math.cos(lobe.elongation.angle);
        const sin_theta = Math.sin(lobe.elongation.angle);
        const rotated_x = dx * cos_theta + dy * sin_theta;
        const rotated_y = -dx * sin_theta + dy * cos_theta;
        
        // Create elongated ellipse with organic noise
        const organicNoiseX = Math.sin(worldX * 5 + lobe.center[0]) * 0.08 + Math.cos(worldY * 4.5) * 0.06;
        const organicNoiseY = Math.cos(worldX * 4.2) * 0.07 + Math.sin(worldY * 5.3 + lobe.center[1]) * 0.09;
        
        const ellipse_dist = Math.sqrt(
          Math.pow((rotated_x + organicNoiseX) / lobe.baseRadius, 2) + 
          Math.pow((rotated_y + organicNoiseY) / (lobe.baseRadius / lobe.elongation.ratio), 2)
        );
        
        if (ellipse_dist < 1.1) {
          const falloff = Math.max(0, 1 - ellipse_dist);
          
          // Add heterogeneity for disease states
          const heterogeneity = 0.12 * (
            Math.sin(worldX * 6 + lobe.center[0] * 10) + 
            Math.cos(worldY * 5.5 + lobe.center[1] * 8) +
            Math.sin((worldX + worldY) * 3.2)
          );
          
          const baseIntensity = 0.6 + heterogeneity; // 50% more visible base intensity
          const intensity = baseIntensity * Math.pow(falloff, 0.8);
          
          if (intensity > maxIntensity) {
            maxIntensity = intensity;
            assignedRegion = lobe.id;
          }
        }
      });
      
      // Add general noise
      const globalNoise = (Math.random() - 0.5) * 0.08;
      const finalIntensity = Math.max(0.01, Math.min(1, maxIntensity + globalNoise)) * edgeFade;
      
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

export default function ZebrafishEmbeddingSpace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const drugAnimationRef = useRef<number | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [mousePosition, setMousePosition] = useState<{x: number; y: number}>({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState<{width: number; height: number}>({ width: 0, height: 0 });
  const [flashlightRadius] = useState<number>(140);
  const [drugAnimation, setDrugAnimation] = useState<DrugAnimationState>({
    isRunning: false,
    startTime: 0,
    duration: 10000,
    drugCandidates: [] as DrugCandidate[],
    currentPhase: 'fast' as const
  });

  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      const newPoints = generateUMAPStylePointCloud(dimensions.width, dimensions.height);
      setPoints(newPoints);
    }
  }, [dimensions]);
  
  const updateDimensions = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    setDimensions({ width: rect.width, height: rect.height });
  }, []);

  // Generate random drug candidate vectors
  const generateDrugCandidates = useCallback((count: number): DrugCandidate[] => {
    const candidates: DrugCandidate[] = [];
    
    for (let i = 0; i < count; i++) {
      // Random start point throughout the space
      const startWorldX = (Math.random() - 0.5) * 4;
      const startWorldY = (Math.random() - 0.5) * 4;
      
      // Random direction and length
      const angle = Math.random() * Math.PI * 2;
      const length = 0.3 + Math.random() * 0.4;
      
      const endWorldX = startWorldX + Math.cos(angle) * length;
      const endWorldY = startWorldY + Math.sin(angle) * length;
      
      // Convert to screen coordinates
      const startScreenX = dimensions.width / 2 + startWorldX * Math.min(dimensions.width, dimensions.height) / 4;
      const startScreenY = dimensions.height / 2 + startWorldY * Math.min(dimensions.width, dimensions.height) / 4;
      const endScreenX = dimensions.width / 2 + endWorldX * Math.min(dimensions.width, dimensions.height) / 4;
      const endScreenY = dimensions.height / 2 + endWorldY * Math.min(dimensions.width, dimensions.height) / 4;
      
      // Calculate therapeutic score
      const vectorX = endWorldX - startWorldX;
      const vectorY = endWorldY - startWorldY;
      
      const toHealthyX = HEALTHY_REGION.center[0] - startWorldX;
      const toHealthyY = HEALTHY_REGION.center[1] - startWorldY;
      const toHealthyLength = Math.sqrt(toHealthyX ** 2 + toHealthyY ** 2);
      
      const vectorLength = Math.sqrt(vectorX ** 2 + vectorY ** 2);
      const therapeuticScore = toHealthyLength > 0 && vectorLength > 0 ? 
        (vectorX * toHealthyX + vectorY * toHealthyY) / (vectorLength * toHealthyLength) : 0;
      
      // Bonus for starting in disease regions
      let regionBonus = 0;
      DISEASE_LOBES.forEach((lobe: DiseaseRegion) => {
        const distToLobe = Math.sqrt(
          (startWorldX - lobe.center[0]) ** 2 + (startWorldY - lobe.center[1]) ** 2
        );
        if (distToLobe < lobe.baseRadius) {
          regionBonus += 0.3;
        }
      });
      
      const finalScore = therapeuticScore + regionBonus + Math.random() * 0.1;
      
      candidates.push({
        id: i,
        startWorldX,
        startWorldY,
        endWorldX,
        endWorldY,
        startScreenX,
        startScreenY,
        endScreenX,
        endScreenY,
        therapeuticScore: finalScore,
        spawnTime: Math.random() * 2000, // Stagger spawn times over 2 seconds
        lifespan: 5000 + Math.random() * 3000, // Variable lifespan
        opacity: 0,
        scale: 0.5 + Math.random() * 0.5,
        glowIntensity: 0.5 + Math.random() * 0.5,
        illuminationRadius: 80 + Math.random() * 40,
        pulsePhase: Math.random() * Math.PI * 2,
        eliminated: false
      });
    }
    
    return candidates.sort((a, b) => b.therapeuticScore - a.therapeuticScore);
  }, [dimensions]);

  // Drug animation effect (separate from render loop)
  useEffect(() => {
    if (!drugAnimation.isRunning) return;

    const updateDrugAnimation = () => {
      const elapsed = Date.now() - drugAnimation.startTime;
      const progress = Math.min(1, elapsed / drugAnimation.duration);
      
      // Update each candidate
      const updatedCandidates = drugAnimation.drugCandidates.map((candidate: DrugCandidate) => {
        const age = elapsed - candidate.spawnTime;
        
        // Smooth spawn animation
        let opacity = 0;
        let scale = candidate.scale;
        
        if (age > 0) {
          const spawnProgress = Math.min(1, age / 800); // 800ms spawn animation
          opacity = Math.sin(spawnProgress * Math.PI * 0.5) * 0.9; // Smooth fade in
          scale = candidate.scale * (0.5 + 0.5 * spawnProgress); // Scale up effect
        }
        
        // Elimination based on therapeutic score and phase
        let shouldEliminate = false;
        const scoreRank = drugAnimation.drugCandidates.findIndex((c: DrugCandidate) => c.id === candidate.id);
        
        if (progress < 0.3) {
          // Fast phase - keep top 30%
          shouldEliminate = scoreRank > drugAnimation.drugCandidates.length * 0.3;
        } else if (progress < 0.7) {
          // Slowing phase - keep top 15%
          shouldEliminate = scoreRank > drugAnimation.drugCandidates.length * 0.15;
        } else {
          // Final phase - keep top 10
          shouldEliminate = scoreRank > 10;
        }
        
        // Smooth elimination
        if (shouldEliminate && !candidate.eliminated) {
          const eliminationDelay = Math.random() * 1000; // Stagger eliminations
          if (elapsed > candidate.spawnTime + eliminationDelay) {
            opacity *= Math.max(0, 1 - (elapsed - candidate.spawnTime - eliminationDelay) / 1000);
          }
        }
        
        return {
          ...candidate,
          opacity: Math.max(0, opacity),
          scale,
          eliminated: shouldEliminate && opacity <= 0.1
        };
      });
      
      setDrugAnimation(prev => ({
        ...prev,
        drugCandidates: updatedCandidates,
        currentPhase: progress < 0.3 ? 'fast' as const : progress < 0.7 ? 'slowing' as const : 'final' as const
      }));
      
      if (progress < 1) {
        drugAnimationRef.current = requestAnimationFrame(updateDrugAnimation);
      } else {
        // Animation complete
        const survivors: DrugCandidate[] = updatedCandidates
          .filter((_: DrugCandidate, index: number) => index < 10)
          .map((c: DrugCandidate) => ({ ...c, opacity: 0.8, eliminated: false }));
        
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
  }, [drugAnimation.isRunning, drugAnimation.startTime, drugAnimation.drugCandidates, drugAnimation.duration]);

  // Start drug ranking animation
  const startDrugRanking = useCallback(() => {
    if (!dimensions.width) return;
    
    const candidates = generateDrugCandidates(200);
    
    setDrugAnimation({
      isRunning: true,
      startTime: Date.now(),
      duration: 10000,
      drugCandidates: candidates,
      currentPhase: 'fast' as const
    });
  }, [dimensions, generateDrugCandidates]);
  
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate illumination from drug candidates
    const drugIllumination = new Map<number, number>();
    const activeCandidates = drugAnimation.drugCandidates.filter((c: DrugCandidate) => !c.eliminated && c.opacity > 0);
    
    activeCandidates.forEach((candidate: DrugCandidate) => {
      const currentTime = Date.now();
      const pulseValue = Math.sin(currentTime * 0.005 + candidate.pulsePhase) * 0.3 + 0.7;
      const effectiveRadius = candidate.illuminationRadius * candidate.scale * pulseValue;
      
      // Create multiple illumination points along the arrow
      for (let t = 0; t <= 1; t += 0.1) {
        const illuminationX = candidate.startScreenX + t * (candidate.endScreenX - candidate.startScreenX);
        const illuminationY = candidate.startScreenY + t * (candidate.endScreenY - candidate.startScreenY);
        
        points.forEach((point: Point, index: number) => {
          const distToIllumination = Math.sqrt(
            (point.screenX - illuminationX) ** 2 + 
            (point.screenY - illuminationY) ** 2
          );
          
          if (distToIllumination < effectiveRadius) {
            const illuminationIntensity = Math.max(0, 1 - (distToIllumination / effectiveRadius));
            const smoothIntensity = Math.pow(illuminationIntensity, 0.6) * candidate.opacity * candidate.glowIntensity;
            
            const currentIllumination = drugIllumination.get(index) || 0;
            drugIllumination.set(index, Math.max(currentIllumination, smoothIntensity));
          }
        });
      }
    });
    
    // Draw points with all illumination effects
    points.forEach((point: Point, index: number) => {
      const distanceToMouse = Math.sqrt(
        (point.screenX - mousePosition.x) ** 2 + 
        (point.screenY - mousePosition.y) ** 2
      );
      
      const flashlightIntensity = Math.max(0, 1 - (distanceToMouse / flashlightRadius));
      const smoothFlashlight = Math.pow(flashlightIntensity, 0.7);
      
      const drugIlluminationIntensity = drugIllumination.get(index) || 0;
      
      let intensity = point.baseIntensity;
      
      if (smoothFlashlight > 0) {
        const regionBoost = point.region ? 1.6 : 1.2;
        intensity = Math.min(1, intensity + (smoothFlashlight * 0.5 * regionBoost));
      }
      
      if (drugIlluminationIntensity > 0) {
        const drugBoost = point.region ? 1.8 : 1.3;
        intensity = Math.min(1, intensity + (drugIlluminationIntensity * 0.6 * drugBoost));
      }
      
      // Get region color
      let pointColor = '#666666';
      if (point.region === 'healthy') {
        pointColor = HEALTHY_REGION.color;
      } else if (point.region) {
        const lobe = DISEASE_LOBES.find((l: DiseaseRegion) => l.id === point.region);
        if (lobe) pointColor = lobe.color;
      }
      
      // Convert hex to RGB
      const hex = pointColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      
      // Add golden tint for drug illumination
      let finalR = r, finalG = g, finalB = b;
      if (drugIlluminationIntensity > 0) {
        const goldTint = drugIlluminationIntensity * 0.4;
        finalR = Math.min(255, r + goldTint * 200);
        finalG = Math.min(255, g + goldTint * 180);
        finalB = Math.max(0, b * (1 - goldTint * 0.3));
      }
      
      const blendFactor = intensity * 1.2;
      const blendedR = Math.floor(finalR * blendFactor + 255 * (1 - blendFactor));
      const blendedG = Math.floor(finalG * blendFactor + 255 * (1 - blendFactor));
      const blendedB = Math.floor(finalB * blendFactor + 255 * (1 - blendFactor));
      
      ctx.fillStyle = `rgb(${blendedR}, ${blendedG}, ${blendedB})`;
      ctx.beginPath();
      ctx.arc(point.screenX, point.screenY, 0.9, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    // Draw drug candidate arrows with beautiful effects
    activeCandidates.forEach((candidate: DrugCandidate) => {
      if (candidate.opacity <= 0) return;
      
      const currentTime = Date.now();
      const pulseValue = Math.sin(currentTime * 0.003 + candidate.pulsePhase) * 0.2 + 0.8;
      const finalOpacity = candidate.opacity * pulseValue;
      
      // Draw glow effect first
      const glowAlpha = Math.floor(finalOpacity * 60).toString(16).padStart(2, '0');
      ctx.strokeStyle = '#fbbf24' + glowAlpha;
      ctx.lineWidth = 6 * candidate.scale;
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.moveTo(candidate.startScreenX, candidate.startScreenY);
      ctx.lineTo(candidate.endScreenX, candidate.endScreenY);
      ctx.stroke();
      
      // Draw main arrow
      const alpha = Math.floor(finalOpacity * 255).toString(16).padStart(2, '0');
      ctx.strokeStyle = '#f59e0b' + alpha;
      ctx.fillStyle = '#f59e0b' + alpha;
      ctx.lineWidth = 2.5 * candidate.scale;
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.moveTo(candidate.startScreenX, candidate.startScreenY);
      ctx.lineTo(candidate.endScreenX, candidate.endScreenY);
      ctx.stroke();
      
      // Draw arrowhead with style
      const angle = Math.atan2(
        candidate.endScreenY - candidate.startScreenY,
        candidate.endScreenX - candidate.startScreenX
      );
      const headLength = 8 * candidate.scale;
      const headAngle = Math.PI / 5;
      
      ctx.beginPath();
      ctx.moveTo(candidate.endScreenX, candidate.endScreenY);
      ctx.lineTo(
        candidate.endScreenX - headLength * Math.cos(angle - headAngle),
        candidate.endScreenY - headLength * Math.sin(angle - headAngle)
      );
      ctx.lineTo(
        candidate.endScreenX - headLength * 0.6 * Math.cos(angle),
        candidate.endScreenY - headLength * 0.6 * Math.sin(angle)
      );
      ctx.lineTo(
        candidate.endScreenX - headLength * Math.cos(angle + headAngle),
        candidate.endScreenY - headLength * Math.sin(angle + headAngle)
      );
      ctx.closePath();
      ctx.fill();
    });
    
    // Draw regular region arrows
    points.forEach((point: Point) => {
      if (!point.region) return;
      
      const distanceToMouse = Math.sqrt(
        (point.screenX - mousePosition.x) ** 2 + 
        (point.screenY - mousePosition.y) ** 2
      );
      
      const flashlightIntensity = Math.max(0, 1 - (distanceToMouse / flashlightRadius));
      const arrowOpacity = Math.pow(flashlightIntensity, 1.1);
      
      if (arrowOpacity > 0.12) {
        let dx, dy, arrowColor;
        
        if (point.region === 'healthy') {
          dx = HEALTHY_REGION.center[0] - point.worldX;
          dy = HEALTHY_REGION.center[1] - point.worldY;
          arrowColor = HEALTHY_REGION.color;
        } else {
          const lobe = DISEASE_LOBES.find((l: DiseaseRegion) => l.id === point.region);
          if (!lobe) return;
          
          dx = HEALTHY_REGION.center[0] - point.worldX;
          dy = HEALTHY_REGION.center[1] - point.worldY;
          arrowColor = lobe.color;
        }
        
        const angle = Math.atan2(dy, dx);
        const arrowLength = 18 * arrowOpacity;
        const arrowEndX = point.screenX + Math.cos(angle) * arrowLength;
        const arrowEndY = point.screenY + Math.sin(angle) * arrowLength;
        
        const alpha = Math.floor(arrowOpacity * 255).toString(16).padStart(2, '0');
        ctx.strokeStyle = arrowColor + alpha;
        ctx.fillStyle = arrowColor + alpha;
        ctx.lineWidth = 1.3;
        
        ctx.beginPath();
        ctx.moveTo(point.screenX, point.screenY);
        ctx.lineTo(arrowEndX, arrowEndY);
        ctx.stroke();
        
        const headLength = 4.5;
        const headAngle = Math.PI / 6;
        
        ctx.beginPath();
        ctx.moveTo(arrowEndX, arrowEndY);
        ctx.lineTo(
          arrowEndX - headLength * Math.cos(angle - headAngle),
          arrowEndY - headLength * Math.sin(angle - headAngle)
        );
        ctx.moveTo(arrowEndX, arrowEndY);
        ctx.lineTo(
          arrowEndX - headLength * Math.cos(angle + headAngle),
          arrowEndY - headLength * Math.sin(angle + headAngle)
        );
        ctx.stroke();
      }
    });
  }, [points, mousePosition, flashlightRadius, drugAnimation.drugCandidates]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    
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
  }, [draw, dimensions]);
  
  useEffect(() => {
    updateDimensions();
    
    const handleResize = () => {
      setTimeout(updateDimensions, 100);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [updateDimensions]);
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };
  
  const getMostIlluminatedRegion = useCallback((): HealthyRegion | DiseaseRegion | null => {
    if (points.length === 0) return null;
    
    const regionIllumination: Record<string, number> = {};
    regionIllumination['healthy'] = 0;
    DISEASE_LOBES.forEach((lobe: DiseaseRegion) => {
      regionIllumination[lobe.id] = 0;
    });
    
    points.forEach((point: Point) => {
      if (!point.region) return;
      
      const distanceToMouse = Math.sqrt(
        (point.screenX - mousePosition.x) ** 2 + 
        (point.screenY - mousePosition.y) ** 2
      );
      
      const flashlightIntensity = Math.max(0, 1 - (distanceToMouse / flashlightRadius));
      regionIllumination[point.region] += flashlightIntensity;
    });
    
    const maxIllumination = Math.max(...Object.values(regionIllumination));
    if (maxIllumination > 2.5) {
      const regionKey = Object.keys(regionIllumination).find(
        key => regionIllumination[key] === maxIllumination
      );
      
      if (regionKey === 'healthy') {
        return HEALTHY_REGION;
      } else {
        return DISEASE_LOBES.find((lobe: DiseaseRegion) => lobe.id === regionKey) || null;
      }
    }
    
    return null;
  }, [points, mousePosition, flashlightRadius]);
  
  const illuminatedRegion = getMostIlluminatedRegion();
  const activeDrugCount = drugAnimation.drugCandidates.filter((c: DrugCandidate) => !c.eliminated && c.opacity > 0).length;
  
  return (
    <div className="w-full h-screen bg-white overflow-hidden">
      <div 
        ref={containerRef}
        className="w-full h-full relative"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-crosshair"
          onMouseMove={handleMouseMove}
          style={{ width: '100%', height: '100%' }}
        />
        
        {illuminatedRegion && (
          <div
            className="absolute pointer-events-none transition-all duration-400 ease-out"
            style={{
              left: mousePosition.x + 22,
              top: mousePosition.y - 25,
            }}
          >
            <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-sm px-3 py-2 shadow-sm max-w-xs">
              <div 
                className="text-sm font-medium tracking-wide"
                style={{ color: illuminatedRegion.color }}
              >
                {illuminatedRegion.label}
              </div>
              <div className="text-xs text-gray-600 mt-1 leading-tight">
                {illuminatedRegion.description}
              </div>
            </div>
          </div>
        )}
        
        <div className="absolute top-4 left-4">
          <div className="bg-white/85 backdrop-blur-sm border border-gray-200 rounded px-3 py-2 shadow-sm mb-3">
            <div className="text-sm font-medium text-gray-700 mb-1">
              Zebrafish Disease Model Embedding
            </div>
            <div className="text-xs text-gray-500 mb-3">
              Single-cell transcriptional landscapes
            </div>
            <button
              onClick={startDrugRanking}
              disabled={drugAnimation.isRunning}
              className={`px-4 py-2 rounded text-sm font-medium transition-all duration-200 ${
                drugAnimation.isRunning
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 hover:shadow-md active:scale-95'
              }`}
            >
              {drugAnimation.isRunning ? 'Ranking Candidates...' : 'Rank Drug Candidates'}
            </button>
            {drugAnimation.isRunning && (
              <div className="text-xs mt-2 text-gray-600">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  <span>
                    {drugAnimation.currentPhase === 'fast' && 'Screening candidates rapidly...'}
                    {drugAnimation.currentPhase === 'slowing' && 'Filtering promising vectors...'}
                    {drugAnimation.currentPhase === 'final' && 'Identifying top performers...'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {activeDrugCount} candidates remaining
                </div>
              </div>
            )}
            {drugAnimation.currentPhase === 'final' && activeDrugCount === 10 && !drugAnimation.isRunning && (
              <div className="text-xs text-yellow-600 mt-2 font-medium">
                ✨ Top 10 candidates identified
              </div>
            )}
          </div>
        </div>
        
        {drugAnimation.isRunning && (
          <div className="absolute top-4 right-4 pointer-events-none">
            <div className="bg-yellow-50/90 backdrop-blur-sm border border-yellow-200 rounded px-3 py-2 shadow-sm">
              <div className="text-sm font-medium text-yellow-700 mb-1">
                Drug Discovery in Progress
              </div>
              <div className="text-xs text-yellow-600">
                Phase: {drugAnimation.currentPhase === 'fast' ? 'Rapid Screening' : 
                       drugAnimation.currentPhase === 'slowing' ? 'Refinement' : 'Final Selection'}
              </div>
              <div className="text-xs text-yellow-500 mt-1">
                {activeDrugCount} active vectors
              </div>
            </div>
          </div>
        )}
        
        <div className="absolute bottom-4 right-4 pointer-events-none">
          <div className="bg-white/85 backdrop-blur-sm border border-gray-200 rounded px-3 py-2 shadow-sm">
            <div className="text-xs font-medium text-gray-700 mb-2">Disease Models</div>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: HEALTHY_REGION.color }}
                />
                <span className="text-xs text-gray-600">Healthy</span>
              </div>
              {DISEASE_LOBES.map((lobe: DiseaseRegion) => (
                <div key={lobe.id} className="flex items-center space-x-2">
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: lobe.color }}
                  />
                  <span className="text-xs text-gray-600">{lobe.label}</span>
                </div>
              ))}
              {(drugAnimation.isRunning || drugAnimation.drugCandidates.length > 0) && (
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-400" />
                    <span className="text-xs text-gray-600">Drug Vectors</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: dimensions.width / 2 + HEALTHY_REGION.center[0] * Math.min(dimensions.width, dimensions.height) / 4,
              top: dimensions.height / 2 + HEALTHY_REGION.center[1] * Math.min(dimensions.width, dimensions.height) / 4,
            }}
          >
            <div className="text-center">
              <div 
                className="text-sm font-medium tracking-wide opacity-75 drop-shadow-sm"
                style={{ 
                  color: HEALTHY_REGION.color,
                  textShadow: '0 0 8px rgba(255,255,255,0.8)'
                }}
              >
                {HEALTHY_REGION.label}
              </div>
            </div>
          </div>
          
          {DISEASE_LOBES.map((lobe: DiseaseRegion) => (
            <div
              key={lobe.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2"
              style={{
                left: dimensions.width / 2 + lobe.center[0] * Math.min(dimensions.width, dimensions.height) / 4,
                top: dimensions.height / 2 + lobe.center[1] * Math.min(dimensions.width, dimensions.height) / 4,
              }}
            >
              <div className="text-center">
                <div 
                  className="text-sm font-medium tracking-wide opacity-70 drop-shadow-sm"
                  style={{ 
                    color: lobe.color,
                    textShadow: '0 0 8px rgba(255,255,255,0.8)'
                  }}
                >
                  {lobe.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}