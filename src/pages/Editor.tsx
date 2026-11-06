import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  getLocalProject, 
  updateLocalProject, 
  getLocalHotspots, 
  addLocalHotspot, 
  updateLocalHotspot, 
  deleteLocalHotspot, 
  saveLocalModel, 
  getLocalModelUrl, 
  saveLocalThumbnail, 
  exportProjectData,
  deleteLocalProject,
  transferProjectToMatrix,
  syncProjectWithMatrix,
  fetchMatrixProject,
  getLocalProjects,
  createLocalProject
} from '../lib/localDb';
import { useAuth } from '../context/AuthContext';
import { Project, Hotspot } from '../types';
import { 
  UploadCloud, 
  Plus, 
  Share2, 
  X, 
  Sparkles, 
  Loader2, 
  ImagePlus, 
  Download, 
  Info, 
  Video, 
  Volume2, 
  Link2,
  Home,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Trash2,
  Network,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Code2,
  Smartphone,
  CheckCircle2,
  SlidersHorizontal
} from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { useDropzone } from 'react-dropzone';
import ARViewer from '../components/ARViewer';

export default function Editor({ viewOnly = false }: { viewOnly?: boolean }) {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<Project | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [isAddingHotspot, setIsAddingHotspot] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [thumbAspectRatio, setThumbAspectRatio] = useState('16:9');
  const [thumbImageSize, setThumbImageSize] = useState('1K');
  
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasCopiedEmbed, setHasCopiedEmbed] = useState(false);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);
  const [hasCopiedApi, setHasCopiedApi] = useState(false);
  const [matrixActiveTab, setMatrixActiveTab] = useState<'webar' | 'embed' | 'api' | 'sync'>('webar');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  
  const modelRef = useRef<any>(null);
  useEffect(() => {
    if (!projectId) {
      if (!viewOnly) {
        getLocalProjects().then(async (list) => {
          if (list.length > 0) {
            navigate(`/editor/${list[0].id}`, { replace: true });
          } else if (user) {
            const newId = await createLocalProject(user.uid);
            navigate(`/editor/${newId}`, { replace: true });
          }
        });
      }
      return;
    }

    const loadData = async () => {
      let p = await getLocalProject(projectId);
      if (p) {
        if (p.modelFormat) {
          const url = await getLocalModelUrl(projectId);
          if (url) p.modelUrl = url;
        }
        setProject(p);
        const hs = await getLocalHotspots(projectId);
        setHotspots(hs);
      } else {
        // If not in local IndexedDB (e.g. mobile browser scanning QR or external app), fetch from Matrix Hub!
        try {
          const matrixData = await fetchMatrixProject(projectId);
          if (matrixData && matrixData.project) {
            const mp: Project = {
              ...matrixData.project,
              modelUrl: matrixData.modelUrl || `/api/matrix/models/${projectId}`,
              thumbnailUrl: matrixData.thumbnailUrl || `/api/matrix/thumbnails/${projectId}`,
              matrixLinked: true,
              matrixSyncedAt: matrixData.matrixSyncedAt,
              matrixVersion: matrixData.matrixVersion
            };
            setProject(mp);
            setHotspots(matrixData.hotspots || []);
            toast.success("Carregado via Vínculo Matriz!");
          } else {
            toast.error("Projeto não encontrado na Matriz.");
          }
        } catch (err) {
          console.warn("Projeto não localizado na Matriz:", err);
          if (!viewOnly) {
            toast.error("Projeto não encontrado.");
          }
        }
      }
    };
    loadData();
  }, [projectId]);

  const handleUpdateProjectSettings = async (updates: Partial<Project>) => {
    if (!project) return;
    setProject({ ...project, ...updates });
    try {
      await updateLocalProject(project.id, updates);
    } catch(e) {
      toast.error("Erro ao atualizar projeto");
    }
  };

  // Navigation Handlers: Home, Voltar, Avançar, Resetar, Deletar
  const handlePreviousHotspot = () => {
    if (hotspots.length === 0) return;
    if (!selectedHotspot) {
      const last = hotspots[hotspots.length - 1];
      setSelectedHotspot(last);
      modelRef.current?.focusHotspot?.(last);
      return;
    }
    const idx = hotspots.findIndex(h => h.id === selectedHotspot.id);
    const prevIdx = idx > 0 ? idx - 1 : hotspots.length - 1;
    const target = hotspots[prevIdx];
    setSelectedHotspot(target);
    modelRef.current?.focusHotspot?.(target);
  };

  const handleNextHotspot = () => {
    if (hotspots.length === 0) return;
    if (!selectedHotspot) {
      const first = hotspots[0];
      setSelectedHotspot(first);
      modelRef.current?.focusHotspot?.(first);
      return;
    }
    const idx = hotspots.findIndex(h => h.id === selectedHotspot.id);
    const nextIdx = idx < hotspots.length - 1 ? idx + 1 : 0;
    const target = hotspots[nextIdx];
    setSelectedHotspot(target);
    modelRef.current?.focusHotspot?.(target);
  };

  const handleResetCamera = () => {
    modelRef.current?.resetCamera?.();
    setSelectedHotspot(null);
    toast.success('Orientação 3D e câmera resetadas');
  };

  const handleDeleteAction = async () => {
    if (selectedHotspot) {
      if (!confirm(`Remover o marcador "${selectedHotspot.title}"?`)) return;
      try {
        await deleteLocalHotspot(selectedHotspot.id);
        setHotspots(prev => prev.filter(h => h.id !== selectedHotspot.id));
        setSelectedHotspot(null);
        toast.success('Marcador removido.');
      } catch (e) {
        toast.error('Erro ao remover marcador.');
      }
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const handleConfirmDeleteProject = async () => {
    if (!project) return;
    try {
      await deleteLocalProject(project.id);
      toast.success('Projeto excluído com sucesso.');
      navigate('/');
    } catch (e) {
      toast.error('Erro ao excluir projeto.');
    }
  };

  // Matrix Hub Commands (Transferir, Manter Vínculo, Sincronizar)
  const handleExecuteMatrixTransfer = async () => {
    if (!project) return;
    setIsTransferring(true);
    try {
      const result = await transferProjectToMatrix(project.id);
      setProject(prev => prev ? {
        ...prev,
        matrixLinked: true,
        matrixSyncedAt: result.matrixSyncedAt,
        matrixVersion: result.matrixVersion
      } : null);
      toast.success('Comando executado! Projeto transferido para a Matriz com vínculo ativo.');
    } catch (err: any) {
      toast.error('Erro ao transferir para Matriz: ' + err.message);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleSyncMatrix = async () => {
    if (!project) return;
    setIsSyncing(true);
    try {
      const result = await syncProjectWithMatrix(project.id);
      setProject(prev => prev ? {
        ...prev,
        matrixSyncedAt: result.matrixSyncedAt,
        matrixVersion: result.matrixVersion
      } : null);
      toast.success('Vínculo com a Matriz sincronizado com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao sincronizar com Matriz: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (viewOnly || !project) return;
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.name.match(/\.(glb|gltf|png|jpe?g)$/i)) {
      toast.error('Formatos .glb, .gltf, .png e .jpg suportados no navegador.');
      return;
    }

    setIsUploading(true);
    let prog = 0;
    const interval = setInterval(() => { prog += 10; setUploadProgress(prog); if(prog >= 100) clearInterval(interval); }, 150);
    
    try {
        const localUrl = await saveLocalModel(projectId!, file);
        await updateLocalProject(projectId!, { modelFormat: file.name.split('.').pop() });
        
        clearInterval(interval);
        setUploadProgress(100);
        setProject(prev => prev ? { ...prev, modelUrl: localUrl } : null);
        setIsUploading(false);
        setUploadProgress(0);
        toast.success('Upload concluído!');
    } catch (e) {
        toast.error("Erro ao salvar o arquivo.");
        setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'model/gltf-binary': ['.glb'],
      'model/gltf+json': ['.gltf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg']
    } as any,
    maxFiles: 1,
    disabled: isUploading || viewOnly,
  });

  const handleModelClick = async (event: any) => {
    if (viewOnly || !isAddingHotspot || !project) return;
    
    let hitPositionX, hitPositionY, hitPositionZ = '0';
    let hitNormalX = '0', hitNormalY = '1', hitNormalZ = '0';

    if (project.modelFormat && ['png', 'jpg', 'jpeg'].includes(project.modelFormat.toLowerCase())) {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        hitPositionX = ((x / rect.width) * 100).toFixed(2);
        hitPositionY = ((y / rect.height) * 100).toFixed(2);
    } else {
        if (!modelRef.current) return;
        const rect = modelRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const hit = modelRef.current.positionAndNormalFromPoint(x, y);
        if (!hit) {
          toast.error('Clique diretamente no modelo para adicionar o marcador.');
          return;
        }
        hitPositionX = hit.position.x;
        hitPositionY = hit.position.y;
        hitPositionZ = hit.position.z;
        hitNormalX = hit.normal.x;
        hitNormalY = hit.normal.y;
        hitNormalZ = hit.normal.z;
    }

    try {
      const hs = await addLocalHotspot(project.id, `${hitPositionX} ${hitPositionY} ${hitPositionZ}`, `${hitNormalX} ${hitNormalY} ${hitNormalZ}`);
      setHotspots(prev => [...prev, hs]);
      setIsAddingHotspot(false);
      toast.success('Marcador adicionado!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao adicionar marcador.');
    }
  };

  const handleUpdateHotspot = async (hotspotId: string, updates: Partial<Hotspot>) => {
    if (viewOnly || !project) return;
    try {
      await updateLocalHotspot(hotspotId, updates);
      setHotspots(prev => prev.map(h => h.id === hotspotId ? { ...h, ...updates } : h));
      
      if (selectedHotspot && selectedHotspot.id === hotspotId) {
        setSelectedHotspot(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (e) {
      toast.error('Erro ao atualizar marcador');
    }
  };

  const generateAIDescription = async () => {
    if (!selectedHotspot || !selectedHotspot.title) {
       toast.error("O marcador precisa de um título.");
       return;
    }
    setIsGeneratingAI(true);
    try {
       let imageBase64 = null;
       if (selectedHotspot.type === 'image' && selectedHotspot.mediaUrl) {
          try {
             const response = await fetch(selectedHotspot.mediaUrl);
             const blob = await response.blob();
             const reader = new FileReader();
             imageBase64 = await new Promise((resolve) => {
                 reader.onloadend = () => resolve(reader.result);
                 reader.readAsDataURL(blob);
             });
          } catch(e) {
             console.log("Could not fetch image for AI analysis", e);
          }
       }

       const res = await fetch('/api/analyze-hotspot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
             title: selectedHotspot.title, 
             description: selectedHotspot.description,
             projectContext: project?.name,
             imageBase64: imageBase64
          })
       });
       const data = await res.json();
       
       if (data.error) throw new Error(data.error);

       if (data.result) {
          try {
             // It might come back wrapped in markdown blocks if not handled carefully
             const cleanJsonString = data.result.replace(/```json\n?|\n?```/gi, '').trim();
             const parsed = JSON.parse(cleanJsonString);
             await handleUpdateHotspot(selectedHotspot.id, { 
                 title: parsed.title || selectedHotspot.title,
                 description: parsed.description || data.result 
             });
          } catch(err) {
             await handleUpdateHotspot(selectedHotspot.id, { description: data.result });
          }
          toast.success("Informações aprimoradas pela IA!");
       }
    } catch (e) {
       console.error(e);
       toast.error("Erro na geração via IA.");
    } finally {
       setIsGeneratingAI(false);
    }
  };

  const generateThumbnail = async () => {
    if (!project) return;
    setIsGeneratingThumbnail(true);
    try {
      const res = await fetch('/api/generate-thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           prompt: project.name + (project.description ? ' - ' + project.description : ''),
           aspectRatio: thumbAspectRatio,
           imageSize: thumbImageSize
        })
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      if (data.imageBase64) {
        const fetchRes = await fetch(data.imageBase64);
        const blob = await fetchRes.blob();
        const localUrl = await saveLocalThumbnail(project.id, blob);
        await handleUpdateProjectSettings({ thumbnailUrl: localUrl });
        toast.success("Thumbnail gerado com sucesso via IA!");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Falha ao gerar o thumbnail.");
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  const downloadQRCode = (elementId: string) => {
    const svg = document.getElementById(elementId);
    if (!svg) {
      toast.error("QR Code não encontrado.");
      return;
    }
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      if (ctx) {
         ctx.fillStyle = "white";
         ctx.fillRect(0, 0, canvas.width, canvas.height);
         ctx.drawImage(img, 0, 0);
         const pngFile = canvas.toDataURL("image/png");
         
         const downloadLink = document.createElement("a");
         downloadLink.download = `QR-${project?.name || 'Projeto'}.png`;
         downloadLink.href = pngFile;
         downloadLink.click();
      }
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };
  
  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project) return;
    
    if (!file.type.startsWith('image/')) {
       toast.error("Formato inválido. Envie JPG ou PNG.");
       return;
    }
    
    setIsGeneratingThumbnail(true);
    try {
      const localUrl = await saveLocalThumbnail(project.id, file as any);
      await handleUpdateProjectSettings({ thumbnailUrl: localUrl });
      toast.success("Thumbnail anexado com sucesso!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao fazer upload da imagem.");
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  const handleHotspotMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project || !selectedHotspot) return;
    
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
       toast.error("Formato inválido. Envie JPG ou PNG.");
       return;
    }

    try {
        toast.info("Fazendo upload...");
        const localUrl = URL.createObjectURL(file);
        await handleUpdateHotspot(selectedHotspot.id, { mediaUrl: localUrl, type: 'image' });
        toast.success("Imagem anexada com sucesso!");
    } catch (err: any) {
        toast.error("Erro ao fazer upload.");
    }
  };
  
  const handleDeleteHotspot = async (hotspotId: string) => {
    if (viewOnly || !project || !confirm("Remover este marcador?")) return;
    try {
      await deleteLocalHotspot(hotspotId);
      setHotspots(prev => prev.filter(h => h.id !== hotspotId));
      setSelectedHotspot(null);
      toast.success('Marcador removido');
    } catch (e) {
      toast.error('Erro ao remover');
    }
  };

  const renderPropertiesContent = () => {
    if (selectedHotspot) {
      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Informações</h3>
            {!viewOnly && (
              <button 
                onClick={() => setSelectedHotspot(null)} 
                className="text-lion-tech-blue text-xs font-bold uppercase min-h-[36px] px-2 flex items-center"
              >
                Voltar
              </button>
            )}
          </div>
          
          {viewOnly ? (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white">{selectedHotspot.title}</h2>
              <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{selectedHotspot.description}</p>
              
              {selectedHotspot.type === 'video' && selectedHotspot.mediaUrl && (
                <div className="rounded-lg overflow-hidden border border-gray-800 mt-4">
                  <video src={selectedHotspot.mediaUrl} controls className="w-full" />
                </div>
              )}

              {selectedHotspot.type === 'image' && selectedHotspot.mediaUrl && (
                <div className="rounded-lg overflow-hidden border border-gray-800 mt-4">
                  <img src={selectedHotspot.mediaUrl} alt="Hotspot anexo" className="w-full object-cover" />
                </div>
              )}

              {selectedHotspot.type === 'audio' && selectedHotspot.mediaUrl && (
                <div className="bg-lion-black p-4 rounded-lg border border-gray-800 mt-4">
                  <audio src={selectedHotspot.mediaUrl} controls className="w-full" />
                </div>
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Título</label>
                <input 
                  type="text" 
                  value={selectedHotspot.title} 
                  onChange={e => handleUpdateHotspot(selectedHotspot.id, { title: e.target.value })} 
                  className="w-full bg-lion-black border border-gray-800 rounded p-2 text-sm focus:border-lion-tech-blue outline-none text-white" 
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Descrição / Procedimento</label>
                <textarea 
                  value={selectedHotspot.description} 
                  onChange={e => handleUpdateHotspot(selectedHotspot.id, { description: e.target.value })} 
                  rows={4} 
                  className="w-full bg-lion-black border border-gray-800 rounded p-2 text-sm focus:border-lion-tech-blue outline-none resize-none text-white" 
                />
                <button 
                  onClick={generateAIDescription} 
                  disabled={isGeneratingAI} 
                  className="mt-2 text-xs font-medium text-lion-tech-blue hover:text-blue-400 flex items-center gap-1 transition-colors min-h-[36px]"
                >
                  {isGeneratingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Gerar via IA (Gemini)
                </button>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Tipo de Interação</label>
                <select 
                  value={selectedHotspot.type} 
                  onChange={e => handleUpdateHotspot(selectedHotspot.id, { type: e.target.value as any })} 
                  className="w-full bg-lion-black border border-gray-800 rounded p-2 text-sm focus:border-lion-tech-blue outline-none text-white"
                >
                  <option value="info">Texto / Informação</option>
                  <option value="image">Imagem</option>
                  <option value="video">Vídeo</option>
                  <option value="audio">Áudio (Efeito/Narração)</option>
                  <option value="link">Link Externo</option>
                </select>
              </div>
              
              {(selectedHotspot.type === 'video' || selectedHotspot.type === 'audio' || selectedHotspot.type === 'link' || selectedHotspot.type === 'image') && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">URL (Mídia ou Link) ou Anexar</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={selectedHotspot.mediaUrl || selectedHotspot.linkUrl || ''} 
                      onChange={e => handleUpdateHotspot(selectedHotspot.id, selectedHotspot.type === 'link' ? { linkUrl: e.target.value } : { mediaUrl: e.target.value })} 
                      placeholder="https://" 
                      className="w-full bg-lion-black border border-gray-800 rounded p-2 text-sm focus:border-lion-tech-blue outline-none text-white" 
                    />
                    {(selectedHotspot.type === 'image') && (
                      <label className="bg-lion-graphite hover:bg-lion-graphite-light text-lion-tech-blue px-3 rounded border border-[#2D333B] flex items-center justify-center cursor-pointer transition-colors min-w-[44px] min-h-[44px]" title="Anexar Imagem">
                        <UploadCloud className="w-4 h-4" />
                        <input type="file" accept="image/png, image/jpeg, image/jpg" className="hidden" onChange={handleHotspotMediaUpload} />
                      </label>
                    )}
                  </div>
                  {(selectedHotspot.type === 'image' && selectedHotspot.mediaUrl) && (
                    <div className="mt-2 text-center rounded border border-gray-800 overflow-hidden relative">
                      <img src={selectedHotspot.mediaUrl} alt="Preview do anexo" className="w-full max-h-[140px] object-cover" />
                      <button onClick={() => handleUpdateHotspot(selectedHotspot.id, { mediaUrl: '' })} className="absolute top-2 right-2 bg-black/70 text-white p-1 rounded-full hover:bg-red-500 min-w-[28px] min-h-[28px] flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-lion-graphite-light flex justify-between gap-3">
                <button onClick={() => handleDeleteHotspot(selectedHotspot.id)} className="text-red-400 text-sm hover:underline min-h-[44px] px-2">
                  Remover Marcador
                </button>
                <button 
                  onClick={() => { setSelectedHotspot(null); setShowMobileDrawer(false); }} 
                  className="bg-lion-tech-blue text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-600 min-h-[44px]"
                >
                  Concluído
                </button>
              </div>
            </>
          )}
        </div>
      );
    }

    if (!viewOnly && project) {
      return (
        <div className="space-y-7">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Configurações Gerais</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Nome do Equipamento</label>
                <input 
                  type="text" 
                  value={project.name} 
                  onChange={(e) => handleUpdateProjectSettings({ name: e.target.value })} 
                  className="w-full bg-lion-black border border-lion-graphite-light rounded p-2 text-sm text-gray-200 mt-1 focus:border-lion-tech-blue outline-none" 
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase">Cor de Fundo</label>
                <div className="flex gap-2 mt-1">
                  <input 
                    type="color" 
                    value={project.backgroundColor} 
                    onChange={(e) => handleUpdateProjectSettings({ backgroundColor: e.target.value })} 
                    className="w-10 h-10 rounded cursor-pointer bg-lion-black border border-lion-graphite-light outline-none" 
                  />
                  <input 
                    type="text" 
                    value={project.backgroundColor} 
                    readOnly 
                    className="flex-1 bg-lion-black border border-lion-graphite-light rounded px-2 text-sm text-gray-400 outline-none" 
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase mb-1 block">Thumbnail (Preview)</label>
                <div className="bg-lion-black border border-lion-graphite-light rounded-lg overflow-hidden relative group">
                  {project.thumbnailUrl ? (
                    <div className="aspect-video relative">
                      <img src={project.thumbnailUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-sm gap-2.5 px-4">
                        <div className="flex gap-2 w-full max-w-[200px]">
                          <select value={thumbAspectRatio} onChange={e => setThumbAspectRatio(e.target.value)} className="bg-lion-graphite text-xs text-white p-1 rounded border border-gray-600 flex-1">
                            <option value="1:1">1:1</option>
                            <option value="4:3">4:3</option>
                            <option value="16:9">16:9</option>
                            <option value="21:9">21:9</option>
                            <option value="3:4">3:4</option>
                            <option value="9:16">9:16</option>
                            <option value="2:3">2:3</option>
                            <option value="3:2">3:2</option>
                          </select>
                          <select value={thumbImageSize} onChange={e => setThumbImageSize(e.target.value)} className="bg-lion-graphite text-xs text-white p-1 rounded border border-gray-600 flex-1">
                            <option value="1K">1K</option>
                            <option value="2K">2K</option>
                            <option value="4K">4K</option>
                          </select>
                        </div>
                        <button onClick={generateThumbnail} disabled={isGeneratingThumbnail} className="bg-lion-tech-blue text-white w-full max-w-[200px] text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-600 py-2 rounded min-h-[40px]">
                          {isGeneratingThumbnail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          Regerar IA
                        </button>
                        <label className="text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:text-lion-tech-blue cursor-pointer bg-lion-graphite w-full max-w-[200px] justify-center py-2 rounded border border-gray-600 min-h-[40px]">
                          <UploadCloud className="w-4 h-4" />
                          Anexar Imagem
                          <input type="file" accept="image/png, image/jpeg, image/jpg" className="hidden" onChange={handleThumbnailUpload} />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video flex flex-col items-center justify-center p-4">
                      <ImagePlus className="w-8 h-8 text-lion-graphite-light mb-2" />
                      <div className="flex gap-2 w-full max-w-[200px] mb-2">
                        <select value={thumbAspectRatio} onChange={e => setThumbAspectRatio(e.target.value)} className="bg-lion-graphite text-xs text-white p-2 rounded border border-gray-600 flex-1">
                          <option value="1:1">1:1</option>
                          <option value="4:3">4:3</option>
                          <option value="16:9">16:9</option>
                          <option value="21:9">21:9</option>
                          <option value="3:4">3:4</option>
                          <option value="9:16">9:16</option>
                          <option value="2:3">2:3</option>
                          <option value="3:2">3:2</option>
                        </select>
                        <select value={thumbImageSize} onChange={e => setThumbImageSize(e.target.value)} className="bg-lion-graphite text-xs text-white p-2 rounded border border-gray-600 flex-1">
                          <option value="1K">1K</option>
                          <option value="2K">2K</option>
                          <option value="4K">4K</option>
                        </select>
                      </div>
                      <div className="flex gap-2 w-full max-w-[200px] flex-col">
                        <button onClick={generateThumbnail} disabled={isGeneratingThumbnail} className="w-full bg-lion-tech-blue hover:bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest py-2 px-4 rounded flex justify-center items-center gap-2 transition-colors min-h-[40px]">
                          {isGeneratingThumbnail ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          {isGeneratingThumbnail ? 'Gerando...' : 'Gerar com IA'}
                        </button>
                        <label className="w-full bg-lion-graphite hover:bg-[#3d444d] text-lion-tech-blue text-[10px] font-bold uppercase tracking-widest py-2 px-4 rounded border border-[#2D333B] flex justify-center items-center gap-2 transition-colors cursor-pointer min-h-[40px]">
                          <UploadCloud className="w-3 h-3" />
                          Fazer Upload
                          <input type="file" accept="image/png, image/jpeg, image/jpg" className="hidden" onChange={handleThumbnailUpload} />
                        </label>
                      </div>
                      <p className="text-[9px] text-gray-500 text-center mt-3">Gere com IA ou faça upload (PNG/JPG).</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Acesso Rápido e QR Code</h3>
            <div className="bg-lion-black border border-lion-graphite-light rounded-lg p-4 flex flex-col items-center">
              <div className="bg-white p-2 rounded mb-3">
                <QRCodeSVG id="project-qr-code-main" value={`${window.location.origin}/viewer/${project.id}`} size={120} />
              </div>
              <p className="text-[10px] text-gray-400 text-center mb-3">Escaneie com a câmera do celular para abrir o WebAR.</p>
              <div className="flex w-full gap-2">
                <button 
                  onClick={() => downloadQRCode('project-qr-code-main')} 
                  className="flex-1 bg-lion-graphite hover:bg-lion-graphite-light text-white text-[10px] font-bold uppercase tracking-widest py-2.5 px-3 rounded border border-[#2D333B] flex items-center justify-center gap-1 transition-colors min-h-[40px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/viewer/${project.id}`);
                    toast.success('Link copiado!');
                  }} 
                  className="flex-1 bg-lion-tech-blue/10 hover:bg-lion-tech-blue/20 text-lion-tech-blue border border-lion-tech-blue/30 text-[10px] font-bold uppercase tracking-widest py-2.5 px-3 flex items-center justify-center gap-1 rounded transition-colors min-h-[40px]"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Copiar Link
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Ferramentas Interativas</h3>
            <div className="space-y-2">
              {project.modelUrl ? (
                <button 
                  onClick={() => {
                    setIsAddingHotspot(!isAddingHotspot);
                    setShowMobileDrawer(false);
                    if (!isAddingHotspot) {
                      toast.info("Toque no modelo 3D para posicionar o marcador.");
                    }
                  }}
                  className={`w-full p-3.5 rounded-xl flex items-center justify-center gap-2 border transition-colors min-h-[48px] ${isAddingHotspot ? 'bg-lion-tech-blue/20 border-lion-tech-blue text-lion-tech-blue font-bold' : 'bg-lion-black border-lion-graphite-light hover:border-gray-600 text-gray-300'}`}
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">{isAddingHotspot ? 'Toque no modelo 3D...' : '+ Adicionar Marcador'}</span>
                </button>
              ) : (
                <p className="text-[10px] text-gray-500 italic uppercase">Faça upload para habilitar marcadores</p>
              )}
              <Link 
                to={`/training/${project.id}`}
                className="w-full p-3.5 rounded-xl flex items-center justify-center gap-2 border border-lion-graphite-light bg-lion-black hover:border-gray-600 text-lion-orange transition-colors min-h-[48px]"
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Sessão de Treinamento</span>
              </Link>
            </div>
          </div>
          
          {project.modelUrl && hotspots.length > 0 && (
            <div className="border-t border-lion-graphite-light pt-4 -mx-4 px-4 mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Scene Explorer ({hotspots.length})</h3>
              </div>
              <div className="space-y-1.5">
                {hotspots.map(hs => (
                  <button 
                    key={hs.id} 
                    onClick={() => {
                      setSelectedHotspot(hs);
                      modelRef.current?.focusHotspot?.(hs);
                    }} 
                    className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 group transition-colors min-h-[40px] ${selectedHotspot?.id === hs.id ? 'bg-lion-header border border-lion-tech-blue/40' : 'hover:bg-lion-header'}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-lion-tech-blue flex-shrink-0" />
                    <span className="text-xs text-gray-300 group-hover:text-white truncate pr-2 flex-1 font-medium">{hs.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (!project) return <div className="flex-1 flex items-center justify-center text-gray-400">Carregando...</div>;

  return (
    <div className="flex-1 flex flex-col lg:flex-row relative overflow-hidden bg-lion-black h-[calc(100dvh-3.5rem)] pb-14 md:pb-0">
      
      {/* 3D Model Area / Image Area */}
      <div className="flex-1 relative cursor-crosshair h-full overflow-hidden">

        {/* Top Responsive Header: Home, Project Title, Matriz Hub & Mobile Drawer Trigger */}
        <div className="absolute top-3 inset-x-3 z-40 flex items-center justify-between pointer-events-none">
          {/* Left: Home & Project Title */}
          <div className="flex items-center gap-2 pointer-events-auto bg-lion-black/90 backdrop-blur-md border border-lion-graphite-light p-1.5 rounded-2xl shadow-xl">
            <Link
              to="/"
              className="min-w-[40px] h-9 px-3 rounded-xl bg-lion-graphite hover:bg-[#3d444d] text-gray-200 text-xs font-semibold tracking-wider transition-colors border border-gray-700/50 flex items-center gap-1.5 active:scale-95"
              title="Ir para o Início / Dashboard"
            >
              <Home className="w-4 h-4 text-lion-tech-blue" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <div className="h-4 w-px bg-gray-700/70" />
            <span className="text-xs font-medium text-gray-300 max-w-[120px] sm:max-w-[200px] truncate px-1">
              {project.name}
            </span>
          </div>

          {/* Right: Matriz Hub Button + Mobile Drawer Toggle */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => setShowMatrixModal(true)}
              className={`h-9 px-3 rounded-xl text-xs font-bold transition-all border backdrop-blur-md flex items-center gap-1.5 shadow-xl active:scale-95 ${
                project.matrixLinked
                  ? 'bg-green-950/80 border-green-500/50 text-green-300 hover:bg-green-900/80'
                  : 'bg-lion-black/90 border-lion-tech-blue/50 text-lion-tech-blue hover:bg-lion-tech-blue/20 animate-pulse'
              }`}
              title="Transferir e Vincular a Outros Apps"
            >
              <Network className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {project.matrixLinked ? `Matriz v${project.matrixVersion || 1}` : 'Vínculo Matriz'}
              </span>
              <span className="md:hidden">Matriz</span>
            </button>

            {!viewOnly && (
              <button
                onClick={() => setShowMobileDrawer(!showMobileDrawer)}
                className="lg:hidden h-9 px-3 rounded-xl bg-lion-black/90 backdrop-blur-md border border-lion-graphite-light text-gray-200 hover:text-white text-xs font-bold flex items-center gap-1.5 shadow-xl active:scale-95"
                title="Abrir painel de propriedades"
              >
                <SlidersHorizontal className="w-4 h-4 text-lion-orange" />
                <span className="hidden xs:inline">Ajustes</span>
              </button>
            )}
          </div>
        </div>

        {/* Floating Bottom Navigation Controls: Voltar, Marcador Atual, Avançar, Resetar, Deletar */}
        <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 bg-lion-black/90 backdrop-blur-md border border-lion-graphite-light p-1.5 rounded-2xl shadow-2xl max-w-[calc(100vw-2rem)]">
          {/* Botão Voltar */}
          <button
            onClick={handlePreviousHotspot}
            disabled={hotspots.length === 0}
            className="min-w-[44px] h-10 px-3 rounded-xl bg-lion-graphite hover:bg-[#3d444d] disabled:opacity-30 disabled:pointer-events-none text-gray-200 text-xs font-medium transition-colors border border-gray-700/50 flex items-center justify-center gap-1 active:scale-95"
            title="Voltar / Marcador Anterior"
          >
            <ChevronLeft className="w-4 h-4 text-gray-300" />
            <span className="hidden sm:inline">Voltar</span>
          </button>

          {/* Hotspot indicator badge */}
          {hotspots.length > 0 && (
            <div className="px-2.5 py-1 text-[11px] font-mono text-gray-300 bg-lion-black rounded-lg border border-gray-800 select-none whitespace-nowrap">
              {selectedHotspot
                ? `${hotspots.findIndex(h => h.id === selectedHotspot.id) + 1}/${hotspots.length}`
                : `${hotspots.length} pts`}
            </div>
          )}

          {/* Botão Avançar */}
          <button
            onClick={handleNextHotspot}
            disabled={hotspots.length === 0}
            className="min-w-[44px] h-10 px-3 rounded-xl bg-lion-graphite hover:bg-[#3d444d] disabled:opacity-30 disabled:pointer-events-none text-gray-200 text-xs font-medium transition-colors border border-gray-700/50 flex items-center justify-center gap-1 active:scale-95"
            title="Avançar / Próximo Marcador"
          >
            <span className="hidden sm:inline">Avançar</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>

          <div className="h-5 w-px bg-gray-700/70 mx-0.5" />

          {/* Botão Resetar Câmera */}
          <button
            onClick={handleResetCamera}
            className="min-w-[44px] h-10 px-3 rounded-xl bg-lion-graphite hover:bg-[#3d444d] text-gray-200 text-xs font-medium transition-colors border border-gray-700/50 flex items-center justify-center gap-1.5 active:scale-95"
            title="Resetar Câmera e Orientação 3D"
          >
            <RotateCcw className="w-4 h-4 text-lion-orange" />
            <span className="hidden sm:inline">Resetar</span>
          </button>

          {/* Botão Deletar */}
          {!viewOnly && (
            <button
              onClick={handleDeleteAction}
              className="min-w-[44px] h-10 px-3 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-medium transition-colors border border-red-800/40 flex items-center justify-center gap-1.5 active:scale-95"
              title={selectedHotspot ? "Deletar Marcador Selecionado" : "Deletar Projeto"}
            >
              <Trash2 className="w-4 h-4 text-red-400" />
              <span className="hidden sm:inline">Deletar</span>
            </button>
          )}
        </div>

        {project.modelUrl ? (
          project.modelFormat && ['png', 'jpg', 'jpeg'].includes(project.modelFormat.toLowerCase()) ? (
             <div className="w-full h-full flex items-center justify-center relative overflow-hidden bg-black cad-grid" onClick={handleModelClick}>
                <img src={project.modelUrl} alt="Model Preview" className="max-w-full max-h-full object-contain pointer-events-none" />
                {hotspots.map((hs) => (
                    <div
                      key={hs.id}
                      className={`absolute w-7 h-7 rounded-full border-2 border-white flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125 z-10 cursor-pointer shadow-lg ${selectedHotspot?.id === hs.id ? 'bg-lion-orange scale-125' : 'bg-lion-tech-blue'}`}
                      style={{ 
                          left: hs.position.split(' ')[0] + '%', 
                          top: hs.position.split(' ')[1] + '%'
                      }}
                      onClick={(e) => {
                         e.stopPropagation();
                         setSelectedHotspot(hs);
                         if (!viewOnly) {
                           setShowMobileDrawer(true);
                         }
                         if (viewOnly && hs.type === 'link' && hs.linkUrl) {
                            window.open(hs.linkUrl, '_blank');
                         }
                      }}
                    >
                      {hs.type === 'info' && <Info className="w-3.5 h-3.5 text-white" />}
                      {hs.type === 'image' && <ImagePlus className="w-3.5 h-3.5 text-white" />}
                      {hs.type === 'video' && <Video className="w-3.5 h-3.5 text-white" />}
                      {hs.type === 'audio' && <Volume2 className="w-3.5 h-3.5 text-white" />}
                      {hs.type === 'link' && <Link2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                ))}
                {isAddingHotspot && (
                   <div className="absolute top-16 left-4 right-4 sm:left-auto bg-lion-black/95 border border-lion-graphite-light text-white px-4 py-2.5 rounded-xl text-xs z-20 text-center shadow-2xl">
                      Toque na imagem para posicionar o marcador.
                   </div>
                )}
             </div>
          ) : (
          <ARViewer
            ref={modelRef}
            src={project.modelUrl}
            hotspots={hotspots}
            backgroundColor={project.backgroundColor}
            selectedHotspotId={selectedHotspot?.id}
            onHotspotClick={(hs) => {
              setSelectedHotspot(hs);
              if (!viewOnly) {
                setShowMobileDrawer(true);
              }
              if (viewOnly && hs.type === 'link' && hs.linkUrl) {
                window.open(hs.linkUrl, '_blank');
              }
            }}
            onModelClick={handleModelClick}
            viewOnly={viewOnly}
          />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center cad-grid p-4">
            {!viewOnly ? (
              <div {...getRootProps()} className={`flex flex-col items-center justify-center max-w-[400px] w-full min-h-[280px] p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${isDragActive ? 'border-lion-tech-blue bg-lion-tech-blue/10' : 'border-lion-graphite-light bg-lion-graphite/80 hover:bg-lion-graphite'}`}>
                <input {...getInputProps()} />
                <UploadCloud className={`w-12 h-12 mb-4 transition-colors ${isDragActive ? 'text-lion-tech-blue' : 'text-lion-tech-blue/70'}`} />
                <span className="font-semibold text-base sm:text-lg text-white text-center">
                  {isDragActive ? 'Solte o arquivo aqui...' : 'Arraste um modelo 3D ou Imagem'}
                </span>
                <span className="text-xs text-gray-400 mt-2 text-center">Toque para selecionar (.glb, .gltf, .png, .jpg)</span>
                
                {isUploading && (
                  <div className="w-full max-w-xs h-2 bg-lion-black rounded-full mt-6 overflow-hidden border border-lion-graphite-light">
                    <div className="h-full bg-lion-orange transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500 text-sm">Nenhum modelo publicado.</div>
            )}
          </div>
        )}
      </div>

      {/* DESKTOP SIDEBAR - lg:flex only */}
      {(!viewOnly || selectedHotspot) && (
        <aside className="hidden lg:flex w-80 bg-lion-graphite border-l border-lion-graphite-light flex-col z-20 shrink-0 h-full">
          {/* Header */}
          {!viewOnly ? (
            <div className="p-4 border-b border-lion-graphite-light flex justify-between items-center bg-lion-header">
              <h3 className="text-xs font-bold uppercase tracking-widest text-lion-orange">Properties</h3>
              <div className="flex gap-2">
                <button 
                   onClick={() => exportProjectData(project.id)} 
                   className="text-gray-400 text-[10px] font-bold hover:text-white uppercase transition-colors flex items-center pr-2 border-r border-gray-700 min-h-[32px]" 
                   title="Salvar Projeto para Arquivo Local"
                >
                  Salvar
                </button>
                <button 
                   onClick={() => setShowMatrixModal(true)} 
                   className="text-green-400 text-[10px] font-bold hover:text-green-300 uppercase transition-colors flex items-center pr-2 border-r border-gray-700 gap-1 min-h-[32px]" 
                   title="Vínculo da Matriz"
                >
                  <Network className="w-3 h-3" />
                  Matriz
                </button>
                <button 
                   onClick={() => setShowMatrixModal(true)} 
                   className="text-lion-tech-blue text-xs font-bold hover:text-white uppercase transition-colors min-h-[32px]" 
                   title="Compartilhar e Vincular"
                >
                  Share
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 border-b border-lion-graphite-light bg-lion-header flex justify-between items-center">
               <h3 className="text-xs font-bold uppercase tracking-widest text-lion-orange truncate pr-4">{project.name}</h3>
               <button onClick={() => setSelectedHotspot(null)} className="text-gray-500 hover:text-white p-1">
                 <X className="w-4 h-4" />
               </button>
            </div>
          )}

          {/* Properties Panel Scrollable */}
          <div className="p-4 flex-1 overflow-y-auto">
            {renderPropertiesContent()}
          </div>
        </aside>
      )}

      {/* MOBILE BOTTOM SHEET DRAWER - Editor Mode (lg:hidden) */}
      {!viewOnly && showMobileDrawer && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200" 
            onClick={() => { setShowMobileDrawer(false); }} 
          />
          {/* Sheet Container */}
          <div className="relative bg-lion-graphite border-t border-lion-graphite-light rounded-t-3xl shadow-2xl flex flex-col max-h-[82dvh] z-10 animate-in slide-in-from-bottom duration-300 pb-safe">
            {/* Drag Handle & Header */}
            <div className="pt-3 pb-2 px-6 flex flex-col items-center border-b border-lion-graphite-light">
              <div className="w-12 h-1.5 bg-gray-600 rounded-full mb-2" />
              <div className="w-full flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-lion-orange truncate pr-4">
                  {selectedHotspot ? `Marcador: ${selectedHotspot.title}` : 'Propriedades do Projeto'}
                </h3>
                <button 
                  onClick={() => { setShowMobileDrawer(false); }}
                  className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            {/* Drawer Content */}
            <div className="p-5 overflow-y-auto flex-1 overscroll-contain">
              {renderPropertiesContent()}
            </div>
          </div>
        </div>
      )}

      {/* MOBILE FLOATING CARD - viewOnly Mode (lg:hidden) */}
      {viewOnly && selectedHotspot && (
        <div className="lg:hidden fixed bottom-6 inset-x-4 z-40 bg-lion-graphite/95 backdrop-blur-xl border border-lion-tech-blue/50 rounded-2xl p-5 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[55vh] overflow-y-auto pb-safe">
          <div className="flex items-center justify-between pb-3 border-b border-lion-graphite-light mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-lion-orange font-bold">Marcador Interativo</span>
            <button
              onClick={() => setSelectedHotspot(null)}
              className="min-w-[40px] min-h-[40px] -mr-2 flex items-center justify-center text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">{selectedHotspot.title}</h2>
          <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{selectedHotspot.description}</p>
          {selectedHotspot.type === 'video' && selectedHotspot.mediaUrl && (
            <div className="rounded-lg overflow-hidden border border-gray-800 mt-4">
              <video src={selectedHotspot.mediaUrl} controls className="w-full" />
            </div>
          )}
          {selectedHotspot.type === 'image' && selectedHotspot.mediaUrl && (
            <div className="rounded-lg overflow-hidden border border-gray-800 mt-4">
              <img src={selectedHotspot.mediaUrl} alt="Hotspot anexo" className="w-full object-cover" />
            </div>
          )}
          {selectedHotspot.type === 'audio' && selectedHotspot.mediaUrl && (
            <div className="bg-lion-black p-3 rounded-lg border border-gray-800 mt-4">
              <audio src={selectedHotspot.mediaUrl} controls className="w-full" />
            </div>
          )}
          {selectedHotspot.type === 'link' && selectedHotspot.linkUrl && (
            <a 
              href={selectedHotspot.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-lion-tech-blue hover:bg-blue-600 text-white text-xs font-bold uppercase tracking-wider min-h-[44px]"
            >
              <ExternalLink className="w-4 h-4" /> Acessar Link
            </a>
          )}
        </div>
      )}


      {/* Delete Project Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-lion-graphite border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Excluir este Projeto?
            </h3>
            <p className="text-gray-300 text-sm mb-6">
              Tem certeza de que deseja excluir o projeto <strong className="text-white">"{project.name}"</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg bg-lion-black border border-gray-700 text-gray-300 text-sm hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteProject}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-lg shadow-red-600/30"
              >
                Sim, Excluir Projeto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MATRIX HUB & INTEGRATION MODAL */}
      {(showMatrixModal || showShareModal) && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-lion-graphite border border-lion-graphite-light rounded-2xl max-w-2xl w-full my-8 shadow-2xl overflow-hidden relative">
            
            {/* Header */}
            <div className="p-6 border-b border-lion-graphite-light bg-lion-header flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-lion-orange animate-pulse"></span>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-lion-orange font-bold">Matriz Central • Hub de Vínculos</span>
                </div>
                <h2 className="text-xl font-display font-bold text-white">Transferir Projeto & Manter Vínculo</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Distribua para celulares, outros apps e sistemas mantendo sincronização viva com a Matriz.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowMatrixModal(false);
                  setShowShareModal(false);
                }}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Matrix Status Banner & Core Action */}
            <div className="p-6 border-b border-lion-graphite-light bg-lion-black/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-lion-graphite-light bg-lion-graphite/40">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {project.matrixLinked ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Vínculo Matriz Ativo (v{project.matrixVersion || 1})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
                        <Network className="w-3.5 h-3.5" /> Pendente de Transferência
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {project.matrixLinked
                      ? `Última sincronização: ${project.matrixSyncedAt ? new Date(project.matrixSyncedAt).toLocaleString('pt-BR') : 'Agora'}`
                      : 'Transfira este projeto para a rede da Matriz para gerar links globais, QR Code e sincronização multiapp.'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {project.matrixLinked ? (
                    <>
                      <button
                        onClick={handleSyncMatrix}
                        disabled={isSyncing}
                        className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-colors flex items-center gap-1.5 shadow-lg shadow-green-600/20 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                      </button>
                      <button
                        onClick={handleExecuteMatrixTransfer}
                        disabled={isTransferring}
                        className="bg-lion-graphite hover:bg-[#3d444d] text-gray-300 border border-gray-700 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        title="Re-transferir modelo 3D e arquivos"
                      >
                        {isTransferring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                        Re-transferir
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleExecuteMatrixTransfer}
                      disabled={isTransferring}
                      className="bg-lion-tech-blue hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all flex items-center gap-2 shadow-xl shadow-blue-500/20 disabled:opacity-50"
                    >
                      {isTransferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
                      {isTransferring ? 'Executando Transferência...' : 'Executar Transferência Matriz'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Integration Navigation Tabs */}
            <div className="flex border-b border-lion-graphite-light bg-lion-black/30 px-6 gap-2">
              <button
                onClick={() => setMatrixActiveTab('webar')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                  matrixActiveTab === 'webar'
                    ? 'border-lion-tech-blue text-lion-tech-blue'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                1. WebAR no Celular
              </button>
              <button
                onClick={() => setMatrixActiveTab('embed')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                  matrixActiveTab === 'embed'
                    ? 'border-lion-tech-blue text-lion-tech-blue'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Code2 className="w-4 h-4" />
                2. Incorporar em Outros Apps
              </button>
              <button
                onClick={() => setMatrixActiveTab('api')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                  matrixActiveTab === 'api'
                    ? 'border-lion-tech-blue text-lion-tech-blue'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Network className="w-4 h-4" />
                3. API REST JSON
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-6 space-y-6">
              
              {/* TAB 1: WEBAR NO CELULAR */}
              {matrixActiveTab === 'webar' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-lion-black border border-lion-graphite-light">
                    <div className="bg-white p-3 rounded-xl shadow-lg relative group shrink-0">
                      <QRCodeSVG id="matrix-qr-modal" value={`${window.location.origin}/viewer/${project.id}`} size={160} />
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                        <button
                          onClick={() => downloadQRCode('matrix-qr-modal')}
                          className="bg-lion-tech-blue text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg"
                        >
                          <Download className="w-3.5 h-3.5" /> Baixar
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3 flex-1 text-left">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-lion-tech-blue" />
                        Aponte a Câmera do Celular
                      </h3>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Abra o leitor de QR Code ou a câmera de qualquer smartphone (Android ou iPhone). O modelo 3D se projeta diretamente no ambiente real usando WebXR e Quick Look, mantendo o vínculo ativo com este projeto.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => downloadQRCode('matrix-qr-modal')}
                          className="px-3 py-2 bg-lion-graphite hover:bg-[#3d444d] text-gray-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-gray-700"
                        >
                          <Download className="w-3.5 h-3.5" /> Baixar QR Code
                        </button>
                        <a
                          href={`/viewer/${project.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2 bg-lion-tech-blue/20 hover:bg-lion-tech-blue/30 text-lion-tech-blue rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-lion-tech-blue/40"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Abrir no Navegador
                        </a>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider font-mono block mb-1.5">Link WebAR Direto</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/viewer/${project.id}`}
                        className="flex-1 bg-lion-black border border-gray-800 rounded-lg p-2.5 text-xs font-mono text-gray-300 outline-none"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/viewer/${project.id}`);
                          setHasCopiedLink(true);
                          setTimeout(() => setHasCopiedLink(false), 2000);
                          toast.success('Link WebAR copiado!');
                        }}
                        className="bg-lion-tech-blue hover:bg-blue-600 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                      >
                        {hasCopiedLink ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                        {hasCopiedLink ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: EMBED IFRAME */}
              {matrixActiveTab === 'embed' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs text-gray-400 uppercase tracking-wider font-mono">Código de Incorporação (HTML iFrame)</label>
                      <span className="text-[10px] text-green-400 font-mono">Vínculo Dinâmico Matriz</span>
                    </div>
                    <textarea
                      readOnly
                      rows={4}
                      value={`<iframe src="${window.location.origin}/viewer/${project.id}?embed=true" width="100%" height="600" frameborder="0" allow="camera; xr-spatial-tracking; display-capture; autoplay" style="border:1px solid #30363d; border-radius:12px; overflow:hidden;"></iframe>`}
                      className="w-full bg-lion-black border border-gray-800 rounded-lg p-3 text-xs font-mono text-gray-300 outline-none resize-none"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <p className="text-xs text-gray-400 max-w-sm">
                      Cole este trecho de código em intranets, portais, LMS, WordPress ou outros aplicativos web para exibir o modelo interativo com vínculo contínuo.
                    </p>
                    <button
                      onClick={() => {
                        const code = `<iframe src="${window.location.origin}/viewer/${project.id}?embed=true" width="100%" height="600" frameborder="0" allow="camera; xr-spatial-tracking; display-capture; autoplay" style="border:1px solid #30363d; border-radius:12px; overflow:hidden;"></iframe>`;
                        navigator.clipboard.writeText(code);
                        setHasCopiedEmbed(true);
                        setTimeout(() => setHasCopiedEmbed(false), 2000);
                        toast.success('Código de incorporação copiado!');
                      }}
                      className="bg-lion-tech-blue hover:bg-blue-600 px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
                    >
                      {hasCopiedEmbed ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                      {hasCopiedEmbed ? 'Código Copiado!' : 'Copiar Código Embed'}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: REST API */}
              {matrixActiveTab === 'api' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider font-mono block mb-1.5">Endpoint REST JSON (GET)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/api/matrix/projects/${project.id}`}
                        className="flex-1 bg-lion-black border border-gray-800 rounded-lg p-2.5 text-xs font-mono text-lion-tech-blue outline-none"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/api/matrix/projects/${project.id}`);
                          setHasCopiedApi(true);
                          setTimeout(() => setHasCopiedApi(false), 2000);
                          toast.success('URL da API copiada!');
                        }}
                        className="bg-lion-graphite hover:bg-[#3d444d] border border-gray-700 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-gray-200"
                      >
                        {hasCopiedApi ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {hasCopiedApi ? 'Copiado!' : 'Copiar URL'}
                      </button>
                    </div>
                  </div>

                  <div className="bg-lion-black border border-gray-800 rounded-xl p-4 text-xs font-mono text-gray-400 space-y-1 overflow-x-auto">
                    <div className="text-gray-500">// Resposta JSON fornecida pela Matriz:</div>
                    <div>{`{`}</div>
                    <div className="pl-4">{`"matrixId": "${project.id}",`}</div>
                    <div className="pl-4">{`"name": "${project.name}",`}</div>
                    <div className="pl-4">{`"matrixVersion": ${project.matrixVersion || 1},`}</div>
                    <div className="pl-4">{`"modelUrl": "${window.location.origin}/api/matrix/models/${project.id}",`}</div>
                    <div className="pl-4">{`"hotspotsCount": ${hotspots.length}`}</div>
                    <div>{`}`}</div>
                  </div>
                </div>
              )}

              {/* Public access toggle */}
              <div className="flex items-center justify-between p-3.5 bg-lion-black rounded-xl border border-gray-800">
                <div className="space-y-0.5">
                  <label htmlFor="publicAccess" className="text-xs font-medium cursor-pointer text-gray-200 block">
                    Permitir Acesso Público & Vínculo Externo
                  </label>
                  <p className="text-[11px] text-gray-500">Qualquer aplicativo ou visitante com o link pode interagir em AR.</p>
                </div>
                <input
                  type="checkbox"
                  id="publicAccess"
                  checked={project.isPublic}
                  onChange={(e) => {
                    handleUpdateProjectSettings({ isPublic: e.target.checked });
                    toast.success(e.target.checked ? 'Projeto configurado como público.' : 'Projeto configurado como privado.');
                  }}
                  className="w-4 h-4 accent-lion-tech-blue cursor-pointer"
                />
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
