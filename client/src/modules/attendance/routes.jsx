import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AttendanceShell, { RequireProfile, RequireAttendanceAdmin } from './AttendanceShell';
import EmployeeDashboard from './pages/employee/Dashboard';
import EmployeeHistory from './pages/employee/History';
import EmployeeLeave from './pages/employee/Leave';
import EmployeeRegularization from './pages/employee/Regularization';
import EmployeeProfile from './pages/employee/Profile';
import AdminDashboard from './pages/admin/Dashboard';
import AdminEmployees from './pages/admin/Employees';
import AdminEmployeeAttendance from './pages/admin/EmployeeAttendance';
import AdminAttendance from './pages/admin/Attendance';
import AdminReports from './pages/admin/Reports';
import WFHRequests from './pages/admin/WFHRequests';
import AdminLeaveRequests from './pages/admin/LeaveRequests';
import AdminRegularizationRequests from './pages/admin/RegularizationRequests';

const emp = (el) => <RequireProfile>{el}</RequireProfile>;
const adm = (el) => <RequireAttendanceAdmin>{el}</RequireAttendanceAdmin>;

/**
 * Sub-router for /admin/attendance/*  (parent route uses a splat).
 * Loaded lazily from App.jsx so Flowdesk's main bundle is unaffected.
 */
export default function AttendanceRoutes() {
  return (
  <Routes>
  <Route element={<AttendanceShell />}>
    <Route index element={emp(<EmployeeDashboard />)} />
    <Route path="history" element={emp(<EmployeeHistory />)} />
    <Route path="leave" element={emp(<EmployeeLeave />)} />
    <Route path="regularization" element={emp(<EmployeeRegularization />)} />
    <Route path="profile" element={emp(<EmployeeProfile />)} />

    <Route path="manage" element={adm(<AdminDashboard />)} />
    <Route path="manage/employees" element={adm(<AdminEmployees />)} />
    <Route path="manage/employees/:id/attendance" element={adm(<AdminEmployeeAttendance />)} />
    <Route path="manage/attendance" element={adm(<AdminAttendance />)} />
    <Route path="manage/reports" element={adm(<AdminReports />)} />
    <Route path="manage/wfh-requests" element={adm(<WFHRequests />)} />
    <Route path="manage/leave-requests" element={adm(<AdminLeaveRequests />)} />
    <Route path="manage/regularization-requests" element={adm(<AdminRegularizationRequests />)} />
    <Route path="*" element={<Navigate to="/admin/attendance" replace />} />
  </Route>
  </Routes>
  );
}
