import { Box, CheckCircle2, Circle, Settings2 } from 'lucide-react';

export default function TrainingModule() {
  const steps = [
    { title: "Inspeção Visual Inicial", desc: "Verificar vazamentos hidráulicos ou danos estruturais externos.", completed: false },
    { title: "Verificação de Fluidos", desc: "Checar níveis de óleo do motor, hidráulico e líquido de arrefecimento.", completed: false },
    { title: "Sistemas de Segurança", desc: "Testar alarmes de ré, luzes estroboscópicas e buzina.", completed: false },
    { title: "Esteiras e Trem de Pouso", desc: "Avaliar tensão das esteiras, roletes e sapatas.", completed: false },
  ];

  return (
    <div className="flex-1 p-8 cad-grid overflow-y-auto">
      <div className="max-w-4xl mx-auto">
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
                   <h1 className="text-3xl font-display font-medium">Inspeção Pré-Operacional: Escavadeira</h1>
                </div>
             </div>
             <p className="text-gray-400 max-w-2xl text-lg leading-relaxed">
               Este módulo guia a inspeção diária em equipamentos pesados. Acesse a Realidade Aumentada para visualizar graficamente os pontos de checagem.
             </p>
           </div>

           {/* Content */}
           <div className="p-8">
              <h2 className="text-xl font-medium mb-6 font-display">Procedimento Operacional (Checklist)</h2>
              <div className="space-y-4">
                 {steps.map((step, i) => (
                    <div key={i} className="flex gap-4 p-4 rounded-xl border border-gray-800 bg-lion-graphite hover:border-gray-600 transition-colors cursor-pointer group">
                       <div className="mt-1 flex-shrink-0">
                         {step.completed ? (
                           <CheckCircle2 className="w-6 h-6 text-green-500" />
                         ) : (
                           <Circle className="w-6 h-6 text-gray-500 group-hover:text-white transition-colors" />
                         )}
                       </div>
                       <div>
                          <h3 className="text-lg font-medium mb-1">{step.title}</h3>
                          <p className="text-gray-400">{step.desc}</p>
                       </div>
                    </div>
                 ))}
              </div>
              
              <div className="mt-10 p-6 rounded-xl border border-blue-500/30 bg-blue-500/5 flex flex-col sm:flex-row items-center gap-6 justify-between">
                <div>
                  <h3 className="font-medium text-lg text-blue-400 mb-2">Simulação em Realidade Aumentada</h3>
                  <p className="text-gray-400">Abra o gêmeo digital do equipamento para localizar exatamente cada componente.</p>
                </div>
                <button className="bg-lion-tech-blue hover:bg-blue-600 text-white px-6 py-3 rounded font-medium flex items-center gap-2 whitespace-nowrap shadow-lg shadow-blue-500/20">
                  <Box className="w-5 h-5" /> Abrir Simulação 3D
                </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
