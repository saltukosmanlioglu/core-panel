'use client';

import { useMemo, useState } from 'react';
import {
  Box,
  Checkbox,
  IconButton,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowDownward as ArrowDownwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  SwapVert as SwapVertIcon,
} from '@mui/icons-material';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DataTableColumn<T> {
  field: keyof T | string;
  headerName: string;
  width?: number;
  flex?: number;
  sortable?: boolean;
  renderCell?: (row: T) => React.ReactNode;
}

export interface DataTableAction<T> {
  label: string;
  icon: React.ReactNode;
  onClick: (row: T) => void;
  color?: 'primary' | 'error' | 'warning' | 'success';
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  loading?: boolean;
  pagination?: boolean;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  actions?: DataTableAction<T>[];
  selectable?: boolean;
  onSelectionChange?: (selectedRows: T[]) => void;
  getRowId?: (row: T) => string;
  emptyMessage?: string;
  title?: string;
  toolbarActions?: React.ReactNode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc' | 'none';

const ACTION_COLORS: Record<string, string> = {
  primary: '#1F2937',
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
};

function getFieldValue<T>(row: T, field: keyof T | string): unknown {
  return (row as Record<string, unknown>)[field as string];
}

function defaultGetRowId<T>(row: T, index: number): string {
  const r = row as Record<string, unknown>;
  return String(r['id'] ?? r['_id'] ?? index);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DataTable<T>({
  columns,
  rows,
  loading = false,
  pagination = true,
  defaultPageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  actions,
  selectable = false,
  onSelectionChange,
  getRowId,
  emptyMessage = 'Kayıt bulunamadı',
  title,
  toolbarActions,
}: DataTableProps<T>) {
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('none');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(defaultPageSize);

  const resolveId = (row: T, index: number) =>
    getRowId ? getRowId(row) : defaultGetRowId(row, index);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortField || sortDir === 'none') return rows;
    return [...rows].sort((a, b) => {
      const av = getFieldValue(a, sortField);
      const bv = getFieldValue(b, sortField);
      const as = String(av ?? '').toLowerCase();
      const bs = String(bv ?? '').toLowerCase();
      if (as < bs) return sortDir === 'asc' ? -1 : 1;
      if (as > bs) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sortField, sortDir]);

  // ── Paginate ─────────────────────────────────────────────────────────────
  const paginated = useMemo(() => {
    if (!pagination) return sorted;
    return sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [sorted, page, rowsPerPage, pagination]);

  // ── Sort handler ─────────────────────────────────────────────────────────
  const handleSort = (field: string) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else if (sortDir === 'desc') {
      setSortDir('none');
      setSortField(null);
    }
  };

  // ── Selection ────────────────────────────────────────────────────────────
  const toggleRow = (id: string, row: T) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    onSelectionChange?.(rows.filter((r, i) => next.has(resolveId(r, i))));
  };

  const toggleAll = () => {
    if (selected.size === paginated.length) {
      setSelected(new Set());
      onSelectionChange?.([]);
    } else {
      const ids = new Set(paginated.map((r, i) => resolveId(r, i)));
      setSelected(ids);
      onSelectionChange?.(paginated);
    }
  };

  const allSelected = paginated.length > 0 && paginated.every((r, i) => selected.has(resolveId(r, i)));
  const someSelected = !allSelected && paginated.some((r, i) => selected.has(resolveId(r, i)));

  // ── Pagination handlers ──────────────────────────────────────────────────
  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const showActions = actions && actions.length > 0;
  const colSpan = (selectable ? 1 : 0) + columns.length + (showActions ? 1 : 0);

  // ── Sort icon ────────────────────────────────────────────────────────────
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field || sortDir === 'none') return <SwapVertIcon sx={{ fontSize: 14, opacity: 0.5 }} />;
    return sortDir === 'asc'
      ? <ArrowUpwardIcon sx={{ fontSize: 14, color: '#3B82F6' }} />
      : <ArrowDownwardIcon sx={{ fontSize: 14, color: '#3B82F6' }} />;
  };

  return (
    <Box
      sx={{
        border: '1px solid #E5E7EB',
        borderRadius: '4px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      {(title || toolbarActions) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 2,
            py: 1.5,
            borderBottom: '1px solid #E5E7EB',
            backgroundColor: '#FFFFFF',
            flexWrap: 'wrap',
          }}
        >
          {title && (
            <Typography
              sx={{ fontWeight: 700, fontSize: '16px', color: '#1F2937', flexShrink: 0 }}
            >
              {title}
            </Typography>
          )}

          {toolbarActions && (
            <Box sx={{ ml: 'auto', display: 'flex', gap: 1, flexShrink: 0 }}>
              {toolbarActions}
            </Box>
          )}
        </Box>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ tableLayout: 'fixed', minWidth: 400 }}>
          {/* Column widths */}
          <colgroup>
            {selectable && <col style={{ width: 48 }} />}
            {columns.map((col, i) => (
              <col
                key={i}
                style={{
                  width: col.width ?? undefined,
                  ...(col.flex ? { width: `${col.flex * 100}%` } : {}),
                }}
              />
            ))}
            {showActions && <col style={{ width: 100 }} />}
          </colgroup>

          {/* Header */}
          <TableHead>
            <TableRow sx={{ backgroundColor: '#FFFFFF' }}>
              {selectable && (
                <TableCell padding="checkbox" sx={{ backgroundColor: '#FFFFFF', borderBottom: '2px solid #E5E7EB' }}>
                  <Checkbox
                    size="small"
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                    sx={{ color: '#CBD5E1', '&.Mui-checked': { color: '#1F2937' }, '&.MuiCheckbox-indeterminate': { color: '#1F2937' } }}
                  />
                </TableCell>
              )}
              {columns.map((col, i) => (
                <TableCell
                  key={i}
                  sx={{
                    color: '#111827',
                    fontWeight: 600,
                    fontSize: '13px',
                    borderBottom: '2px solid #E5E7EB',
                    whiteSpace: 'nowrap',
                    cursor: col.sortable ? 'pointer' : 'default',
                    userSelect: 'none',
                    '&:hover': col.sortable ? { backgroundColor: '#F9FAFB' } : {},
                    py: 1.5,
                  }}
                  onClick={() => col.sortable && handleSort(col.field as string)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {col.headerName}
                    {col.sortable && <SortIcon field={col.field as string} />}
                  </Box>
                </TableCell>
              ))}
              {showActions && (
                <TableCell
                  align="right"
                  sx={{ color: '#111827', fontWeight: 600, fontSize: '13px', borderBottom: '2px solid #E5E7EB', pr: 2 }}
                >
                  İşlemler
                </TableCell>
              )}
            </TableRow>
          </TableHead>

          {/* Body */}
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, ri) => (
                <TableRow key={ri}>
                  {selectable && (
                    <TableCell padding="checkbox">
                      <Skeleton variant="rectangular" width={18} height={18} sx={{ mx: 'auto' }} />
                    </TableCell>
                  )}
                  {columns.map((_, ci) => (
                    <TableCell key={ci}>
                      <Skeleton variant="text" sx={{ fontSize: '14px' }} />
                    </TableCell>
                  ))}
                  {showActions && (
                    <TableCell>
                      <Skeleton variant="text" sx={{ fontSize: '14px' }} />
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  align="center"
                  sx={{ py: 6, color: '#94A3B8', fontSize: '14px', border: 'none' }}
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((row, ri) => {
                const id = resolveId(row, ri);
                const isSelected = selected.has(id);
                const isEven = ri % 2 === 0;
                return (
                  <TableRow
                    key={id}
                    selected={isSelected}
                    hover
                    onClick={selectable ? () => toggleRow(id, row) : undefined}
                    sx={{
                      backgroundColor: isSelected
                        ? '#EFF6FF'
                        : isEven ? '#FFFFFF' : '#F9FAFB',
                      cursor: selectable ? 'pointer' : 'default',
                      '&:hover': { backgroundColor: '#EFF6FF !important' },
                      '&.Mui-selected': { backgroundColor: '#EFF6FF' },
                      '&.Mui-selected:hover': { backgroundColor: '#DBEAFE !important' },
                    }}
                  >
                    {selectable && (
                      <TableCell
                        padding="checkbox"
                        onClick={(e) => { e.stopPropagation(); toggleRow(id, row); }}
                      >
                        <Checkbox
                          size="small"
                          checked={isSelected}
                          sx={{
                            color: '#CBD5E1',
                            '&.Mui-checked': { color: '#1F2937' },
                          }}
                        />
                      </TableCell>
                    )}
                    {columns.map((col, ci) => (
                      <TableCell
                        key={ci}
                        sx={{ fontSize: '14px', color: '#1E293B', py: 1.25, borderBottom: '1px solid #F3F4F6' }}
                        onClick={(e) => showActions && ci === columns.length - 1 ? e.stopPropagation() : undefined}
                      >
                        {col.renderCell
                          ? col.renderCell(row)
                          : String(getFieldValue(row, col.field) ?? '')}
                      </TableCell>
                    ))}
                    {showActions && (
                      <TableCell
                        align="right"
                        sx={{ py: 0.5, borderBottom: '1px solid #F3F4F6', pr: 1 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                          {actions!.map((action, ai) => (
                            <Tooltip key={ai} title={action.label} arrow placement="top">
                              <IconButton
                                size="small"
                                onClick={() => action.onClick(row)}
                                sx={{
                                  color: ACTION_COLORS[action.color ?? 'primary'] ?? ACTION_COLORS.primary,
                                  '&:hover': {
                                    backgroundColor: `${ACTION_COLORS[action.color ?? 'primary']}14`,
                                  },
                                }}
                              >
                                {action.icon}
                              </IconButton>
                            </Tooltip>
                          ))}
                        </Box>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {pagination && (
        <Box sx={{ borderTop: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>
          <TablePagination
            component="div"
            count={sorted.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={pageSizeOptions}
            sx={{
              fontSize: '13px',
              color: '#6B7280',
              '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                fontSize: '13px',
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
}
