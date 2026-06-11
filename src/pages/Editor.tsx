import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLocalProject, updateLocalProject, getLocalHotspots, addLocalHotspot, updateLocalHotspot, deleteLocalHotspot, saveLocalModel, getLocalModelUrl, saveLocalThumbnail, exportProjectData } from '../lib/localDb';
import { useAuth } from '../context/AuthContext';
import { Project, Hotspot } from '../types';
import { UploadCloud, Plus, Share2, X, Sparkles, Loader2, ImagePlus, Download, QrCode, Info, Video, Volume2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { useDropzone } from 'react-dropzone';
import ARViewer from '../components/ARViewer';

export default function Editor({ viewOnly = false }: { viewOnly?: boolean }) {
  const { projectId } = useParams();
  const { user } = useAuth();
  
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
  
  const modelRef = useRef<any>(null);

  useEffect(() => {
    if (!projectId) return;

    const loadLocal = async () => {
      const p = await getLocalProject(projectId);
      if (p) {
        if (p.modelFormat) {
            const url = await getLocalModelUrl(projectId);
            if (url) p.modelUrl = url;
        }
        setProject(p);
      } else if (!viewOnly) {
          toast.error("Projeto local não encontrado.");
      }
      const hs = await getLocalHotspots(projectId);
      setHotspots(hs);
    };
    loadLocal();
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

  if (!project) return <div className="flex-1 flex items-center justify-center">Carregando...</div>;

  return (
    <div className="flex-1 flex relative overflow-hidden bg-lion-black">
      
      {/* 3D Model Area / Image Area */}
      <div className="flex-1 relative cursor-crosshair">
        {project.modelUrl ? (
          project.modelFormat && ['png', 'jpg', 'jpeg'].includes(project.modelFormat.toLowerCase()) ? (
             <div className="w-full h-full flex items-center justify-center relative overflow-hidden bg-black cad-grid" onClick={handleModelClick}>
                <img src={project.modelUrl} alt="Model Preview" className="max-w-full max-h-full object-contain pointer-events-none" />
                {hotspots.map((hs) => (
                    <div
                      key={hs.id}
                      className={`absolute w-6 h-6 rounded-full border-2 border-white flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125 z-10 cursor-pointer ${selectedHotspot?.id === hs.id ? 'bg-lion-orange scale-125' : 'bg-lion-tech-blue'}`}
                      style={{ 
                          left: hs.position.split(' ')[0] + '%', 
                          top: hs.position.split(' ')[1] + '%'
                      }}
                      onClick={(e) => {
                         e.stopPropagation();
                         setSelectedHotspot(hs);
                         if (viewOnly && hs.type === 'link' && hs.linkUrl) {
                            window.open(hs.linkUrl, '_blank');
                         }
                      }}
                    >
                      {hs.type === 'info' && <Info className="w-3 h-3 text-white" />}
                      {hs.type === 'image' && <ImagePlus className="w-3 h-3 text-white" />}
                      {hs.type === 'video' && <Video className="w-3 h-3 text-white" />}
                      {hs.type === 'audio' && <Volume2 className="w-3 h-3 text-white" />}
                      {hs.type === 'link' && <Link2 className="w-3 h-3 text-white" />}
                    </div>
                ))}
                {isAddingHotspot && (
                   <div className="absolute top-4 left-4 bg-lion-black border border-lion-graphite-light text-white px-4 py-2 rounded text-sm z-20">
                      Clique na imagem para adicionar o marcador.
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
              if (viewOnly && hs.type === 'link' && hs.linkUrl) {
                window.open(hs.linkUrl, '_blank');
              }
            }}
             onModelClick={handleModelClick}
            viewOnly={viewOnly}
          />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center cad-grid">
            {!viewOnly ? (
              <div {...getRootProps()} className={`flex flex-col items-center justify-center w-[400px] h-[300px] border-2 border-dashed rounded-xl cursor-pointer transition-colors ${isDragActive ? 'border-lion-tech-blue bg-lion-tech-blue/10' : 'border-lion-graphite-light bg-lion-graphite/80 hover:bg-lion-graphite'}`}>
                <input {...getInputProps()} />
                <UploadCloud className={`w-12 h-12 mb-4 transition-colors ${isDragActive ? 'text-lion-tech-blue' : 'text-lion-tech-blue/70'}`} />
                <span className="font-medium text-lg text-white text-center px-4">
                  {isDragActive ? 'Solte o arquivo aqui...' : 'Arraste um modelo 3D ou Imagem, ou clique'}
                </span>
                <span className="text-sm text-gray-500 mt-2">.glb, .gltf, .png, .jpg suportados</span>
                
                {isUploading && (
                  <div className="w-64 h-2 bg-lion-black rounded-full mt-6 overflow-hidden border border-lion-graphite-light">
                    <div className="h-full bg-lion-orange transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500">Nenhum modelo publicado.</div>
            )}
          </div>
        )}
      </div>

      {/* Sidebar Tools - Only show if not viewOnly OR if a hotspot is selected in viewOnly */}
      {(!viewOnly || selectedHotspot) && (
        <div className="w-72 bg-lion-graphite border-l border-lion-graphite-light flex flex-col z-10 shrink-0">
          
          {/* Header */}
          {!viewOnly ? (
            <div className="p-4 border-b border-lion-graphite-light flex justify-between items-center bg-lion-header">
              <h3 className="text-xs font-bold uppercase tracking-widest text-lion-orange">Properties</h3>
              <div className="flex gap-2">
                <button 
                   onClick={() => exportProjectData(project.id)} 
                   className="text-gray-400 text-[10px] font-bold hover:text-white uppercase transition-colors flex items-center pr-2 border-r border-gray-700" title="Salvar Projeto para Arquivo Local">
                  Salvar
                </button>
                <button 
                   onClick={() => setShowShareModal(true)} 
                   className="text-lion-tech-blue text-xs font-bold hover:text-white uppercase transition-colors" title="Compartilhar">
                  Share
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 border-b border-lion-graphite-light bg-lion-header flex justify-between items-center">
               <h3 className="text-xs font-bold uppercase tracking-widest text-lion-orange truncate pr-4">{project.name}</h3>
               <button onClick={() => setSelectedHotspot(null)} className="text-gray-500 hover:text-white">
                 <X className="w-4 h-4" />
               </button>
            </div>
          )}

          {/* Properties Panel */}
          <div className="p-4 flex-1 overflow-y-auto">
            {selectedHotspot ? (
              <div className="space-y-6">
                 <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Informações</h3>
                    {!viewOnly && (
                      <button onClick={() => setSelectedHotspot(null)} className="text-lion-tech-blue text-xs font-bold uppercase">
                        Back
                      </button>
                    )}
                 </div>
                 
                 {viewOnly ? (
                   <div className="space-y-4">
                     <h2 className="text-xl font-bold">{selectedHotspot.title}</h2>
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
                        <input type="text" value={selectedHotspot.title} onChange={e => handleUpdateHotspot(selectedHotspot.id, { title: e.target.value })} className="w-full bg-lion-black border border-gray-800 rounded p-2 text-sm focus:border-lion-tech-blue outline-none" />
                     </div>
                     <div>
                        <label className="block text-xs text-gray-400 mb-1">Descrição / Procedimento</label>
                        <textarea value={selectedHotspot.description} onChange={e => handleUpdateHotspot(selectedHotspot.id, { description: e.target.value })} rows={5} className="w-full bg-lion-black border border-gray-800 rounded p-2 text-sm focus:border-lion-tech-blue outline-none resize-none" />
                        <button onClick={generateAIDescription} disabled={isGeneratingAI} className="mt-2 text-xs font-medium text-lion-tech-blue hover:text-blue-400 flex items-center gap-1 transition-colors">
                          {isGeneratingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          Gerar via IA (Gemini)
                        </button>
                     </div>
                     <div>
                        <label className="block text-xs text-gray-400 mb-1">Tipo de Interação</label>
                        <select value={selectedHotspot.type} onChange={e => handleUpdateHotspot(selectedHotspot.id, { type: e.target.value as any })} className="w-full bg-lion-black border border-gray-800 rounded p-2 text-sm focus:border-lion-tech-blue outline-none">
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
                             <input type="text" value={selectedHotspot.mediaUrl || selectedHotspot.linkUrl || ''} onChange={e => handleUpdateHotspot(selectedHotspot.id, selectedHotspot.type === 'link' ? { linkUrl: e.target.value } : { mediaUrl: e.target.value })} placeholder="https://" className="w-full bg-lion-black border border-gray-800 rounded p-2 text-sm focus:border-lion-tech-blue outline-none" />
                             {(selectedHotspot.type === 'image') && (
                                <label className="bg-lion-graphite hover:bg-lion-graphite-light text-lion-tech-blue px-3 rounded border border-[#2D333B] flex items-center justify-center cursor-pointer transition-colors" title="Anexar Imagem">
                                   <UploadCloud className="w-4 h-4" />
                                   <input type="file" accept="image/png, image/jpeg, image/jpg" className="hidden" onChange={handleHotspotMediaUpload} />
                                </label>
                             )}
                          </div>
                          {(selectedHotspot.type === 'image' && selectedHotspot.mediaUrl) && (
                              <div className="mt-2 text-center rounded border border-gray-800 overflow-hidden relative">
                                  <img src={selectedHotspot.mediaUrl} alt="Preview do anexo" className="w-full max-h-[150px] object-cover" />
                                  <button onClick={() => handleUpdateHotspot(selectedHotspot.id, { mediaUrl: '' })} className="absolute top-2 right-2 bg-black/70 text-white p-1 rounded-full hover:bg-red-500"><X className="w-3 h-3" /></button>
                              </div>
                          )}
                       </div>
                     )}

                     <div className="pt-4 border-t border-lion-graphite-light flex justify-between">
                        <button onClick={() => handleDeleteHotspot(selectedHotspot.id)} className="text-red-400 text-sm hover:underline">Remover Marcador</button>
                        <button onClick={() => setSelectedHotspot(null)} className="bg-lion-tech-blue text-white px-4 py-2 rounded text-sm hover:bg-blue-600">Concluído</button>
                     </div>
                   </>
                 )}
              </div>
            ) : (
              !viewOnly && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Configurações Gerais</h3>
                    <div className="space-y-4">
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase">Nome do Equipamento</label>
                          <input type="text" value={project.name} onChange={(e) => handleUpdateProjectSettings({ name: e.target.value })} className="w-full bg-lion-black border border-lion-graphite-light rounded p-2 text-sm text-gray-200 mt-1 focus:border-lion-tech-blue outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase">Cor de Fundo</label>
                          <div className="flex gap-2 mt-1">
                             <input type="color" value={project.backgroundColor} onChange={(e) => handleUpdateProjectSettings({ backgroundColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer bg-lion-black border border-lion-graphite-light outline-none" />
                             <input type="text" value={project.backgroundColor} readOnly className="flex-1 bg-lion-black border border-lion-graphite-light rounded px-2 text-sm text-gray-400 outline-none" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase mb-1 block">Thumbnail (Preview)</label>
                          <div className="bg-lion-black border border-lion-graphite-light rounded-lg overflow-hidden relative group">
                             {project.thumbnailUrl ? (
                               <div className="aspect-video relative">
                                 <img src={project.thumbnailUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
                                 <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-sm gap-3 px-4">
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
                                    <button onClick={generateThumbnail} disabled={isGeneratingThumbnail} className="bg-lion-tech-blue text-white w-full max-w-[200px] text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-600 py-2 rounded">
                                       {isGeneratingThumbnail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                       Regerar IA
                                    </button>
                                    <label className="text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:text-lion-tech-blue cursor-pointer bg-lion-graphite w-full max-w-[200px] justify-center py-2 rounded border border-gray-600">
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
                                     <button onClick={generateThumbnail} disabled={isGeneratingThumbnail} className="w-full bg-lion-tech-blue hover:bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest py-2 px-4 rounded flex justify-center items-center gap-2 transition-colors">
                                        {isGeneratingThumbnail ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                        {isGeneratingThumbnail ? 'Gerando...' : 'Gerar com IA'}
                                     </button>
                                     <label className="w-full bg-lion-graphite hover:bg-[#3d444d] text-lion-tech-blue text-[10px] font-bold uppercase tracking-widest py-2 px-4 rounded border border-[#2D333B] flex justify-center items-center gap-2 transition-colors cursor-pointer">
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
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Acesso Rápido e QR Code</h3>
                    <div className="bg-lion-black border border-lion-graphite-light rounded-lg p-4 flex flex-col items-center">
                        <div className="bg-white p-2 rounded mb-3">
                           <QRCodeSVG id="project-qr-code-main" value={`${window.location.origin}/viewer/${project.id}`} size={120} />
                        </div>
                        <p className="text-[10px] text-gray-400 text-center mb-3">Escaneie para acessar o visualizador AR instantaneamente.</p>
                        <div className="flex w-full gap-2">
                           <button 
                             onClick={() => downloadQRCode('project-qr-code-main')} 
                             className="flex-1 bg-lion-graphite hover:bg-lion-graphite-light text-white text-[10px] font-bold uppercase tracking-widest py-2 px-3 rounded border border-[#2D333B] flex items-center justify-center gap-1 transition-colors"
                           >
                              <Download className="w-3 h-3" />
                              Download
                           </button>
                           <button 
                             onClick={() => {
                               navigator.clipboard.writeText(`${window.location.origin}/viewer/${project.id}`);
                               toast.success('Link copiado!');
                             }} 
                             className="flex-1 bg-lion-tech-blue/10 hover:bg-lion-tech-blue/20 text-lion-tech-blue border border-lion-tech-blue/30 text-[10px] font-bold uppercase tracking-widest py-2 px-3 flex items-center justify-center gap-1 rounded transition-colors"
                           >
                              <Share2 className="w-3 h-3" />
                              Copiar Link
                           </button>
                        </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Ferramentas Interativas</h3>
                    <div className="space-y-2">
                       {project.modelUrl ? (
                         <button 
                           onClick={() => setIsAddingHotspot(!isAddingHotspot)}
                           className={`w-full p-4 rounded flex items-center justify-center gap-2 border transition-colors ${isAddingHotspot ? 'bg-lion-tech-blue/10 border-lion-tech-blue text-lion-tech-blue' : 'bg-lion-black border-lion-graphite-light hover:border-gray-600 text-gray-300'}`}
                         >
                           <Plus className="w-4 h-4" />
                           <span className="text-xs font-bold uppercase">{isAddingHotspot ? 'Selecione no modelo...' : 'Add Hotspot'}</span>
                         </button>
                       ) : (
                         <p className="text-[10px] text-gray-500 italic uppercase">Faça upload para habilitar hotspots</p>
                       )}
                       <Link 
                         to={`/training/${project.id}`}
                         className="w-full p-4 rounded flex items-center justify-center gap-2 border border-lion-graphite-light bg-lion-black hover:border-gray-600 text-lion-orange transition-colors"
                       >
                         <Sparkles className="w-4 h-4" />
                         <span className="text-xs font-bold uppercase tracking-widest">Sessão de Treinamento</span>
                       </Link>
                    </div>
                  </div>
                  
                  {project.modelUrl && hotspots.length > 0 && (
                    <div className="border-t border-lion-graphite-light pt-4 -mx-4 px-4 mt-8">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Scene Explorer</h3>
                      </div>
                      <div className="space-y-1">
                        {hotspots.map(hs => (
                           <button key={hs.id} onClick={() => setSelectedHotspot(hs)} className="w-full text-left p-2 rounded hover:bg-lion-header flex items-center gap-2 group transition-colors">
                             <span className="w-1.5 h-1.5 rounded-full bg-lion-tech-blue flex-shrink-0"></span>
                             <span className="text-xs text-gray-400 group-hover:text-gray-200 truncate pr-4 flex-1">Hotspot: {hs.title}</span>
                           </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-lion-graphite border border-lion-graphite-light rounded-xl p-6 max-w-md w-full relative">
             <button onClick={() => setShowShareModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
               <X className="w-5 h-5" />
             </button>
             <h2 className="text-xl font-display font-bold mb-6">Compartilhar Experiência</h2>
             
             <div className="flex justify-center bg-white p-4 rounded-lg mb-6 w-fit mx-auto relative group">
                <QRCodeSVG id="project-qr-code-modal" value={`${window.location.origin}/viewer/${project.id}`} size={200} />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg backdrop-blur-sm">
                   <button onClick={() => downloadQRCode('project-qr-code-modal')} className="bg-lion-tech-blue text-white px-4 py-2 rounded font-bold text-sm flex items-center gap-2 hover:bg-blue-600">
                     <Download className="w-4 h-4" /> Download QR
                   </button>
                </div>
             </div>
             
             <div className="space-y-2 mb-6">
                <label className="text-xs text-gray-400 uppercase tracking-wider font-mono">Link Público</label>
                <div className="flex gap-2">
                   <input type="text" readOnly value={`${window.location.origin}/viewer/${project.id}`} className="flex-1 bg-lion-black border border-gray-800 rounded p-2 text-sm outline-none text-gray-300" />
                   <button onClick={() => {
                     navigator.clipboard.writeText(`${window.location.origin}/viewer/${project.id}`);
                     toast.success('Link copiado!');
                   }} className="bg-lion-tech-blue hover:bg-blue-600 px-4 rounded text-sm font-medium">Copiar</button>
                </div>
             </div>

             <div className="flex items-center gap-2 p-3 bg-lion-black rounded border border-gray-800">
                <input type="checkbox" id="publicAccess" checked={project.isPublic} onChange={(e) => {
                   handleUpdateProjectSettings({ isPublic: e.target.checked });
                   toast.success(e.target.checked ? 'Projeto agora é público.' : 'Projeto agora é privado.');
                }} className="w-4 h-4 accent-lion-tech-blue cursor-pointer" />
                <label htmlFor="publicAccess" className="text-sm cursor-pointer text-gray-300">Permitir acesso público (qualquer pessoa com o link)</label>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
