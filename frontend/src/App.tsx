import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import { RequireAuth } from '@/components/RequireAuth'
import { AppLayout } from '@/components/AppLayout'
import { Landing } from '@/pages/Landing'
import { Login } from '@/pages/Login'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { ResetPassword } from '@/pages/ResetPassword'
import { NotFound } from '@/pages/NotFound'
import {
  Attendance,
  AuditLog,
  Departments,
  EmployeeEdit,
  EmployeeNew,
  EmployeeProfile,
  Employees,
  Home,
  JobTitles,
  UsersAndRoles,
} from '@/pages/app'

/**
 * The route table.
 *
 * Two groups. Everything above `RequireAuth` is public — the landing page
 * and the three sign-in screens. Everything nested under it is closed to
 * the logged out and redirects them to /login.
 *
 * Worth repeating, because it is the thing most easily misread: this
 * guard hides screens, it does not protect data. A determined person can
 * edit the JavaScript in their own browser and render any page here.
 * What stops them reading a single row is row-level security in the
 * database, proved in database/tests/.
 */
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public. */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Staff only. */}
          <Route element={<RequireAuth />}>
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Home />} />
              <Route path="employees" element={<Employees />} />
              <Route path="employees/new" element={<EmployeeNew />} />
              <Route path="employees/:personId" element={<EmployeeProfile />} />
              <Route path="employees/:personId/edit" element={<EmployeeEdit />} />
              <Route path="departments" element={<Departments />} />
              <Route path="job-titles" element={<JobTitles />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="users" element={<UsersAndRoles />} />
              <Route path="audit-log" element={<AuditLog />} />
            </Route>
          </Route>

          {/* Old habits: /dashboard is what people type. */}
          <Route path="/dashboard" element={<Navigate to="/app" replace />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
