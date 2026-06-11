import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Box, Shield, Zap } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const { user, signIn } = useAuth();

  if (user) return <Navigate to="/" />;

  return (
    <div className="min-h-screen flex items-center justify-center cad-grid">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-lion-graphite border border-lion-graphite-light p-8 rounded-xl shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-lion-tech-blue-glow blur-[100px] rounded-full pointer-events-none" />
        
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-lion-tech-blue rounded flex items-center justify-center">
            <Box className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-display font-bold text-3xl tracking-tight">RA Lion</h1>
        </div>
        
        <p className="text-gray-400 mb-8 font-mono text-sm uppercase tracking-wider">
          Plataforma Industrial de Realidade Aumentada
        </p>
        
        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-3 text-sm text-gray-300">
            <Shield className="w-4 h-4 text-lion-orange" /> Treinamento Técnico e Manutenção
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-300">
            <Zap className="w-4 h-4 text-lion-tech-blue" /> WebAR, WebXR e Modelos 3D
          </div>
        </div>

        <button 
          onClick={signIn}
          className="w-full bg-lion-tech-blue hover:bg-blue-600 text-white p-4 rounded font-medium flex items-center justify-center gap-2 transition-colors border border-blue-400/20"
        >
          Acessar Plataforma (Google)
        </button>
      </motion.div>
    </div>
  );
}
