// src/components/projects/ProjectList.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, FolderKanban, RotateCw, LayoutGrid, Rows3 } from 'lucide-react';
import { getAllProjects, deleteProject } from '../../services/projects';
import { subscribe, CACHE_KEYS } from '../../services/cache';
import ProjectModal from './ProjectModal';
import ProjectCard from './ProjectCard';
import ShareSelectionModal, { SelectionActionBar, SelectBox } from '../ui/ShareSelectionModal';
import { buildProjectsSummaryMessage } from '../../utils/sharing';
import { getCompanySettings, mergeCompanyInfo } from '../../services/settings';
import { CheckSquare } from 'lucide-react';
import ProjectTableList from './ProjectTable';
import PageHeader from '../ui/PageHeader';
import Button from '../ui/Button';
import { SkeletonListPage } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import { getStatusLabel } from '../../utils/formatters';

const STATUS_FILTERS = ['all', 'akan-datang', 'ongoing', 'retensi', 'selesai'];

const ProjectList = ({ currentUser }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [filter, setFilter] = useState('all');
  // Tampilan daftar: tabel rapat (default, ala ERP) atau grid kartu.
  const [view, setView] = useState(() => localStorage.getItem('kontrack-project-view') || 'table');
  // Mode pilih: untuk mengirim ringkasan beberapa proyek sekaligus ke mitra.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  // Kop perusahaan untuk ringkasan; dimuat malas saat pertama dipakai supaya
  // halaman daftar tidak menunggu pembacaan settings.
  const [company, setCompany] = useState(null);
  const setViewAndSave = (v) => {
    setView(v);
    localStorage.setItem('kontrack-project-view', v);
  };
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '');

  useEffect(() => {
    loadProjects();
    // SWR: perbarui diam-diam saat cache disegarkan di belakang layar.
    const un = subscribe(CACHE_KEYS.PROJECTS, () => loadProjects({ silent: true }));
    return () => un();
  }, []);

  // Pencarian dikendalikan satu tempat saja: kotak di header mengirim ?q=…, dan
  // halaman ini mengikutinya. Tidak ada kotak pencarian kedua di sini supaya tidak
  // ada dua sumber kebenaran untuk hal yang sama.
  useEffect(() => {
    setSearchTerm(searchParams.get('q') || '');
  }, [searchParams]);

  const loadProjects = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const projectList = await getAllProjects();
      setProjects(projectList);
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Gagal memuat daftar proyek. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProject = (project) => {
    setEditingProject(project);
    setShowProjectModal(true);
  };

  const handleDeleteProject = async (project) => {
    const confirmed = window.confirm(
      `Hapus proyek "${project.name}"? Semua transaksi di dalamnya ikut terhapus dan tidak bisa dikembalikan.`
    );
    if (!confirmed) return;

    try {
      await deleteProject(project.id);
      await loadProjects();
    } catch (err) {
      console.error('Error deleting project:', err);
      alert('Gagal menghapus proyek. Silakan coba lagi.');
    }
  };

  const handleModalClose = () => {
    setShowProjectModal(false);
    setEditingProject(null);
  };

  const handleModalSuccess = () => {
    handleModalClose();
    loadProjects();
  };

  const filteredProjects = projects.filter((project) => {
    if (filter !== 'all' && project.status !== filter) {
      return false;
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        project.name.toLowerCase().includes(search) ||
        project.partner.toLowerCase().includes(search) ||
        (project.contractNumber && project.contractNumber.toLowerCase().includes(search))
      );
    }

    return true;
  });

  const countByStatus = (status) =>
    status === 'all'
      ? projects.length
      : projects.filter((p) => p.status === status).length;

  const isAdmin = currentUser && currentUser.role === 'admin';

  if (loading) {
    return <SkeletonListPage variant="cards" />;
  }

  if (error) {
    return (
      <EmptyState
        icon={RotateCw}
        title="Gagal memuat proyek"
        description={error}
        action={
          <Button variant="secondary" onClick={loadProjects}>
            <RotateCw className="h-4 w-4" />
            Coba Lagi
          </Button>
        }
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Proyek"
        subtitle={`${projects.length} proyek terdaftar`}
        actions={
          isAdmin && (
            <Button
              variant="gradient"
              onClick={() => {
                setEditingProject(null);
                setShowProjectModal(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Tambah Proyek
            </Button>
          )
        }
      />

      {/* Filter status. Pencarian tidak diulang di sini — header sudah punya satu,
          dan dua kotak pencarian untuk hal yang sama membingungkan. */}
      <div className="mb-4 sm:mb-6">
        <div className="custom-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                filter === status
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'glass-3 text-slate-600 hover:text-slate-900'
              }`}
            >
              {status === 'all' ? 'Semua' : getStatusLabel(status)}
              <span className={`ml-1.5 ${filter === status ? 'text-brand-200' : 'text-slate-400'}`}>
                {countByStatus(status)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Daftar proyek */}
      {filteredProjects.length > 0 && (
        <div className="mb-3 flex justify-end gap-1">
          <button
            onClick={() => {
              setSelectMode((v) => !v);
              setSelectedIds([]);
            }}
            title={selectMode ? 'Selesai memilih' : 'Pilih beberapa proyek untuk ringkasan'}
            className={`mr-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
              selectMode ? 'bg-brand-600 text-white' : 'glass-3 text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckSquare className="h-4 w-4" />
            {selectMode ? 'Selesai' : 'Pilih'}
          </button>
          <button
            onClick={() => setViewAndSave('table')}
            title="Tampilan tabel"
            className={`rounded-lg p-2 transition-colors ${view === 'table' ? 'bg-brand-600 text-white' : 'glass-3 text-slate-500 hover:text-slate-900'}`}
          >
            <Rows3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewAndSave('grid')}
            title="Tampilan kartu"
            className={`rounded-lg p-2 transition-colors ${view === 'grid' ? 'bg-brand-600 text-white' : 'glass-3 text-slate-500 hover:text-slate-900'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      )}
      {filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={
            searchTerm || filter !== 'all'
              ? 'Tidak ada proyek yang cocok'
              : 'Belum ada proyek'
          }
          description={
            searchTerm || filter !== 'all'
              ? 'Coba ubah kata kunci pencarian atau filter status.'
              : 'Mulai dengan menambahkan proyek atau kontrak pertama Anda.'
          }
          action={
            isAdmin &&
            !searchTerm &&
            filter === 'all' && (
              <Button variant="gradient" onClick={() => setShowProjectModal(true)}>
                <Plus className="h-4 w-4" />
                Tambah Proyek Pertama
              </Button>
            )
          }
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredProjects.map((project) => (
              <div key={project.id} className="relative">
                {selectMode && (
                  <div className="absolute right-2 top-2 z-10 rounded-md bg-glass-3 p-0.5">
                    <SelectBox
                      checked={selectedIds.includes(project.id)}
                      onChange={(v) =>
                        setSelectedIds((ids) => (v ? [...ids, project.id] : ids.filter((x) => x !== project.id)))
                      }
                      label={`Pilih ${project.name}`}
                    />
                  </div>
                )}
                <ProjectCard
                  project={project}
                  onEdit={isAdmin ? handleEditProject : null}
                  onDelete={isAdmin ? handleDeleteProject : null}
                  currentUser={currentUser}
                />
              </div>
            ))}
          </div>
        ) : (
          <ProjectTableList
            projects={filteredProjects}
            onEdit={isAdmin ? handleEditProject : null}
            onDelete={isAdmin ? handleDeleteProject : null}
            currentUser={currentUser}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={(id) =>
              setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
            }
          />
      )}

      {selectMode && (
        <SelectionActionBar
          count={selectedIds.length}
          total={filteredProjects.length}
          label="proyek"
          onSelectAll={() => setSelectedIds(filteredProjects.map((p) => p.id))}
          onClear={() => {
            setSelectedIds([]);
            setSelectMode(false);
          }}
          onShare={() => {
            const chosen = projects.filter((p) => selectedIds.includes(p.id));
            const build = (cmp) => setShareMessage(buildProjectsSummaryMessage(chosen, { company: cmp }));
            if (company) build(company);
            else
              getCompanySettings()
                .then((st) => {
                  const cmp = mergeCompanyInfo(st);
                  setCompany(cmp);
                  build(cmp);
                })
                .catch(() => build(null));
            setShareOpen(true);
          }}
        />
      )}

      <ShareSelectionModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Ringkasan Proyek"
        subtitle={`${selectedIds.length} proyek dipilih`}
        message={shareMessage}
        onMessageChange={setShareMessage}
        count={selectedIds.length}
      />

      {showProjectModal && isAdmin && (
        <ProjectModal
          isOpen={showProjectModal}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          project={editingProject}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default ProjectList;
