'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// Define regions with their properties
const REGIONS = [
  { 
    center: [-1.2, 0.4], 
    radius: 1.4, 
    intensity: 0.9, 
    label: 'Healthy',
    color: '#2563eb'
  },
  { 
    center: [1.3, -0.9], 
    radius: 1.2, 
    intensity: 0.95, 
    label: 'Disease',
    color: '#dc2626'
  },
  { 
    center: [0.6, 1.4], 
    radius: 1.0, 
    intensity: 0.85, 
    label: 'Drug Candidate',
    color: '#059669'
  }
];

// Generate full-viewport point cloud
const generateFullViewportPointCloud = (viewportWidth: number, viewportHeight: number) => {
  const points = [];
  const spacing = 12; // Pixels between points
  const cols = Math.ceil(viewportWidth / spacing);
  const rows = Math.ceil(viewportHeight / spacing);
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const screenX = col * spacing;
      const screenY = row * spacing;
      
      // Convert to world coordinates (-2 to 2 range)
      const worldX = ((screenX - viewportWidth / 2) / Math.min(viewportWidth, viewportHeight)) * 4;
      const worldY = ((screenY - viewportHeight / 2) / Math.min(viewportWidth, viewportHeight)) * 4;
      
      // Calculate distance from center for edge fading
      const centerDistance = Math.sqrt(worldX * worldX + worldY * worldY);
      const edgeFade = Math.max(0.02, Math.min(1, 1 - Math.pow(centerDistance / 2.5, 3)));
      
      // Calculate region intensity
      let regionIntensity = 0.15; // Base intensity
      let regionIndex = -1;
      
      REGIONS.forEach((region, index) => {
        const distance = Math.sqrt(
          (worldX - region.center[0]) ** 2 + (worldY - region.center[1]) ** 2
        );
        
        if (distance < region.radius) {
          const falloff = Math.max(0, 1 - (distance / region.radius));
          const intensity = region.intensity * Math.pow(falloff, 1.5);
          
          if (intensity > regionIntensity) {
            regionIntensity = intensity;
            regionIndex = index;
          }
        }
      });
      
      // Add subtle noise
      const noise = (Math.random() - 0.5) * 0.1;
      const finalIntensity = Math.max(0.02, Math.min(1, regionIntensity + noise)) * edgeFade;
      
      points.push({
        screenX,
        screenY,
        worldX,
        worldY,
        baseIntensity: finalIntensity,
        region: regionIndex,
        regionLabel: regionIndex >= 0 ? REGIONS[regionIndex].label : '',
        centerDistance
      });
    }
  }
  
  return points;
};

export default function MinimalEmbeddingSpace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const [points, setPoints] = useState<any[]>([]);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [flashlightRadius] = useState(150); // Flashlight radius in pixels
  
  // Regenerate points when dimensions change
  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      setPoints(generateFullViewportPointCloud(dimensions.width, dimensions.height));
    }
  }, [dimensions]);
  
  const updateDimensions = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    setDimensions({ width: rect.width, height: rect.height });
  }, []);
  
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate flashlight effect for each point
    points.forEach(point => {
      const distanceToMouse = Math.sqrt(
        (point.screenX - mousePosition.x) ** 2 + 
        (point.screenY - mousePosition.y) ** 2
      );
      
      // Flashlight intensity (closer = brighter)
      const flashlightIntensity = Math.max(0, 1 - (distanceToMouse / flashlightRadius));
      const smoothFlashlight = Math.pow(flashlightIntensity, 0.8);
      
      // Base intensity from the point's inherent properties
      let intensity = point.baseIntensity;
      
      // Apply flashlight effect - makes points darker (more visible)
      if (smoothFlashlight > 0) {
        // Points in special regions get extra boost when illuminated
        const regionBoost = point.region !== -1 ? 1.8 : 1.0;
        intensity = Math.min(1, intensity + (smoothFlashlight * 0.7 * regionBoost));
      }
      
      // Convert intensity to darkness (higher intensity = darker point)
      const grayValue = Math.floor((1 - intensity) * 255);
      
      // Draw point
      ctx.fillStyle = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
      ctx.beginPath();
      ctx.arc(point.screenX, point.screenY, 1, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    // Draw arrows from illuminated region points
    points.forEach(point => {
      if (point.region === -1) return; // Only region points get arrows
      
      const distanceToMouse = Math.sqrt(
        (point.screenX - mousePosition.x) ** 2 + 
        (point.screenY - mousePosition.y) ** 2
      );
      
      const flashlightIntensity = Math.max(0, 1 - (distanceToMouse / flashlightRadius));
      const arrowOpacity = Math.pow(flashlightIntensity, 1.2);
      
      if (arrowOpacity > 0.1) { // Only draw arrows for well-illuminated points
        const region = REGIONS[point.region];
        
        // Calculate arrow direction (from point toward region center)
        const dx = region.center[0] - point.worldX;
        const dy = region.center[1] - point.worldY;
        const angle = Math.atan2(dy, dx);
        
        // Arrow properties
        const arrowLength = 16 * arrowOpacity;
        const arrowEndX = point.screenX + Math.cos(angle) * arrowLength;
        const arrowEndY = point.screenY + Math.sin(angle) * arrowLength;
        
        // Set arrow color with opacity
        const alpha = Math.floor(arrowOpacity * 255).toString(16).padStart(2, '0');
        ctx.strokeStyle = region.color + alpha;
        ctx.fillStyle = region.color + alpha;
        ctx.lineWidth = 1.5;
        
        // Draw arrow shaft
        ctx.beginPath();
        ctx.moveTo(point.screenX, point.screenY);
        ctx.lineTo(arrowEndX, arrowEndY);
        ctx.stroke();
        
        // Draw arrowhead
        const headLength = 4;
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
  }, [points, mousePosition, flashlightRadius]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set canvas size to match container
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    
    // Animation loop
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
  
  const handleMouseLeave = () => {
    // Keep last position when leaving so arrows don't all disappear
  };
  
  // Find which region is currently most illuminated for label
  const getMostIlluminatedRegion = useCallback(() => {
    if (points.length === 0) return null;
    
    const regionIllumination = [0, 0, 0];
    
    points.forEach(point => {
      if (point.region === -1) return;
      
      const distanceToMouse = Math.sqrt(
        (point.screenX - mousePosition.x) ** 2 + 
        (point.screenY - mousePosition.y) ** 2
      );
      
      const flashlightIntensity = Math.max(0, 1 - (distanceToMouse / flashlightRadius));
      regionIllumination[point.region] += flashlightIntensity;
    });
    
    const maxIllumination = Math.max(...regionIllumination);
    if (maxIllumination > 2) { // Threshold for showing label
      const regionIndex = regionIllumination.indexOf(maxIllumination);
      return REGIONS[regionIndex];
    }
    
    return null;
  }, [points, mousePosition, flashlightRadius]);
  
  const illuminatedRegion = getMostIlluminatedRegion();
  
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
          onMouseLeave={handleMouseLeave}
          style={{ width: '100%', height: '100%' }}
        />
        
        {/* Minimal region label */}
        {illuminatedRegion && (
          <div
            className="absolute pointer-events-none transition-all duration-500 ease-out"
            style={{
              left: mousePosition.x + 20,
              top: mousePosition.y - 10,
            }}
          >
            <span 
              className="text-xs font-medium tracking-wider uppercase px-2 py-1 rounded-sm backdrop-blur-sm"
              style={{ 
                color: illuminatedRegion.color,
                backgroundColor: illuminatedRegion.color + '08'
              }}
            >
              {illuminatedRegion.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}