/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Editor from './pages/Editor';
import TrainingModule from './pages/TrainingModule';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="h-screen w-screen flex items-center justify-center cad-grid">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-lion-black flex flex-col text-gray-200 font-sans">
          <Toaster theme="dark" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/viewer/:projectId" element={<Editor viewOnly={true} />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <Navbar />
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/editor/:projectId?" element={
              <ProtectedRoute>
                <Navbar />
                <Editor />
              </ProtectedRoute>
            } />

            <Route path="/training/:projectId?" element={
              <ProtectedRoute>
                <Navbar />
                <TrainingModule />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
