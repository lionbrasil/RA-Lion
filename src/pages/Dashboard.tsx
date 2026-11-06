import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Box, Clock, Trash, Play, Wrench, Upload, Network, RefreshCw, X, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { 
  getLocalProjects, 
  createLocalProject, 
  deleteLocalProject, 
  importProjectData,
  getMatrixProjectsList,
  importProjectFromMatrix,
  syncProjectWithMatrix,
  transferProjectToMatrix
} from '../lib/localDb';

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [matrixIdInput, setMatrixIdInput] = useState('');
  const [matrixNetworkProjects, setMatrixNetworkProjects] = useState<any[]>([]);
  const [isLoadingMatrix, setIsLoadingMatrix] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadProjects = () => {
    getLocalProjects().then(data => {
      const userProjects = data.filter(p => p.ownerId === user?.uid);
      setProjects(userProjects.sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!user) return;
    loadProjects();
  }, [user]);

  const openMatrixModal = async () => {
    setShowMatrixModal(true);
    setIsLoadingMatrix(true);
    try {
      const list = await getMatrixProjectsList();
      setMatrixNetworkProjects(list);
    } catch (e) {
      console.warn('Erro ao carregar lista da matriz', e);
    } finally {
      setIsLoadingMatrix(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importProjectData(file);
      toast.success('Projeto importado com sucesso!');
      loadProjects();
    } catch (err) {
      toast.error('Importação falhou. Arquivo inválido.');
    }
  };

  const handleLinkFromMatrix = async (matrixIdOrUrl: string) => {
    if (!matrixIdOrUrl.trim()) {
      toast.error('Informe o ID ou URL do projeto na Matriz.');
      return;
    }
    setIsLoadingMatrix(true);
    try {
      const imported = await importProjectFromMatrix(matrixIdOrUrl, user?.uid);
      toast.success(`Projeto "${imported.name}" vinculado com sucesso!`);
      setShowMatrixModal(false);
      setMatrixIdInput('');
      loadProjects();
    } catch (err: any) {
      toast.error('Erro ao vincular da Matriz: ' + err.message);
    } finally {
      setIsLoadingMatrix(false);
    }
  };

  const handleQuickSync = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncingId(projectId);
    try {
      await syncProjectWithMatrix(projectId);
      toast.success('Projeto sincronizado com a Matriz!');
      loadProjects();
    } catch (err: any) {
      toast.error('Erro ao sincronizar: ' + err.message);
    } finally {
      setSyncingId(null);
    }
  };

  const handleQuickTransfer = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncingId(projectId);
    try {
      await transferProjectToMatrix(projectId);
      toast.success('Comando executado! Projeto transferido para a Matriz com vínculo ativo.');
      loadProjects();
    } catch (err: any) {
      toast.error('Erro ao transferir: ' + err.message);
    } finally {
      setSyncingId(null);
    }
  };

  const createProject = async () => {
    if (!user) return;
    try {
      const id = await createLocalProject(user.uid);
      navigate(`/editor/${id}`);
      toast.success('Projeto criado!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao criar projeto');
    }
  };

  const deleteProject = async (id: string) => {
    if(!confirm("Tem certeza que deseja excluir este projeto?")) return;
    try {
      await deleteLocalProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      toast.success('Projeto local excluído.');
    } catch(e) {
      toast.error('Erro ao excluir');
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 cad-grid">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">Painel de Projetos</h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">Gerencie modelos 3D, experiências WebAR e vínculos com a Matriz</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={openMatrixModal}
              className="flex-1 sm:flex-none bg-lion-graphite hover:bg-[#3d444d] active:bg-gray-800 text-green-400 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border border-green-500/30 transition-all shadow-lg min-h-[44px]"
            >
              <Network className="w-4 h-4" />
              <span>Vincular da Matriz</span>
            </button>
            <label className="flex-1 sm:flex-none bg-lion-graphite hover:bg-[#3d444d] active:bg-gray-800 text-gray-300 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-2 border border-[#2D333B] cursor-pointer transition-colors min-h-[44px]">
              <Upload className="w-4 h-4" /> <span>Importar</span>
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
            <button 
              onClick={createProject}
              className="w-full sm:w-auto bg-lion-tech-blue hover:bg-blue-600 active:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold tracking-wide flex items-center justify-center gap-2 border border-blue-400/20 shadow-lg shadow-blue-500/20 min-h-[44px]"
            >
              <Plus className="w-4 h-4" /> Novo Projeto
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-gray-400 text-center py-12">Carregando projetos...</div>
        ) : projects.length === 0 ? (
          <div className="border border-lion-graphite-light border-dashed rounded-2xl p-8 sm:p-16 flex flex-col items-center justify-center text-center bg-lion-black/50">
            <Box className="w-14 h-14 sm:w-16 sm:h-16 text-gray-600 mb-4" />
            <h3 className="text-lg sm:text-xl font-medium mb-2 text-white">Nenhum projeto encontrado</h3>
            <p className="text-gray-400 max-w-md mb-6 text-xs sm:text-sm leading-relaxed">
              Comece criando seu primeiro projeto interativo ou vincule um projeto existente criado na Matriz central.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button onClick={openMatrixModal} className="bg-lion-graphite hover:bg-gray-700 px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 text-green-400 border border-green-500/30 min-h-[44px]">
                <Network className="w-4 h-4" /> Vincular da Matriz
              </button>
              <button onClick={createProject} className="bg-lion-tech-blue hover:bg-blue-600 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 text-white min-h-[44px]">
                <Plus className="w-4 h-4" /> Criar Projeto
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {projects.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-lion-black border border-lion-graphite-light rounded-2xl overflow-hidden hover:border-lion-tech-blue/50 transition-colors group relative flex flex-col shadow-lg"
              >
                <div className="aspect-video bg-lion-graphite flex items-center justify-center border-b border-lion-graphite-light relative overflow-hidden">
                  {p.thumbnailUrl ? (
                    <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                     <Box className="w-12 h-12 text-gray-700" />
                  )}

                  {/* Vínculo Status Badge */}
                  <div className="absolute top-2.5 left-2.5 z-10">
                    {p.matrixLinked ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black/80 backdrop-blur-md text-green-400 border border-green-500/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                        Vínculo Matriz v{p.matrixVersion || 1}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black/80 backdrop-blur-md text-gray-400 border border-gray-700">
                        Local
                      </span>
                    )}
                  </div>

                  {/* Desktop Hover Quick Overlay */}
                  <div className="hidden sm:flex absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center backdrop-blur-sm gap-3">
                     <Link to={`/editor/${p.id}`} className="bg-lion-tech-blue p-3 rounded-full hover:bg-blue-500 transition-transform hover:scale-105 text-white" title="Editar Projeto">
                       <Wrench className="w-5 h-5" />
                     </Link>
                     <Link to={`/viewer/${p.id}`} className="bg-lion-orange p-3 rounded-full hover:bg-orange-500 transition-transform hover:scale-105 text-white" title="Visualizar Mode WebAR">
                        <Play className="w-5 h-5" />
                     </Link>
                  </div>
                </div>

                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-1.5">
                      <h3 className="font-semibold text-base truncate pr-2 text-white">{p.name}</h3>
                      <button 
                        onClick={() => deleteProject(p.id)} 
                        className="text-gray-500 hover:text-red-400 active:text-red-400 p-1 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg" 
                        title="Excluir"
                        aria-label="Excluir projeto"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-1 mb-2">{p.description || "Sem descrição"}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-mono mb-3">
                      <Clock className="w-3 h-3" />
                      {p.updatedAt?.toDate ? p.updatedAt.toDate().toLocaleDateString('pt-BR') : new Date(p.updatedAt).toLocaleDateString('pt-BR')}
                    </div>
                  </div>

                  {/* Touch Actions Bar for Mobile & Quick Controls */}
                  <div className="pt-3 border-t border-lion-graphite-light flex items-center gap-2">
                    <Link
                      to={`/viewer/${p.id}`}
                      className="flex-1 bg-lion-tech-blue hover:bg-blue-600 active:bg-blue-700 text-white font-semibold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all min-h-[40px]"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Ver em AR</span>
                    </Link>

                    <Link
                      to={`/editor/${p.id}`}
                      className="bg-lion-graphite hover:bg-[#3d444d] active:bg-gray-700 border border-gray-700 text-gray-200 p-2.5 rounded-xl flex items-center justify-center min-w-[40px] min-h-[40px] active:scale-95"
                      title="Editar"
                    >
                      <Wrench className="w-4 h-4 text-lion-tech-blue" />
                    </Link>

                    {p.matrixLinked ? (
                      <button
                        onClick={(e) => handleQuickSync(p.id, e)}
                        disabled={syncingId === p.id}
                        className="bg-lion-graphite hover:bg-[#3d444d] active:bg-gray-700 border border-green-500/30 text-green-400 p-2.5 rounded-xl flex items-center justify-center min-w-[40px] min-h-[40px] active:scale-95"
                        title="Sincronizar com Matriz"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncingId === p.id ? 'animate-spin' : ''}`} />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleQuickTransfer(p.id, e)}
                        disabled={syncingId === p.id}
                        className="bg-lion-graphite hover:bg-[#3d444d] active:bg-gray-700 border border-blue-500/30 text-lion-tech-blue p-2.5 rounded-xl flex items-center justify-center min-w-[40px] min-h-[40px] active:scale-95"
                        title="Transferir para Matriz"
                      >
                        <Network className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: VINCULAR PROJETO DA MATRIZ */}
      {showMatrixModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-lion-graphite border border-lion-graphite-light rounded-2xl max-w-xl w-full my-8 shadow-2xl overflow-hidden relative">
            <div className="p-6 border-b border-lion-graphite-light bg-lion-header flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Network className="w-4 h-4 text-green-400" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-green-400 font-bold">Conectar a Outros Apps</span>
                </div>
                <h2 className="text-xl font-display font-bold text-white">Vincular Projeto da Matriz</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Transfira projetos criados na Matriz para este app mantendo vínculo e sincronização contínua.
                </p>
              </div>
              <button onClick={() => setShowMatrixModal(false)} className="text-gray-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Form Input */}
              <div className="space-y-2">
                <label className="text-xs text-gray-300 font-semibold block">ID ou Link do Projeto da Matriz</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={matrixIdInput}
                    onChange={(e) => setMatrixIdInput(e.target.value)}
                    placeholder="Cole o ID da Matriz ou URL do Viewer (ex: viewer/fa1b2c3d)"
                    className="flex-1 bg-lion-black border border-gray-700 rounded-lg p-2.5 text-xs text-gray-200 outline-none focus:border-lion-tech-blue"
                  />
                  <button
                    onClick={() => handleLinkFromMatrix(matrixIdInput)}
                    disabled={isLoadingMatrix || !matrixIdInput.trim()}
                    className="bg-lion-tech-blue hover:bg-blue-600 disabled:opacity-50 text-white px-4 rounded-lg text-xs font-bold tracking-wider uppercase transition-colors flex items-center gap-1.5"
                  >
                    {isLoadingMatrix ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Network className="w-3.5 h-3.5" />}
                    Vincular
                  </button>
                </div>
              </div>

              {/* Network Available Projects */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                  <span>Projetos Disponíveis na Rede da Matriz</span>
                  {isLoadingMatrix && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                </h4>

                {matrixNetworkProjects.length === 0 ? (
                  <div className="p-6 rounded-xl bg-lion-black/60 border border-lion-graphite-light text-center text-xs text-gray-400">
                    Nenhum outro projeto registrado na rede da Matriz no momento. Abra qualquer projeto e clique em "Transferir Matriz" para disponibilizá-lo.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {matrixNetworkProjects.map((mp) => (
                      <div
                        key={mp.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-lion-black border border-lion-graphite-light hover:border-gray-600 transition-colors"
                      >
                        <div className="flex items-center gap-3 truncate pr-3">
                          <div className="w-8 h-8 rounded-lg bg-lion-graphite flex items-center justify-center shrink-0 border border-gray-700 text-lion-tech-blue">
                            <Box className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <h5 className="text-xs font-semibold text-white truncate">{mp.name}</h5>
                            <span className="text-[10px] text-gray-400 font-mono">
                              Versão {mp.matrixVersion || 1} • {mp.hotspots?.length || 0} marcadores
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleLinkFromMatrix(mp.id)}
                          disabled={isLoadingMatrix}
                          className="shrink-0 bg-green-950/60 hover:bg-green-900 border border-green-500/40 text-green-300 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Vincular</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

