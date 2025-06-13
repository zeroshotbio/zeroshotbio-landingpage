'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// Generate sample embedding data
const generateEmbeddingData = () => {
  const data = [];
  const clusters = [
    { center: [-2, -1.5], color: '#333333', label: 'Control' },
    { center: [1.5, 2], color: '#666666', label: 'Treatment A' },
    { center: [-1, 2.5], color: '#999999', label: 'Treatment B' },
    { center: [2, -1], color: '#444444', label: 'Treatment C' }
  ];
  
  clusters.forEach((cluster, clusterIndex) => {
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const radius = Math.random() * 0.8 + 0.2;
      const x = cluster.center[0] + Math.cos(angle) * radius;
      const y = cluster.center[1] + Math.sin(angle) * radius;
      
      data.push({
        x,
        y,
        id: `${clusterIndex}-${i}`,
        cluster: cluster.label,
        color: cluster.color
      });
    }
  });
  
  return data;
};

const EmbeddingVisualization = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [data] = useState(generateEmbeddingData());
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Set up coordinate system
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const scale = 80;
      
      // Draw grid
      ctx.strokeStyle = '#f0f0f0';
      ctx.lineWidth = 0.5;
      for (let i = -5; i <= 5; i++) {
        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(centerX + i * scale, 0);
        ctx.lineTo(centerX + i * scale, canvas.height);
        ctx.stroke();
        
        // Horizontal lines
        ctx.beginPath();
        ctx.moveTo(0, centerY + i * scale);
        ctx.lineTo(canvas.width, centerY + i * scale);
        ctx.stroke();
      }
      
      // Draw axes
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(canvas.width, centerY);
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, canvas.height);
      ctx.stroke();
      
      // Draw points
      data.forEach(point => {
        const screenX = centerX + point.x * scale;
        const screenY = centerY - point.y * scale; // Flip Y axis
        
        ctx.fillStyle = point.color;
        ctx.beginPath();
        
        if (hoveredPoint && hoveredPoint.id === point.id) {
          ctx.arc(screenX, screenY, 5, 0, 2 * Math.PI);
        } else {
          ctx.arc(screenX, screenY, 3, 0, 2 * Math.PI);
        }
        
        ctx.fill();
        
        // Add slight glow effect for hovered point
        if (hoveredPoint && hoveredPoint.id === point.id) {
          ctx.strokeStyle = point.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(screenX, screenY, 8, 0, 2 * Math.PI);
          ctx.stroke();
        }
      });
    };
    
    draw();
  }, [data, hoveredPoint]);
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setMousePos({ x: e.clientX, y: e.clientY });
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = 80;
    
    // Find closest point
    let closestPoint = null;
    let minDistance = Infinity;
    
    data.forEach(point => {
      const screenX = centerX + point.x * scale;
      const screenY = centerY - point.y * scale;
      const distance = Math.sqrt((mouseX - screenX) ** 2 + (mouseY - screenY) ** 2);
      
      if (distance < 15 && distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    });
    
    setHoveredPoint(closestPoint);
  };
  
  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };
  
  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={600}
        height={500}
        className="border border-gray-200 cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      
      {hoveredPoint && (
        <div 
          className="absolute bg-white border border-gray-300 px-3 py-2 rounded shadow-lg pointer-events-none z-10"
          style={{
            left: mousePos.x - (canvasRef.current?.getBoundingClientRect().left || 0) + 10,
            top: mousePos.y - (canvasRef.current?.getBoundingClientRect().top || 0) - 10
          }}
        >
          <div className="roboto-slab-regular text-sm text-gray-700">
            <div><strong>Cluster:</strong> {hoveredPoint.cluster}</div>
            <div><strong>Position:</strong> ({hoveredPoint.x.toFixed(2)}, {hoveredPoint.y.toFixed(2)})</div>
            <div><strong>ID:</strong> {hoveredPoint.id}</div>
          </div>
        </div>
      )}
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
        Gene Expression Embedding Space
      </h1>
      <p className="roboto-slab-regular text-base text-gray-semidark max-w-2xl mx-auto leading-relaxed">
        Interactive visualization of learned representations from zebrafish drug-exposure experiments. 
        Each point represents a cellular state, clustered by treatment response patterns.
      </p>
    </div>
    
    {/* Visualization */}
    <div className="mb-8">
      <EmbeddingVisualization />
    </div>
    
    {/* Legend */}
    <div className="flex flex-wrap justify-center gap-6 mb-8">
      {[
        { color: '#333333', label: 'Control' },
        { color: '#666666', label: 'Treatment A' },
        { color: '#999999', label: 'Treatment B' },
        { color: '#444444', label: 'Treatment C' }
      ].map(item => (
        <div key={item.label} className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: item.color }}
          ></div>
          <span className="roboto-slab-regular text-sm text-gray-semidark">
            {item.label}
          </span>
        </div>
      ))}
    </div>
    
    {/* Description */}
    <div className="max-w-2xl text-center">
      <p className="roboto-slab-regular text-sm text-gray-medium leading-relaxed">
        Hover over points to explore individual cellular states. This embedding space reveals 
        how our foundation model clusters gene expression patterns, enabling zero-shot 
        predictions for novel therapeutic compounds.
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
        Gene Expression Embedding Space
      </h1>
      <p className="roboto-slab-regular text-sm text-gray-semidark leading-relaxed">
        Interactive visualization of learned representations from zebrafish drug-exposure experiments.
      </p>
    </div>
    
    {/* Visualization - Smaller for mobile */}
    <div className="mb-6 scale-75">
      <EmbeddingVisualization />
    </div>
    
    {/* Legend */}
    <div className="grid grid-cols-2 gap-3 mb-6">
      {[
        { color: '#333333', label: 'Control' },
        { color: '#666666', label: 'Treatment A' },
        { color: '#999999', label: 'Treatment B' },
        { color: '#444444', label: 'Treatment C' }
      ].map(item => (
        <div key={item.label} className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: item.color }}
          ></div>
          <span className="roboto-slab-regular text-xs text-gray-semidark">
            {item.label}
          </span>
        </div>
      ))}
    </div>
    
    {/* Description */}
    <div className="text-center">
      <p className="roboto-slab-regular text-xs text-gray-medium leading-relaxed">
        Tap points to explore cellular states. This embedding reveals how our model 
        clusters expression patterns for zero-shot therapeutic predictions.
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