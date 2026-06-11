import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Box, CheckCircle2, Circle, Settings2, Sparkles, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getLocalProject, getLocalHotspots, updateLocalProject } from '../lib/localDb';
import { Project, Hotspot } from '../types';
import { toast } from 'sonner';

interface TrainingStep {
  title: string;
  desc: string;
  completed?: boolean;
}

export default function TrainingModule() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [steps, setSteps] = useState<TrainingStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!projectId || !user) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const p = await getLocalProject(projectId);
        const hs = await getLocalHotspots(projectId);
        if (p) setProject(p);
        setHotspots(hs);
        
        if (p?.trainingSteps) {
           setSteps(p.trainingSteps);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId, user]);

  const generateTraining = async () => {
    if (!project) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           projectName: project.name,
           projectDescription: project.description,
           hotspots: hotspots.map(h => ({ title: h.title, description: h.description }))
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.result) {
         let parsed;
         try {
            const cleanJsonString = data.result.replace(/```json\n?|\n?```/gi, '').trim();
            parsed = JSON.parse(cleanJsonString);
         } catch(e) {
            console.error(e);
            throw new Error("Formato de resposta inválido.");
         }
         
         if (parsed && parsed.steps) {
            const newSteps = parsed.steps.map((s: any) => ({ ...s, completed: false }));
            setSteps(newSteps);
            toast.success("Módulo de treinamento gerado com sucesso!");
            await updateLocalProject(project.id, { trainingSteps: newSteps });
         }
      }
    } catch(e: any) {
      toast.error("Erro ao gerar treinamento: " + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleStep = (index: number) => {
    const newSteps = [...steps];
    newSteps[index].completed = !newSteps[index].completed;
    setSteps(newSteps);
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Carregando...</div>;
  if (!project) return <div className="p-8 text-center text-gray-400">Projeto não encontrado.</div>;

  return (
    <div className="flex-1 p-8 cad-grid overflow-y-auto w-full">
      <div className="max-w-4xl mx-auto w-full">
        {/* Back Link */}
        <Link to="/editor" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Editor
        </Link>
        
        <div className="bg-lion-black border border-lion-graphite-light rounded-2xl overflow-hidden shadow-2xl">
           
           {/* Header */}
           <div className="p-8 border-b border-lion-graphite-light relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-lion-orange/20 blur-[100px] pointer-events-none rounded-full" />
             <div className="relative z-10 flex gap-4 items-center mb-4">
                <div className="w-12 h-12 bg-lion-orange/10 border border-lion-orange/30 rounded-lg flex items-center justify-center text-lion-orange">
                  <Settings2 className="w-6 h-6" />
                </div>
                <div>
                   <div className="text-lion-orange font-mono text-sm font-bold tracking-wider mb-1 uppercase">Módulo Prático</div>
                   <h1 className="text-3xl font-display font-medium">Procedimento: {project.name}</h1>
                </div>
             </div>
             <p className="text-gray-400 max-w-2xl text-lg leading-relaxed">
               {project.description || "Este módulo guia a inspeção e operação do equipamento baseando-se no modelo 3D fornecido."}
             </p>
           </div>

           {/* Content */}
           <div className="p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <h2 className="text-xl font-medium font-display">Procedimento Operacional (Checklist)</h2>
                
                {steps.length === 0 && (
                  <button 
                    onClick={generateTraining} 
                    disabled={isGenerating}
                    className="bg-lion-graphite hover:bg-lion-graphite-light text-lion-tech-blue border border-[#2D333B] px-4 py-2 flex items-center gap-2 rounded text-sm font-bold uppercase tracking-widest transition-colors shadow-lg"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isGenerating ? "Gerando IA..." : "Gerar com IA"}
                  </button>
                )}
              </div>

              {steps.length === 0 ? (
                <div className="text-center p-12 border-2 border-dashed border-gray-800 rounded-xl">
                  <Settings2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg text-gray-300 font-medium mb-2">Nenhum script de treinamento</h3>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto">
                    A IA pode gerar um roteiro de manutenção ou plano de aula baseando-se no título da aula, descrição e marcadores (hotspots) anexados ao projeto.
                  </p>
                  <button 
                    onClick={generateTraining} 
                    disabled={isGenerating}
                    className="bg-lion-graphite hover:bg-lion-graphite-light text-lion-tech-blue border border-[#2D333B] px-6 py-3 flex items-center justify-center gap-2 rounded text-sm font-bold uppercase tracking-widest transition-colors shadow-lg mx-auto"
                  >
                    {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    {isGenerating ? "Gerando IA..." : "Gerar com IA"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                   {steps.map((step, i) => (
                      <div key={i} onClick={() => toggleStep(i)} className="flex gap-4 p-4 rounded-xl border border-gray-800 bg-lion-graphite hover:border-gray-600 transition-colors cursor-pointer group">
                         <div className="mt-1 flex-shrink-0">
                           {step.completed ? (
                             <CheckCircle2 className="w-6 h-6 text-green-500" />
                           ) : (
                             <Circle className="w-6 h-6 text-gray-500 group-hover:text-white transition-colors" />
                           )}
                         </div>
                         <div>
                            <h3 className={`text-lg font-medium mb-1 transition-colors ${step.completed ? 'text-gray-500 line-through' : 'text-white'}`}>{step.title}</h3>
                            <p className={`transition-colors ${step.completed ? 'text-gray-600' : 'text-gray-400'}`}>{step.desc}</p>
                         </div>
                      </div>
                   ))}
                   
                   <div className="flex justify-end mt-4">
                     <button 
                       onClick={generateTraining} 
                       disabled={isGenerating}
                       className="text-lion-tech-blue hover:text-blue-400 flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors"
                     >
                       {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                       Regerar
                     </button>
                   </div>
                </div>
              )}
              
              <div className="mt-10 p-6 rounded-xl border border-blue-500/30 bg-blue-500/5 flex flex-col sm:flex-row items-center gap-6 justify-between">
                <div>
                  <h3 className="font-medium text-lg text-blue-400 mb-2">Simulação em Realidade Aumentada</h3>
                  <p className="text-gray-400">Abra o gêmeo digital do equipamento para localizar exatamente cada componente.</p>
                </div>
                <Link to={`/viewer/${project.id}`} className="bg-lion-tech-blue hover:bg-blue-600 text-white px-6 py-3 rounded font-medium flex items-center gap-2 whitespace-nowrap shadow-lg shadow-blue-500/20">
                  <Box className="w-5 h-5" /> Abrir Simulação 3D
                </Link>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
