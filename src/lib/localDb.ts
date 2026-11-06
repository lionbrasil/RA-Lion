import { get, set, del } from 'idb-keyval';
import { v4 as uuidv4 } from 'uuid';
import { Project, Hotspot } from '../types';

export const getLocalProjects = async (): Promise<Project[]> => (await get('projects')) || [];
export const setLocalProjects = async (projects: Project[]) => await set('projects', projects);

export const getLocalProject = async (id: string): Promise<Project | null> => {
  const projects = await getLocalProjects();
  return projects.find(p => p.id === id) || null;
};

export const createLocalProject = async (ownerId: string): Promise<string> => {
  const id = uuidv4();
  const newProject: Partial<Project> = {
    id,
    ownerId,
    name: 'Novo Projeto Industrial (Local)',
    description: 'Descrição do equipamento',
    modelUrl: '',
    modelFormat: '',
    backgroundColor: '#15181E',
    isPublic: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const projects = await getLocalProjects();
  await setLocalProjects([...projects, newProject as Project]);
  return id;
};

export const updateLocalProject = async (id: string, updates: Partial<Project>) => {
  const projects = await getLocalProjects();
  const index = projects.findIndex(p => p.id === id);
  if (index > -1) {
    projects[index] = { ...projects[index], ...updates, updatedAt: new Date().toISOString() };
    await setLocalProjects(projects);
  }
};

export const deleteLocalProject = async (id: string) => {
  const projects = await getLocalProjects();
  await setLocalProjects(projects.filter(p => p.id !== id));
  await del(`model_${id}`);
};

export const getLocalHotspots = async (projectId: string): Promise<Hotspot[]> => {
  const all: Hotspot[] = (await get('hotspots')) || [];
  return all.filter(h => h.projectId === projectId);
};

export const addLocalHotspot = async (projectId: string, position: string, normal: string): Promise<Hotspot> => {
  const id = uuidv4();
  const hs: Hotspot = {
    id,
    projectId,
    position,
    normal,
    title: 'Nova Informação',
    description: 'Descreva este componente...',
    type: 'info',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const all: Hotspot[] = (await get('hotspots')) || [];
  await set('hotspots', [...all, hs]);
  return hs;
};

export const updateLocalHotspot = async (id: string, updates: Partial<Hotspot>) => {
  const all: Hotspot[] = (await get('hotspots')) || [];
  const index = all.findIndex(h => h.id === id);
  if (index > -1) {
    all[index] = { ...all[index], ...updates, updatedAt: new Date().toISOString() };
    await set('hotspots', all);
  }
};

export const deleteLocalHotspot = async (id: string) => {
  const all: Hotspot[] = (await get('hotspots')) || [];
  await set('hotspots', all.filter(h => h.id !== id));
};

export const saveLocalModel = async (projectId: string, file: File) => {
  await set(`model_${projectId}`, file);
  return URL.createObjectURL(file);
};

export const getLocalModelUrl = async (projectId: string) => {
  const file: File | undefined = await get(`model_${projectId}`);
  if (file) return URL.createObjectURL(file);
  return null;
};

export const saveLocalThumbnail = async (projectId: string, blob: Blob) => {
  await set(`thumbnail_${projectId}`, blob);
  return URL.createObjectURL(blob);
};

export const exportProjectData = async (projectId: string) => {
  const project = await getLocalProject(projectId);
  const hotspots = await getLocalHotspots(projectId);
  const modelFile: File | undefined = await get(`model_${projectId}`);
  const thumbnailBlob: Blob | undefined = await get(`thumbnail_${projectId}`);

  const toBase64 = (blob: Blob) => new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  const modelBase64 = modelFile ? await toBase64(modelFile) : null;
  const thumbnailBase64 = thumbnailBlob ? await toBase64(thumbnailBlob) : null;

  const exportData = {
    project,
    hotspots,
    modelBase64,
    thumbnailBase64,
    modelType: modelFile?.type || '',
    modelName: modelFile?.name || '',
    thumbnailType: thumbnailBlob?.type || ''
  };

  const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `project_${projectId}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const importProjectData = async (file: File) => {
  const text = await file.text();
  const data = JSON.parse(text);

  const fromBase64 = async (b64: string, type: string, name?: string) => {
    const res = await fetch(b64);
    const blob = await res.blob();
    return name ? new File([blob], name, { type }) : blob;
  };

  if (data.project) {
    const existing = await getLocalProjects();
    const filtered = existing.filter(p => p.id !== data.project.id);
    await setLocalProjects([...filtered, data.project]);
  }

  if (data.hotspots) {
    const existingH = (await get('hotspots')) as Hotspot[] || [];
    const filteredH = existingH.filter(h => h.projectId !== data.project.id);
    await set('hotspots', [...filteredH, ...data.hotspots]);
  }

  if (data.modelBase64) {
    const model = await fromBase64(data.modelBase64, data.modelType, data.modelName);
    await set(`model_${data.project.id}`, model);
  }

  if (data.thumbnailBase64) {
    const thumb = await fromBase64(data.thumbnailBase64, data.thumbnailType);
    await set(`thumbnail_${data.project.id}`, thumb);
  }
};

export const transferProjectToMatrix = async (projectId: string) => {
  const project = await getLocalProject(projectId);
  if (!project) throw new Error('Projeto local não encontrado.');

  const hotspots = await getLocalHotspots(projectId);
  const modelFile: File | undefined = await get(`model_${projectId}`);
  const thumbnailBlob: Blob | undefined = await get(`thumbnail_${projectId}`);

  const toBase64 = (blob: Blob) =>
    new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

  let modelBase64 = null;
  let modelType = '';
  let modelName = '';
  if (modelFile) {
    modelBase64 = await toBase64(modelFile);
    modelType = modelFile.type || 'model/gltf-binary';
    modelName = modelFile.name || `model_${projectId}.glb`;
  }

  let thumbnailBase64 = null;
  let thumbnailType = '';
  if (thumbnailBlob) {
    thumbnailBase64 = await toBase64(thumbnailBlob);
    thumbnailType = thumbnailBlob.type || 'image/png';
  }

  const res = await fetch('/api/matrix/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project,
      hotspots,
      modelBase64,
      modelType,
      modelName,
      thumbnailBase64,
      thumbnailType
    })
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Falha ao transferir projeto para a matriz.');
  }

  await updateLocalProject(projectId, {
    matrixLinked: true,
    matrixSyncedAt: data.matrixSyncedAt,
    matrixVersion: data.matrixVersion
  });

  return data;
};

export const syncProjectWithMatrix = async (projectId: string) => {
  const project = await getLocalProject(projectId);
  if (!project) throw new Error('Projeto não encontrado');
  const hotspots = await getLocalHotspots(projectId);

  const res = await fetch(`/api/matrix/sync/${projectId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: project.name,
      description: project.description,
      backgroundColor: project.backgroundColor,
      trainingSteps: project.trainingSteps,
      hotspots
    })
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Falha ao sincronizar com a matriz.');
  }

  await updateLocalProject(projectId, {
    matrixSyncedAt: data.matrixSyncedAt,
    matrixVersion: data.matrixVersion
  });

  return data;
};

export const fetchMatrixProject = async (id: string) => {
  const res = await fetch(`/api/matrix/projects/${id}`);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Projeto não encontrado na matriz.');
  }
  return data;
};

export const importProjectFromMatrix = async (matrixIdOrUrl: string, currentUserId?: string) => {
  const cleanId = matrixIdOrUrl.trim().replace(/^.*\/viewer\//, '').replace(/[?#].*$/, '');
  if (!cleanId) throw new Error('ID ou URL da matriz inválido.');

  const data = await fetchMatrixProject(cleanId);
  const p = data.project;

  const importedProject: Project = {
    ...p,
    id: p.id,
    ownerId: currentUserId || p.ownerId || 'guest',
    matrixLinked: true,
    matrixSyncedAt: data.matrixSyncedAt,
    matrixVersion: data.matrixVersion,
    matrixSourceId: cleanId,
    modelUrl: data.modelUrl || `/api/matrix/models/${cleanId}`
  };

  const existing = await getLocalProjects();
  const filtered = existing.filter(x => x.id !== p.id);
  await setLocalProjects([...filtered, importedProject]);

  if (data.hotspots) {
    const existingH = (await get('hotspots')) as Hotspot[] || [];
    const filteredH = existingH.filter(h => h.projectId !== p.id);
    await set('hotspots', [...filteredH, ...data.hotspots]);
  }

  try {
    const modelFetch = await fetch(`/api/matrix/models/${cleanId}`);
    if (modelFetch.ok) {
      const blob = await modelFetch.blob();
      const filename = `model_${cleanId}.${p.modelFormat || 'glb'}`;
      const file = new File([blob], filename, { type: blob.type || 'model/gltf-binary' });
      await set(`model_${cleanId}`, file);
    }
  } catch (err) {
    console.warn('Could not cache matrix model locally, will stream from server:', err);
  }

  return importedProject;
};

export const getMatrixProjectsList = async () => {
  const res = await fetch('/api/matrix/projects');
  const data = await res.json();
  if (!res.ok || data.error) return [];
  return data.projects || [];
};

