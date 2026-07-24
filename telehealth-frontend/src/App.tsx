import { BrowserRouter as Router, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import Home from './Home';
import Clinic from './Clinic';
import Dashboard from './Dashboard';
import Login from './Login';
import { getAuthToken } from './auth';
import Consultation from './pages/Consultation'; // Import component mới tạo

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();

  if (!getAuthToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/clinic" element={<Clinic />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        {/* Đưa Route này vào bên trong Routes */}
        <Route 
          path="/consultation/:appointmentId" 
          element={
            <RequireAuth>
              <Consultation />
            </RequireAuth>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;