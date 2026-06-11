import React, { forwardRef } from 'react';
import '@google/model-viewer';
import { Box, Info, Video, Volume2, Link2, Image as ImageIcon } from 'lucide-react';
import { Hotspot } from '../types';

interface ARViewerProps {
  src: string;
  backgroundColor?: string;
  hotspots?: Hotspot[];
  selectedHotspotId?: string;
  onHotspotClick?: (hotspot: Hotspot, e: React.MouseEvent<HTMLButtonElement>) => void;
  onModelClick?: (e: any) => void;
  viewOnly?: boolean;
}

const ARViewer = forwardRef<any, ARViewerProps>(({
  src,
  backgroundColor = 'transparent',
  hotspots = [],
  selectedHotspotId,
  onHotspotClick,
  onModelClick,
  viewOnly = false
}, ref) => {
  return (
    <model-viewer
      ref={ref}
      src={src}
      ar
      ar-modes="webxr scene-viewer quick-look"
      camera-controls
      shadow-intensity="1"
      environment-image="neutral"
      exposure="1"
      auto-rotate
      class="w-full h-full outline-none"
      onClick={onModelClick}
      style={{ backgroundColor }}
    >
      {hotspots.map((hs) => (
        <button
          key={hs.id}
          className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125 ${selectedHotspotId === hs.id ? 'bg-lion-orange scale-125' : 'bg-lion-tech-blue'}`}
          slot={`hotspot-${hs.id}`}
          data-position={hs.position}
          data-normal={hs.normal}
          onClick={(e) => {
            e.stopPropagation();
            onHotspotClick?.(hs, e);
          }}
        >
          {hs.type === 'info' && <Info className="w-3 h-3 text-white" />}
          {hs.type === 'video' && <Video className="w-3 h-3 text-white" />}
          {hs.type === 'audio' && <Volume2 className="w-3 h-3 text-white" />}
          {hs.type === 'link' && <Link2 className="w-3 h-3 text-white" />}
          {hs.type === 'image' && <ImageIcon className="w-3 h-3 text-white" />}
        </button>
      ))}

      <div slot="ar-button" className="absolute bottom-6 right-6 bg-lion-tech-blue text-white px-6 py-3 rounded-full font-medium shadow-lg hover:bg-blue-600 transition-colors flex gap-2 items-center cursor-pointer">
        <Box className="w-5 h-5" /> Visualizar em Realidade Aumentada
      </div>
    </model-viewer>
  );
});

ARViewer.displayName = 'ARViewer';

export default ARViewer;
