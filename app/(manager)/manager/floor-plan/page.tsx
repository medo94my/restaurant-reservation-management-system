'use client'

import React, { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import TableBarOutlinedIcon from '@mui/icons-material/TableBarOutlined'
import WeekendOutlinedIcon from '@mui/icons-material/WeekendOutlined'
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined'
import { EditableFloorPlan } from '@/components/editable-floor-plan'
import { useDiningStore } from '@/lib/dining-store'
import { createFloorUnit, generateNextUnitId } from '@/lib/floor-layout'
import { useBranding } from '@/components/shared/branding-context'
import type { Unit } from '@/lib/restaurant-config'

export default function ManagerFloorPlanPage() {
  const { branding } = useBranding()
  const units = useDiningStore((s) => s.units)
  const updateFloorUnits = useDiningStore((s) => s.updateFloorUnits)
  const [selectedKind, setSelectedKind] = useState<Unit['kind'] | 'all'>('all')

  const handleAddUnit = (kind: Unit['kind']) => {
    const newUnit = createFloorUnit(kind, units)
    updateFloorUnits([...units, newUnit])
  }

  const activeUnits = units.filter((u) => !u.archived)
  const filteredUnits =
    selectedKind === 'all' ? activeUnits : activeUnits.filter((u) => u.kind === selectedKind)

  const handleFloorChange = (nextFiltered: Unit[]) => {
    const filteredIds = new Set(filteredUnits.map((u) => u.id))

    if (nextFiltered.length === filteredUnits.length) {
      const replacementByOriginalId = new Map<string, Unit>()
      for (let i = 0; i < filteredUnits.length; i += 1) {
        const original = filteredUnits[i]
        const updated = nextFiltered[i]
        const isDuplicateRename =
          updated.id !== original.id &&
          units.some(
            (u) =>
              u.id !== original.id &&
              u.id.trim().toLowerCase() === updated.id.trim().toLowerCase()
          )
        replacementByOriginalId.set(
          original.id,
          isDuplicateRename ? ({ ...updated, id: original.id } as Unit) : updated
        )
      }
      updateFloorUnits(units.map((u) => replacementByOriginalId.get(u.id) ?? u))
      return
    }

    const updatedById = new Map<string, Unit>()
    const addedUnits: Unit[] = []
    for (const item of nextFiltered) {
      if (filteredIds.has(item.id)) {
        updatedById.set(item.id, item)
      } else {
        addedUnits.push(item)
      }
    }

    const mergedExisting = units.map((u) => {
      if (!filteredIds.has(u.id)) return u
      return updatedById.get(u.id) ?? ({ ...u, archived: true } as Unit)
    })

    const nextUnits = [...mergedExisting]
    for (const added of addedUnits) {
      const collides = nextUnits.some(
        (u) => u.id.trim().toLowerCase() === added.id.trim().toLowerCase()
      )
      const safeId = collides ? generateNextUnitId(added.kind, nextUnits) : added.id
      nextUnits.push({ ...added, id: safeId } as Unit)
    }

    updateFloorUnits(nextUnits)
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
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
              fontFamily: `var(--brand-font, ${branding.fontFamily || 'Cinzel'}), serif`,
              color: '#eee9df',
              fontWeight: 700,
              letterSpacing: 1,
              mb: 0.5,
            }}
          >
            Floor Plan & Table Layout
          </Typography>
          <Typography variant="body2" sx={{ color: '#9da49a' }}>
            Configure dining tables, lounge couches, and private dining rooms.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="contained"
            startIcon={<TableBarOutlinedIcon />}
            onClick={() => handleAddUnit('Table')}
            sx={{
              bgcolor: branding.primaryColor || '#d7b46a',
              color: '#171a18',
              fontWeight: 700,
              textTransform: 'none',
              '&:hover': { bgcolor: branding.secondaryColor || '#c4a259' },
            }}
          >
            Add Table
          </Button>

          <Button
            variant="outlined"
            startIcon={<WeekendOutlinedIcon />}
            onClick={() => handleAddUnit('Couch')}
            sx={{
              borderColor: '#444c45',
              color: '#eee9df',
              textTransform: 'none',
              '&:hover': { borderColor: branding.primaryColor || '#d7b46a' },
            }}
          >
            Add Couch
          </Button>

          <Button
            variant="outlined"
            startIcon={<MeetingRoomOutlinedIcon />}
            onClick={() => handleAddUnit('Room')}
            sx={{
              borderColor: '#444c45',
              color: '#eee9df',
              textTransform: 'none',
              '&:hover': { borderColor: branding.primaryColor || '#d7b46a' },
            }}
          >
            Add Room
          </Button>
        </Stack>
      </Box>

      <Card sx={{ bgcolor: '#171a18', border: '1px solid #2b302c', borderRadius: 3, p: 2 }}>
        <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
          <Chip
            label={`All Units (${activeUnits.length})`}
            onClick={() => setSelectedKind('all')}
            sx={{
              bgcolor: selectedKind === 'all' ? 'rgba(215, 180, 106, 0.2)' : '#202421',
              color: selectedKind === 'all' ? branding.primaryColor || '#d7b46a' : '#889186',
              cursor: 'pointer',
            }}
          />
          <Chip
            label="Tables"
            onClick={() => setSelectedKind('Table')}
            sx={{
              bgcolor: selectedKind === 'Table' ? 'rgba(215, 180, 106, 0.2)' : '#202421',
              color: selectedKind === 'Table' ? branding.primaryColor || '#d7b46a' : '#889186',
              cursor: 'pointer',
            }}
          />
          <Chip
            label="Couches"
            onClick={() => setSelectedKind('Couch')}
            sx={{
              bgcolor: selectedKind === 'Couch' ? 'rgba(215, 180, 106, 0.2)' : '#202421',
              color: selectedKind === 'Couch' ? branding.primaryColor || '#d7b46a' : '#889186',
              cursor: 'pointer',
            }}
          />
          <Chip
            label="Rooms"
            onClick={() => setSelectedKind('Room')}
            sx={{
              bgcolor: selectedKind === 'Room' ? 'rgba(215, 180, 106, 0.2)' : '#202421',
              color: selectedKind === 'Room' ? branding.primaryColor || '#d7b46a' : '#889186',
              cursor: 'pointer',
            }}
          />
        </Box>

        <EditableFloorPlan
          editable
          items={filteredUnits}
          onChange={handleFloorChange}
        />
      </Card>
    </Box>
  )
}
