// @ts-nocheck
import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import '@google/model-viewer';
import { Box, Info, Video, Volume2, Link2, Image as ImageIcon } from 'lucide-react';
import { Hotspot } from '../types';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': any;
    }
  }
}

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
  const innerRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    get element() {
      return innerRef.current;
    },
    positionAndNormalFromPoint: (x: number, y: number) => {
      return innerRef.current?.positionAndNormalFromPoint?.(x, y);
    },
    getBoundingClientRect: () => {
      return innerRef.current?.getBoundingClientRect?.();
    },
    resetCamera: () => {
      if (innerRef.current) {
        innerRef.current.cameraOrbit = '0deg 75deg 105%';
        innerRef.current.cameraTarget = 'auto auto auto';
        innerRef.current.fieldOfView = 'auto';
      }
    },
    focusHotspot: (hs: Hotspot) => {
      if (innerRef.current && hs.position) {
        innerRef.current.cameraTarget = hs.position;
      }
    }
  }));

  return (
    <model-viewer
      ref={innerRef}
      src={src}
      ar
      ar-modes="webxr scene-viewer quick-look"
      ar-scale="auto"
      camera-controls
      touch-action="pan-y"
      interaction-prompt="auto"
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
          className="min-w-[44px] min-h-[44px] flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group focus:outline-none"
          slot={`hotspot-${hs.id}`}
          data-position={hs.position}
          data-normal={hs.normal}
          onClick={(e) => {
            e.stopPropagation();
            onHotspotClick?.(hs, e);
          }}
          aria-label={hs.title || 'Marcador AR'}
        >
          <div className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center transition-all duration-200 group-hover:scale-125 shadow-lg ${
            selectedHotspotId === hs.id 
              ? 'bg-lion-orange scale-125 ring-4 ring-lion-orange/40' 
              : 'bg-lion-tech-blue'
          }`}>
            {hs.type === 'info' && <Info className="w-3.5 h-3.5 text-white" />}
            {hs.type === 'video' && <Video className="w-3.5 h-3.5 text-white" />}
            {hs.type === 'audio' && <Volume2 className="w-3.5 h-3.5 text-white" />}
            {hs.type === 'link' && <Link2 className="w-3.5 h-3.5 text-white" />}
            {hs.type === 'image' && <ImageIcon className="w-3.5 h-3.5 text-white" />}
          </div>
        </button>
      ))}

      <div 
        slot="ar-button" 
        className="absolute bottom-6 right-4 sm:right-6 bg-lion-tech-blue hover:bg-blue-600 active:bg-blue-700 text-white min-h-[48px] px-5 py-3 rounded-2xl font-semibold shadow-2xl transition-all flex gap-2.5 items-center cursor-pointer z-30 backdrop-blur-xl border border-white/25 active:scale-95"
      >
        <Box className="w-5 h-5 text-white" />
        <span className="text-sm tracking-wide">Abrir em Realidade Aumentada</span>
      </div>
    </model-viewer>
  );
});

ARViewer.displayName = 'ARViewer';

export default ARViewer;

