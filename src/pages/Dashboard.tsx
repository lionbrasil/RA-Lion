import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Box, Clock, Trash, Play, Wrench, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { getLocalProjects, createLocalProject, deleteLocalProject, importProjectData } from '../lib/localDb';

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  const createProject = async () => {
    if (!user) return;
    try {
      const id = await createLocalProject(user.uid);
      navigate(`/editor/${id}`);
      toast.success('Projeto criado localmente!');
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
    <div className="flex-1 p-8 cad-grid">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold">Início</h1>
            <p className="text-gray-400 mt-1">Gerencie seus projetos 3D e experiências AR</p>
          </div>
          <div className="flex gap-4">
            <label className="bg-lion-graphite hover:bg-[#3d444d] text-gray-300 px-4 py-2 rounded font-medium flex items-center gap-2 border border-[#2D333B] cursor-pointer">
              <Upload className="w-5 h-5" /> Importar
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
            <button 
              onClick={createProject}
              className="bg-lion-tech-blue hover:bg-blue-600 text-white px-4 py-2 rounded font-medium flex items-center gap-2 border border-blue-400/20"
            >
              <Plus className="w-5 h-5" /> Novo Projeto
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-gray-400">Carregando projetos...</div>
        ) : projects.length === 0 ? (
          <div className="border border-lion-graphite-light border-dashed rounded-xl p-16 flex flex-col items-center justify-center text-center bg-lion-black/50">
            <Box className="w-16 h-16 text-gray-600 mb-4" />
            <h3 className="text-xl font-medium mb-2">Nenhum projeto encontrado</h3>
            <p className="text-gray-400 max-w-md mb-6">
              Comece criando seu primeiro projeto interativo e faça o upload de um modelo 3D para gerar uma experiência de Realidade Aumentada.
            </p>
            <button onClick={createProject} className="bg-lion-graphite-light hover:bg-gray-700 px-4 py-2 rounded font-medium flex items-center gap-2">
              <Plus className="w-5 h-5" /> Criar Projeto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-lion-black border border-lion-graphite-light rounded-xl overflow-hidden hover:border-lion-tech-blue/50 transition-colors group relative"
              >
                <div className="aspect-video bg-lion-graphite flex items-center justify-center border-b border-lion-graphite-light relative overflow-hidden">
                  {p.thumbnailUrl ? (
                    <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                     <Box className="w-12 h-12 text-gray-700" />
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm gap-4">
                     <Link to={`/editor/${p.id}`} className="bg-lion-tech-blue p-3 rounded-full hover:bg-blue-500 transition-transform hover:scale-105" title="Editar Projeto">
                       <Wrench className="w-5 h-5" />
                     </Link>
                     <Link to={`/viewer/${p.id}`} className="bg-lion-orange p-3 rounded-full hover:bg-orange-500 transition-transform hover:scale-105" title="Visualizar Mode WebAR">
                        <Play className="w-5 h-5" />
                     </Link>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-lg truncate pr-4">{p.name}</h3>
                    <button onClick={() => deleteProject(p.id)} className="text-gray-500 hover:text-red-400 p-1">
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                    <Clock className="w-3 h-3" />
                    {p.updatedAt?.toDate ? p.updatedAt.toDate().toLocaleDateString('pt-BR') : new Date(p.updatedAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
