import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, LogOut, LayoutDashboard, Wrench, GraduationCap } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Navbar() {
  const { user, logOut } = useAuth();
  const location = useLocation();
  const path = location.pathname;

  return (
    <nav className="h-14 bg-lion-header border-b border-lion-graphite-light shrink-0 flex items-center justify-between px-6 z-50">
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center gap-4">
          <div className="w-8 h-8 bg-lion-orange rounded flex items-center justify-center font-bold text-black uppercase">
            {user?.email?.[0] || 'RL'}
          </div>
          <h1 className="text-lg font-semibold tracking-tight uppercase text-white hidden sm:block">
            RA LION <span className="text-lion-tech-blue font-light">Editor</span>
          </h1>
        </Link>
        
        <div className="hidden md:flex gap-6 items-center ml-4 border-l border-lion-graphite-light pl-6 py-2">
          <Link 
            to="/" 
            className={cn("flex items-center gap-2 text-xs font-semibold tracking-widest uppercase transition-colors", path === '/' ? "text-lion-tech-blue" : "text-gray-400 hover:text-white")}
          >
            <LayoutDashboard className="w-4 h-4" /> Projetos
          </Link>
          <Link 
            to="/editor" 
            className={cn("flex items-center gap-2 text-xs font-semibold tracking-widest uppercase transition-colors", path.startsWith('/editor') ? "text-lion-tech-blue" : "text-gray-400 hover:text-white")}
          >
            <Wrench className="w-4 h-4" /> Editor AR
          </Link>
          <Link 
            to="/training" 
            className={cn("flex items-center gap-2 text-xs font-semibold tracking-widest uppercase transition-colors", path.startsWith('/training') ? "text-lion-tech-blue" : "text-gray-400 hover:text-white")}
          >
            <GraduationCap className="w-4 h-4" /> Treinamento
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-gray-400 uppercase">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          User: {user?.displayName || user?.email?.split('@')[0]}
        </div>
        <div className="flex items-center gap-3">
          {user?.photoURL && (
            <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded border border-lion-graphite-light hidden sm:block" />
          )}
          <button 
            onClick={logOut}
            className="p-2 text-gray-500 hover:text-red-400 transition-colors"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
