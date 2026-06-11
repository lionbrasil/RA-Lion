import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, addDoc, query, onSnapshot, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Project, Hotspot } from '../types';
import { UploadCloud, Plus, Share2, X, Sparkles, Loader2 } from 'lucide-react';
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
  
  const [showShareModal, setShowShareModal] = useState(false);
  
  const modelRef = useRef<any>(null);

  useEffect(() => {
    if (!projectId) return;

    const fetchProject = async () => {
      const docRef = doc(db, 'projects', projectId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setProject({ id: snap.id, ...snap.data() } as Project);
      }
    };
    fetchProject();

    const q = query(collection(db, `projects/${projectId}/hotspots`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHotspots(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Hotspot)));
    });

    return () => unsubscribe();
  }, [projectId]);

  const onDrop = async (acceptedFiles: File[]) => {
    if (viewOnly || !project || !user) return;
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.name.endsWith('.glb') && !file.name.endsWith('.gltf')) {
      toast.error('Apenas formatos .glb e .gltf são suportados no navegador.');
      return;
    }

    setIsUploading(true);
    const storageRef = ref(storage, `models/${user.uid}/${projectId}/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        toast.error('Erro no upload: ' + error.message);
        setIsUploading(false);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await updateDoc(doc(db, 'projects', project.id), {
          modelUrl: downloadURL,
          modelFormat: file.name.split('.').pop(),
          updatedAt: serverTimestamp()
        });
        setProject(prev => prev ? { ...prev, modelUrl: downloadURL } : null);
        setIsUploading(false);
        setUploadProgress(0);
        toast.success('Upload concluído!');
      }
    );
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'model/gltf-binary': ['.glb'],
      'model/gltf+json': ['.gltf']
    },
    maxFiles: 1,
    disabled: isUploading || viewOnly,
  });

  const handleModelClick = async (event: any) => {
    if (viewOnly || !isAddingHotspot || !modelRef.current || !project) return;
    
    // Convert click client coordinates to local model coordinates using model-viewer API
    const rect = modelRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const hit = modelRef.current.positionAndNormalFromPoint(x, y);
    if (!hit) {
      toast.error('Clique diretamente no modelo para adicionar o marcador.');
      return;
    }

    try {
      await addDoc(collection(db, `projects/${project.id}/hotspots`), {
        projectId: project.id,
        position: `${hit.position.x} ${hit.position.y} ${hit.position.z}`,
        normal: `${hit.normal.x} ${hit.normal.y} ${hit.normal.z}`,
        title: 'Nova Informação',
        description: 'Descreva este componente...',
        type: 'info',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
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
      await updateDoc(doc(db, `projects/${project.id}/hotspots/${hotspotId}`), { ...updates, updatedAt: serverTimestamp() });
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
       const res = await fetch('/api/generate-description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: selectedHotspot.title, context: project?.name })
       });
       const data = await res.json();
       if (data.text) {
          await handleUpdateHotspot(selectedHotspot.id, { description: data.text });
          toast.success("Descrição gerada pela IA.");
       }
    } catch (e) {
       toast.error("Erro na geração via IA.");
    } finally {
       setIsGeneratingAI(false);
    }
  };
  
  const handleDeleteHotspot = async (hotspotId: string) => {
    if (viewOnly || !project || !confirm("Remover este marcador?")) return;
    try {
      await deleteDoc(doc(db, `projects/${project.id}/hotspots/${hotspotId}`));
      setSelectedHotspot(null);
      toast.success('Marcador removido');
    } catch (e) {
      toast.error('Erro ao remover');
    }
  };

  if (!project) return <div className="flex-1 flex items-center justify-center">Carregando...</div>;

  return (
    <div className="flex-1 flex relative overflow-hidden bg-lion-black">
      
      {/* 3D Model Area */}
      <div className="flex-1 relative cursor-crosshair">
        {project.modelUrl ? (
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
        ) : (
          <div className="absolute inset-0 flex items-center justify-center cad-grid">
            {!viewOnly ? (
              <div {...getRootProps()} className={`flex flex-col items-center justify-center w-[400px] h-[300px] border-2 border-dashed rounded-xl cursor-pointer transition-colors ${isDragActive ? 'border-lion-tech-blue bg-lion-tech-blue/10' : 'border-lion-graphite-light bg-lion-graphite/80 hover:bg-lion-graphite'}`}>
                <input {...getInputProps()} />
                <UploadCloud className={`w-12 h-12 mb-4 transition-colors ${isDragActive ? 'text-lion-tech-blue' : 'text-lion-tech-blue/70'}`} />
                <span className="font-medium text-lg text-white">
                  {isDragActive ? 'Solte o arquivo aqui...' : 'Arraste um modelo 3D ou clique'}
                </span>
                <span className="text-sm text-gray-500 mt-2">.glb ou .gltf suportados</span>
                
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
                <button onClick={() => setShowShareModal(true)} className="text-lion-tech-blue text-xs font-bold hover:text-white uppercase" title="Compartilhar">
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
                           <option value="video">Vídeo</option>
                           <option value="audio">Áudio (Efeito/Narração)</option>
                           <option value="link">Link Externo</option>
                        </select>
                     </div>
                     
                     {(selectedHotspot.type === 'video' || selectedHotspot.type === 'audio' || selectedHotspot.type === 'link') && (
                       <div>
                          <label className="block text-xs text-gray-400 mb-1">URL (Mídia ou Link)</label>
                          <input type="text" value={selectedHotspot.mediaUrl || selectedHotspot.linkUrl || ''} onChange={e => handleUpdateHotspot(selectedHotspot.id, selectedHotspot.type === 'link' ? { linkUrl: e.target.value } : { mediaUrl: e.target.value })} placeholder="https://" className="w-full bg-lion-black border border-gray-800 rounded p-2 text-sm focus:border-lion-tech-blue outline-none" />
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
                          <input type="text" value={project.name} onChange={async (e) => {
                            setProject({...project, name: e.target.value});
                            await updateDoc(doc(db, 'projects', project.id), { name: e.target.value });
                          }} className="w-full bg-lion-black border border-lion-graphite-light rounded p-2 text-sm text-gray-200 mt-1 focus:border-lion-tech-blue outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase">Cor de Fundo</label>
                          <div className="flex gap-2 mt-1">
                             <input type="color" value={project.backgroundColor} onChange={async (e) => {
                                setProject({...project, backgroundColor: e.target.value});
                                await updateDoc(doc(db, 'projects', project.id), { backgroundColor: e.target.value });
                             }} className="w-8 h-8 rounded cursor-pointer bg-lion-black border border-lion-graphite-light outline-none" />
                             <input type="text" value={project.backgroundColor} readOnly className="flex-1 bg-lion-black border border-lion-graphite-light rounded px-2 text-sm text-gray-400 outline-none" />
                          </div>
                        </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Ferramentas Interativas</h3>
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
             
             <div className="flex justify-center bg-white p-4 rounded-lg mb-6 w-fit mx-auto">
                <QRCodeSVG value={`${window.location.origin}/viewer/${project.id}`} size={200} />
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
                <input type="checkbox" id="publicAccess" checked={project.isPublic} onChange={async (e) => {
                   setProject({...project, isPublic: e.target.checked});
                   await updateDoc(doc(db, 'projects', project.id), { isPublic: e.target.checked });
                   toast.success(e.target.checked ? 'Projeto agora é público.' : 'Projeto agora é privado.');
                }} className="w-4 h-4 accent-lion-tech-blue cursor-pointer" />
                <label htmlFor="publicAccess" className="text-sm cursor-pointer">Permitir acesso público (qualquer pessoa com o link)</label>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
