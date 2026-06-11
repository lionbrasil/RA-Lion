export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  modelUrl: string;
  modelFormat: string;
  thumbnailUrl?: string;
  backgroundColor: string;
  isPublic: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface Hotspot {
  id: string;
  projectId: string;
  position: string; // e.g., "0 0.5 0"
  normal: string;   // e.g., "0 1 0"
  title: string;
  description: string;
  type: "info" | "video" | "audio" | "link";
  mediaUrl?: string;
  linkUrl?: string;
  color?: string;
  createdAt: any;
  updatedAt: any;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': any;
    }
  }
}
