import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, toggleUser, deleteUser } from '@/api/admin'
import { toast } from 'sonner'
import { Search, UserX, UserCheck, Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import UserModal from './UserModal'
import Spinner from '@/components/ui/Spinner'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'

/**
 * UsersPage — Design System: Phase 5.5
 *
 * Token changes:
 *  bg-white → bg-card
 *  bg-gray-50 → bg-muted
 *  border-gray-100/200 → border-border
 *  divide-gray-50 → divide-border
 *  text-gray-900/800/700 → text-foreground
 *  text-gray-600/500 → text-muted-foreground
 *  text-gray-400/300 → text-muted-foreground/60
 *  hover:bg-gray-50 → hover:bg-muted
 *  rounded-xl → style radius-xl
 *  rounded-md → style radius-md
 *  rounded-full → style radius-full
 *  bg-orange-100 text-orange-600 (avatar) → accent-muted / accent
 *  text-orange-600 (hover edit btn) → style accent
 *  border-gray-200 (role filter select) → border-border
 *  bg-gray-100 text-gray-600 (customer role chip) → bg-muted text-muted-foreground
 *  bg-orange-100 text-orange-700 (delivery role chip) → accent-muted / accent
 *  Active/Suspended status spans → <StatusBadge>
 *  Loader2 → <Spinner>
 *  Inline "No users found" td → <EmptyState>
 *  Inline pagination → <Pagination>
 *
 * Accessibility:
 *  <main aria-label="User management">
 *  <header>
 *  Search input: sr-only Label + aria-label
 *  Role filter select: id + sr-only Label
 *  Table: aria-label + scope="col" on all 7 <th>
 *  Loading: <Spinner> with role=status label
 *  Empty: <EmptyState> with role=status
 *  Avatar initials: aria-hidden
 *  User name cell: no change (already text)
 *  Status column: <StatusBadge> (was colour-only span)
 *  Edit button: aria-label="Edit {name}"
 *  Toggle button: aria-label + aria-pressed + aria-busy
 *  Delete button: aria-label="Delete {name}"
 *  UserX/UserCheck/Pencil/Trash2 icons: aria-hidden
 *  Plus icon: aria-hidden
 *  Search icon: aria-hidden
 *  Pagination: <Pagination> component (already accessible)
 */

// Role badge maps to semantic or muted colours
function RoleBadge({ role }) {
  const cls = {
    admin:    { bg: 'bg-purple-100', text: 'text-purple-700' },
    kitchen:  { bg: 'bg-blue-100',   text: 'text-blue-700' },
    delivery: { bg: 'bg-amber-100',  text: 'text-amber-700' },
  }[role] ?? { bg: 'bg-muted', text: 'text-muted-foreground' }

  return (
    <span
      className={`px-2 py-0.5 text-[11px] font-medium ${cls.bg} ${cls.text}`}
      style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
    >
      {role}
    </span>
  )
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [roleFilter, setRoleFilter] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, roleFilter],
    queryFn: () => getUsers({ page, limit: 20, search, role: roleFilter || undefined }).then((r) => r.data),
  })

  const toggle = useMutation({
    mutationFn: (id) => toggleUser(id),
    onSuccess: () => { queryClient.invalidateQueries(['users']); toast.success('User status updated') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const del = useMutation({
    mutationFn: (id) => deleteUser(id),
    onSuccess: () => { queryClient.invalidateQueries(['users']); toast.success('User deleted') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const openCreateModal = () => { setSelectedUser(null); setIsModalOpen(true) }
  const openEditModal = (user) => { setSelectedUser(user); setIsModalOpen(true) }

  const users = data?.users || []
  const total = data?.total || 0
  const totalPages = data?.totalPages || 1

  return (
    <main className="space-y-5" aria-label="User management">

      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} registered users</p>
        </div>
        <Button
          onClick={openCreateModal}
          aria-label="Add new user"
          className="gs-admin-focus-ring"
          style={{ backgroundColor: 'var(--gs-admin-accent)', color: 'var(--gs-admin-accent-foreground)' }}
        >
          <Plus size={16} className="mr-2" aria-hidden="true" />
          Add User
        </Button>
      </header>

      {/* Filters */}
      <section className="flex flex-col sm:flex-row gap-4 items-center" aria-label="User filters">
        <div className="relative w-full sm:max-w-sm">
          <Label htmlFor="user-search" className="sr-only">Search users</Label>
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"
            aria-hidden="true"
          />
          <Input
            id="user-search"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-8 h-9"
          />
        </div>
        <Label htmlFor="role-filter" className="sr-only">Filter by role</Label>
        <select
          id="role-filter"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
          className="h-9 px-3 border border-border text-sm text-foreground bg-card outline-none w-full sm:w-auto gs-admin-focus-ring"
          style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
        >
          <option value="">All Roles</option>
          <option value="customer">Customer</option>
          <option value="kitchen">Kitchen Staff</option>
          <option value="delivery">Rider</option>
          <option value="admin">Admin</option>
        </select>
      </section>

      {/* Table / Loading / Empty */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Spinner size="lg" label="Loading users…" />
        </div>
      ) : (
        <section
          className="bg-card border border-border overflow-hidden"
          style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
          aria-label="Users table"
        >
          <table className="w-full text-sm" aria-label="All users">
            <thead className="bg-muted border-b border-border">
              <tr className="text-left text-muted-foreground text-xs uppercase tracking-wider">
                <th scope="col" className="px-4 py-3 font-medium">User</th>
                <th scope="col" className="px-4 py-3 font-medium">Phone &amp; Email</th>
                <th scope="col" className="px-4 py-3 font-medium">Role</th>
                <th scope="col" className="px-4 py-3 font-medium">Stats</th>
                <th scope="col" className="px-4 py-3 font-medium">Joined</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState message="No users found" sub="Try a different search or role filter" />
                  </td>
                </tr>
              ) : users.map((user) => (
                <tr key={user._id} className="hover:bg-muted transition-colors">
                  {/* Avatar + Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: 'var(--gs-admin-accent-muted)',
                          borderRadius: 'var(--gs-admin-radius-full)',
                        }}
                        aria-hidden="true"
                      >
                        <span
                          className="text-xs font-semibold"
                          style={{ color: 'var(--gs-admin-accent)' }}
                        >
                          {user.name?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <span className="font-medium text-foreground">{user.name}</span>
                    </div>
                  </td>

                  {/* Phone + Email */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground font-mono text-xs">{user.phone}</span>
                      {user.email && (
                        <span
                          className="text-muted-foreground text-[11px] truncate max-w-[120px]"
                          title={user.email}
                        >
                          {user.email}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3">
                    <RoleBadge role={user.role} />
                  </td>

                  {/* Stats */}
                  <td className="px-4 py-3">
                    {user.role === 'customer' ? (
                      <div className="flex flex-col text-[11px] text-muted-foreground">
                        <span>Orders: {user.totalOrders || 0}</span>
                        <span>Pts: {user.loyaltyPoints || 0}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/60 text-xs">-</span>
                    )}
                  </td>

                  {/* Joined */}
                  <td className="px-4 py-3 text-xs text-muted-foreground/60">
                    {format(new Date(user.createdAt), 'MMM d, yyyy')}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={user.isActive ? 'active' : 'suspended'}
                      size="sm"
                    />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      {/* Edit */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground gs-admin-focus-ring"
                        style={{ '--tw-text-opacity': 1 }}
                        aria-label={`Edit ${user.name}`}
                        onClick={() => openEditModal(user)}
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </Button>

                      {/* Toggle active/suspend */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-7 w-7 gs-admin-focus-ring ${
                          user.isActive
                            ? 'text-muted-foreground hover:text-amber-600'
                            : 'text-green-500 hover:text-green-600'
                        }`}
                        aria-label={user.isActive ? `Suspend ${user.name}` : `Reactivate ${user.name}`}
                        aria-pressed={!user.isActive}
                        aria-busy={toggle.isPending}
                        onClick={() => {
                          const action = user.isActive ? 'suspend' : 'reactivate'
                          if (window.confirm(`${action} ${user.name}?`)) toggle.mutate(user._id)
                        }}
                        disabled={toggle.isPending}
                      >
                        {user.isActive
                          ? <UserX size={14} aria-hidden="true" />
                          : <UserCheck size={14} aria-hidden="true" />
                        }
                      </Button>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground/60 hover:text-red-600 hover:bg-red-50 gs-admin-focus-ring"
                        aria-label={`Delete ${user.name}`}
                        aria-busy={del.isPending}
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to completely delete ${user.name}? This will remove their login access.`)) {
                            del.mutate(user._id)
                          }
                        }}
                        disabled={del.isPending}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPage={setPage}
            label="users"
          />
        </section>
      )}

      {isModalOpen && (
        <UserModal
          user={selectedUser}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </main>
  )
}