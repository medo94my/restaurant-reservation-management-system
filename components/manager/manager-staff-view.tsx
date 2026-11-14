'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Alert,
} from '@mui/material'
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined'
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined'
import { useSession } from '@/lib/auth/client'

interface StaffMemberData {
  id: string
  name: string
  staffId: string
  role: 'manager' | 'hostess'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export function ManagerStaffView() {
  const router = useRouter()
  const { data: sessionData } = useSession()
  const currentStaff = sessionData?.user as { id?: string; staffId?: string } | undefined

  const [staffList, setStaffList] = useState<StaffMemberData[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Create Staff Modal State
  const [createOpen, setCreateOpen] = useState(false)
  const [newStaffId, setNewStaffId] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<'manager' | 'hostess'>('hostess')
  const [newPasscode, setNewPasscode] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset Passcode Modal State
  const [resetOpen, setResetOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<StaffMemberData | null>(null)
  const [resetPasscode, setResetPasscode] = useState('')

  const fetchStaff = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/staff')
      if (res.status === 401) {
        setErrorMsg('Authentication expired or unauthorized. Please re-login if needed.')
        return
      }
      if (res.status === 403) {
        setErrorMsg('Manager access required. Please sign in with an authorized manager account.')
        return
      }
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load staff accounts.')
      }
      setStaffList(data.staff || [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching staff.'
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStaff()
  }, [])

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStaffId.trim() || !newName.trim() || !newPasscode.trim()) {
      setErrorMsg('All fields are required.')
      return
    }

    setSaving(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: newStaffId.trim(),
          name: newName.trim(),
          role: newRole,
          passcode: newPasscode,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create staff account.')
      }

      setSuccessMsg(`Staff account '${newStaffId.toUpperCase()}' created successfully.`)
      setCreateOpen(false)
      setNewStaffId('')
      setNewName('')
      setNewPasscode('')
      setNewRole('hostess')
      fetchStaff()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating staff.'
      setErrorMsg(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (member: StaffMemberData) => {
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await fetch(`/api/staff/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: !member.isActive,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Unable to update staff status.')
      }

      setSuccessMsg(
        `Staff account '${member.staffId}' is now ${!member.isActive ? 'Active' : 'Deactivated'}.`
      )
      fetchStaff()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update status.'
      setErrorMsg(msg)
    }
  }

  const handleResetPasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStaff || !resetPasscode.trim()) return

    setSaving(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await fetch(`/api/staff/${selectedStaff.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passcode: resetPasscode,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Unable to reset passcode.')
      }

      setSuccessMsg(`Passcode for '${selectedStaff.staffId}' has been reset successfully.`)
      setResetOpen(false)
      setSelectedStaff(null)
      setResetPasscode('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error resetting passcode.'
      setErrorMsg(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      {/* Title & Actions Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontFamily: 'var(--brand-font, "Cinzel"), serif',
              color: '#eee9df',
              fontWeight: 700,
              letterSpacing: 1,
              mb: 0.5,
            }}
          >
            Staff Accounts & Access Control
          </Typography>
          <Typography variant="body2" sx={{ color: '#9da49a' }}>
            Manage staff credentials, assigned operational roles, and active permissions.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<PersonAddOutlinedIcon />}
          onClick={() => {
            setErrorMsg('')
            setCreateOpen(true)
          }}
          sx={{
            bgcolor: '#d7b46a',
            color: '#171a18',
            fontWeight: 700,
            textTransform: 'none',
            '&:hover': { bgcolor: '#c4a259' },
          }}
        >
          Create Staff Account
        </Button>
      </Box>

      {errorMsg && (
        <Alert
          severity="error"
          onClose={() => setErrorMsg('')}
          action={
            errorMsg.includes('Manager access') || errorMsg.includes('Authentication') ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => router.push('/login')}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Sign In as Manager
              </Button>
            ) : undefined
          }
          sx={{ mb: 3, bgcolor: 'rgba(224, 125, 114, 0.15)' }}
        >
          {errorMsg}
        </Alert>
      )}

      {successMsg && (
        <Alert
          severity="success"
          onClose={() => setSuccessMsg('')}
          sx={{ mb: 3, bgcolor: 'rgba(124, 179, 130, 0.15)' }}
        >
          {successMsg}
        </Alert>
      )}

      <Card sx={{ bgcolor: '#171a18', border: '1px solid #2b302c', borderRadius: 3 }}>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress size={32} sx={{ color: '#d7b46a' }} />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead sx={{ bgcolor: '#202421' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#889186', fontWeight: 600, fontSize: '0.78rem' }}>
                      STAFF ID
                    </TableCell>
                    <TableCell sx={{ color: '#889186', fontWeight: 600, fontSize: '0.78rem' }}>
                      NAME
                    </TableCell>
                    <TableCell sx={{ color: '#889186', fontWeight: 600, fontSize: '0.78rem' }}>
                      ROLE
                    </TableCell>
                    <TableCell sx={{ color: '#889186', fontWeight: 600, fontSize: '0.78rem' }}>
                      STATUS
                    </TableCell>
                    <TableCell sx={{ color: '#889186', fontWeight: 600, fontSize: '0.78rem' }}>
                      CREATED
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ color: '#889186', fontWeight: 600, fontSize: '0.78rem' }}
                    >
                      ACTIONS
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {staffList.map((member) => {
                    const isSelf = member.id === currentStaff?.id || member.staffId === currentStaff?.staffId
                    return (
                      <TableRow
                        key={member.id}
                        sx={{
                          '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.02)' },
                          borderColor: '#2b302c',
                        }}
                      >
                        <TableCell sx={{ color: '#eee9df', fontWeight: 700, fontFamily: 'monospace' }}>
                          {member.staffId}
                          {isSelf && (
                            <Chip
                              label="YOU"
                              size="small"
                              sx={{
                                ml: 1,
                                height: 18,
                                fontSize: '0.6rem',
                                bgcolor: 'rgba(215, 180, 106, 0.15)',
                                color: '#d7b46a',
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell sx={{ color: '#eee9df', fontWeight: 500 }}>
                          {member.name}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={member.role.toUpperCase()}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              bgcolor:
                                member.role === 'manager'
                                  ? 'rgba(215, 180, 106, 0.15)'
                                  : 'rgba(157, 164, 154, 0.15)',
                              color: member.role === 'manager' ? '#d7b46a' : '#9da49a',
                              border: `1px solid ${
                                member.role === 'manager'
                                  ? 'rgba(215, 180, 106, 0.3)'
                                  : 'rgba(157, 164, 154, 0.3)'
                              }`,
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Switch
                              checked={member.isActive}
                              onChange={() => handleToggleActive(member)}
                              size="small"
                              color="success"
                            />
                            <Typography
                              variant="caption"
                              sx={{
                                color: member.isActive ? '#7cb382' : '#889186',
                                fontWeight: 600,
                              }}
                            >
                              {member.isActive ? 'Active' : 'Disabled'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ color: '#889186', fontSize: '0.82rem' }}>
                          {new Date(member.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            <Tooltip title="Reset Passcode">
                              <IconButton
                                size="small"
                                aria-label={`Reset passcode for ${member.name}`}
                                onClick={() => {
                                  setSelectedStaff(member)
                                  setResetPasscode('')
                                  setResetOpen(true)
                                }}
                                sx={{
                                  color: '#9da49a',
                                  '&:hover': { color: '#d7b46a', bgcolor: 'rgba(215, 180, 106, 0.1)' },
                                }}
                              >
                                <VpnKeyOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create Staff Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: { bgcolor: '#171a18', border: '1px solid #343a35', borderRadius: 3 },
          },
        }}
      >
        <DialogTitle sx={{ color: '#eee9df', fontWeight: 700 }}>
          Create Staff Account
        </DialogTitle>
        <Box component="form" onSubmit={handleCreateStaff}>
          <DialogContent sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Staff ID"
              placeholder="e.g. HOST-02"
              value={newStaffId}
              onChange={(e) => setNewStaffId(e.target.value)}
              sx={{ mb: 2 }}
              helperText="Unique identifier for staff login"
            />

            <TextField
              fullWidth
              label="Staff Full Name"
              placeholder="e.g. Maya Zahr"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              sx={{ mb: 2 }}
            />

            <Typography variant="caption" sx={{ color: '#9da49a', display: 'block', mb: 0.5 }}>
              Assigned Role
            </Typography>
            <Select
              fullWidth
              size="small"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'manager' | 'hostess')}
              sx={{ mb: 2 }}
            >
              <MenuItem value="hostess">Hostess (Floor & Bookings)</MenuItem>
              <MenuItem value="manager">Manager (Full Administrative Access)</MenuItem>
            </Select>

            <TextField
              fullWidth
              label="Initial Passcode"
              type="password"
              placeholder="Min 4 characters"
              value={newPasscode}
              onChange={(e) => setNewPasscode(e.target.value)}
              sx={{ mb: 1 }}
              helperText="Staff member will use this to sign in"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button
              onClick={() => setCreateOpen(false)}
              disabled={saving}
              sx={{ color: '#9da49a', textTransform: 'none' }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              sx={{
                bgcolor: '#d7b46a',
                color: '#171a18',
                fontWeight: 700,
                textTransform: 'none',
                '&:hover': { bgcolor: '#c4a259' },
              }}
            >
              {saving ? <CircularProgress size={18} sx={{ color: '#171a18' }} /> : 'Create Account'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Reset Passcode Dialog */}
      <Dialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: { bgcolor: '#171a18', border: '1px solid #343a35', borderRadius: 3 },
          },
        }}
      >
        <DialogTitle sx={{ color: '#eee9df', fontWeight: 700 }}>
          Reset Passcode: {selectedStaff?.staffId}
        </DialogTitle>
        <Box component="form" onSubmit={handleResetPasscodeSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ color: '#9da49a', mb: 2 }}>
              Set a new passcode for {selectedStaff?.name}. Active sessions for this account will be
              invalidated.
            </Typography>

            <TextField
              fullWidth
              label="New Passcode"
              type="password"
              placeholder="Enter new passcode (min 4 characters)"
              value={resetPasscode}
              onChange={(e) => setResetPasscode(e.target.value)}
              autoFocus
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button
              onClick={() => setResetOpen(false)}
              disabled={saving}
              sx={{ color: '#9da49a', textTransform: 'none' }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving || resetPasscode.length < 4}
              sx={{
                bgcolor: '#d7b46a',
                color: '#171a18',
                fontWeight: 700,
                textTransform: 'none',
                '&:hover': { bgcolor: '#c4a259' },
              }}
            >
              {saving ? <CircularProgress size={18} sx={{ color: '#171a18' }} /> : 'Save New Passcode'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}
