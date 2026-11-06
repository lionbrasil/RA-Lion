import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Wrench, GraduationCap } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Navbar() {
  const { user, logOut } = useAuth();
  const location = useLocation();
  const path = location.pathname;

  return (
    <>
      {/* Top Header Bar */}
      <header className="h-14 bg-lion-header border-b border-lion-graphite-light shrink-0 flex items-center justify-between px-4 sm:px-6 z-40 sticky top-0">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-3 active:scale-95 transition-transform">
            <div className="w-8 h-8 bg-lion-orange rounded-lg flex items-center justify-center font-bold text-black text-sm uppercase shadow-sm">
              {user?.email?.[0] || 'RL'}
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight uppercase text-white font-display leading-none">
                RA LION
              </span>
              <span className="text-[10px] text-lion-tech-blue font-mono tracking-wider uppercase leading-tight">
                Industrial AR
              </span>
            </div>
          </Link>
          
          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex gap-6 items-center ml-4 border-l border-lion-graphite-light pl-6 py-1">
            <Link 
              to="/" 
              className={cn(
                "flex items-center gap-2 text-xs font-semibold tracking-wider uppercase transition-colors py-1.5", 
                path === '/' ? "text-lion-tech-blue" : "text-gray-400 hover:text-white"
              )}
            >
              <LayoutDashboard className="w-4 h-4" /> Projetos
            </Link>
            <Link 
              to="/editor" 
              className={cn(
                "flex items-center gap-2 text-xs font-semibold tracking-wider uppercase transition-colors py-1.5", 
                path.startsWith('/editor') ? "text-lion-tech-blue" : "text-gray-400 hover:text-white"
              )}
            >
              <Wrench className="w-4 h-4" /> Editor AR
            </Link>
            <Link 
              to="/training" 
              className={cn(
                "flex items-center gap-2 text-xs font-semibold tracking-wider uppercase transition-colors py-1.5", 
                path.startsWith('/training') ? "text-lion-tech-blue" : "text-gray-400 hover:text-white"
              )}
            >
              <GraduationCap className="w-4 h-4" /> Treinamento
            </Link>
          </nav>
        </div>

        {/* User profile & actions */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="truncate max-w-[150px]">{user?.displayName || user?.email?.split('@')[0]}</span>
          </div>

          {user?.photoURL && (
            <img 
              src={user.photoURL} 
              alt="Profile" 
              className="w-8 h-8 rounded-lg border border-lion-graphite-light hidden sm:block object-cover" 
            />
          )}

          <button 
            onClick={logOut}
            className="min-w-[44px] min-h-[44px] p-2 text-gray-400 hover:text-red-400 active:text-red-400 transition-colors flex items-center justify-center rounded-lg hover:bg-white/5 active:bg-white/10"
            title="Sair da Conta"
            aria-label="Sair da Conta"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Fixed Bottom Navigation Bar (Pattern 1: Fixed Bottom Tab Bar) */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-lion-header/95 backdrop-blur-xl border-t border-lion-graphite-light h-16 flex items-center justify-around px-2 pb-safe shadow-2xl"
        aria-label="Navegação Principal Mobile"
      >
        <Link 
          to="/" 
          className={cn(
            "flex flex-col items-center justify-center min-w-[64px] min-h-[48px] py-1 transition-colors relative",
            path === '/' ? "text-lion-tech-blue" : "text-gray-400 active:text-white"
          )}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-semibold tracking-tight mt-1">Projetos</span>
          {path === '/' && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-lion-tech-blue"></span>}
        </Link>

        <Link 
          to="/editor" 
          className={cn(
            "flex flex-col items-center justify-center min-w-[64px] min-h-[48px] py-1 transition-colors relative",
            path.startsWith('/editor') ? "text-lion-tech-blue" : "text-gray-400 active:text-white"
          )}
        >
          <Wrench className="w-5 h-5" />
          <span className="text-[10px] font-semibold tracking-tight mt-1">Editor AR</span>
          {path.startsWith('/editor') && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-lion-tech-blue"></span>}
        </Link>

        <Link 
          to="/training" 
          className={cn(
            "flex flex-col items-center justify-center min-w-[64px] min-h-[48px] py-1 transition-colors relative",
            path.startsWith('/training') ? "text-lion-tech-blue" : "text-gray-400 active:text-white"
          )}
        >
          <GraduationCap className="w-5 h-5" />
          <span className="text-[10px] font-semibold tracking-tight mt-1">Treinar</span>
          {path.startsWith('/training') && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-lion-tech-blue"></span>}
        </Link>
      </nav>
    </>
  );
}

