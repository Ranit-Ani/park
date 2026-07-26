import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RequireAuth from './components/RequireAuth';
import CursorEffect from './components/CursorEffect';
import ToastHost from './components/ToastHost';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';

import UserDashboard from './pages/user/Dashboard';
import UserSlots from './pages/user/Slots';
import UserBook from './pages/user/Book';
import UserBookings from './pages/user/Bookings';

import StaffDashboard from './pages/staff/Dashboard';
import StaffCheckIn from './pages/staff/CheckIn';
import StaffCheckOut from './pages/staff/CheckOut';
import StaffBookings from './pages/staff/Bookings';

import AdminDashboard from './pages/admin/Dashboard';
import AdminSlots from './pages/admin/Slots';
import AdminUsers from './pages/admin/Users';
import AdminRevenue from './pages/admin/Revenue';
import AdminBookings from './pages/admin/Bookings';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CursorEffect />
        <ToastHost />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/profile" element={<RequireAuth roles={['user', 'staff', 'admin']}><Profile /></RequireAuth>} />

          <Route path="/user/dashboard" element={<RequireAuth roles={['user']}><UserDashboard /></RequireAuth>} />
          <Route path="/user/slots" element={<RequireAuth roles={['user']}><UserSlots /></RequireAuth>} />
          <Route path="/user/book" element={<RequireAuth roles={['user']}><UserBook /></RequireAuth>} />
          <Route path="/user/bookings" element={<RequireAuth roles={['user']}><UserBookings /></RequireAuth>} />

          <Route path="/staff/dashboard" element={<RequireAuth roles={['staff', 'admin']}><StaffDashboard /></RequireAuth>} />
          <Route path="/staff/checkin" element={<RequireAuth roles={['staff', 'admin']}><StaffCheckIn /></RequireAuth>} />
          <Route path="/staff/checkout" element={<RequireAuth roles={['staff', 'admin']}><StaffCheckOut /></RequireAuth>} />
          <Route path="/staff/bookings" element={<RequireAuth roles={['staff', 'admin']}><StaffBookings /></RequireAuth>} />

          <Route path="/admin/dashboard" element={<RequireAuth roles={['admin']}><AdminDashboard /></RequireAuth>} />
          <Route path="/admin/slots" element={<RequireAuth roles={['admin']}><AdminSlots /></RequireAuth>} />
          <Route path="/admin/users" element={<RequireAuth roles={['admin']}><AdminUsers /></RequireAuth>} />
          <Route path="/admin/revenue" element={<RequireAuth roles={['admin']}><AdminRevenue /></RequireAuth>} />
          <Route path="/admin/bookings" element={<RequireAuth roles={['admin']}><AdminBookings /></RequireAuth>} />

          <Route path="*" element={<Landing />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
