import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import AdminSession from './pages/AdminSession';
import AdminPresent from './pages/AdminPresent';
import AdminResults from './pages/AdminResults';
import StudentJoin from './pages/StudentJoin';
import StudentLobby from './pages/StudentLobby';
import StudentVote from './pages/StudentVote';
import StudentResults from './pages/StudentResults';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public landing */}
        <Route path="/" element={<Navigate to="/join" replace />} />

        {/* Student flow */}
        <Route path="/join" element={<StudentJoin />} />
        <Route path="/lobby" element={<StudentLobby />} />
        <Route path="/vote" element={<StudentVote />} />
        <Route path="/results-student" element={<StudentResults />} />

        {/* Admin flow */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/session/:id" element={<AdminSession />} />
        <Route path="/admin/session/:id/present" element={<AdminPresent />} />
        <Route path="/admin/session/:id/results" element={<AdminResults />} />
      </Routes>
    </BrowserRouter>
  );
}
