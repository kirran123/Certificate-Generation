import { useContext } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthContext } from './context/AuthContext'
import Login from './pages/Login'
import Layout from './components/Layout'
import AdminDashboard from './pages/AdminDashboard'
import UserDashboard from './pages/UserDashboard'
import UploadData from './pages/UploadData'
import TemplateDesigner from './pages/TemplateDesigner'
import VerifyPortal from './pages/VerifyPortal'
import Feedback from './pages/Feedback'

function ProtectedRoute({ children, requireAdmin }) {
  const { user } = useContext(AuthContext);
  
  if (!user) return <Navigate to="/login" />;
  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" />;
  }
  
  return <Layout>{children}</Layout>;
}

function App() {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <div className="h-screen bg-[var(--bg-main)] flex items-center justify-center text-[var(--text-primary)]">
    <div className="flex flex-col items-center space-y-4">
      <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-50">Loading...</span>
    </div>
  </div>;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        
        {/* Routes */}
        <Route path="/" element={<ProtectedRoute>{user?.role === 'admin' ? <AdminDashboard /> : <UserDashboard />}</ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
        <Route path="/admin/dashboard" element={<ProtectedRoute requireAdmin={true}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><UploadData /></ProtectedRoute>} />
        <Route path="/designer" element={<ProtectedRoute><TemplateDesigner /></ProtectedRoute>} />
        <Route path="/verify-portal" element={<VerifyPortal />} />
        <Route path="/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
        
        {/* Public verify page via QR */}
        <Route path="/verify/:id" element={<VerifyPortal />} />
      </Routes>
    </Router>
  )
}

export default App
