// src/components/projects/ProjectList.jsx
import React, { useState, useEffect } from 'react';
import { Plus, Search, FolderKanban, RotateCw } from 'lucide-react';
import { getAllProjects, deleteProject } from '../../services/projects';
import ProjectModal from './ProjectModal';
import ProjectCard from './ProjectCard';
import PageHeader from '../ui/PageHeader';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Field';
import { PageLoader } from '../ui/Spinner';
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
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
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
    return <PageLoader label="Memuat proyek…" />;
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

      {/* Pencarian + filter status */}
      <div className="mb-4 space-y-3 sm:mb-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari proyek, mitra, atau no. SPK…"
            className="pl-9"
          />
        </div>
        <div className="custom-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                filter === status
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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

      {/* Grid proyek */}
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
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={isAdmin ? handleEditProject : null}
              onDelete={isAdmin ? handleDeleteProject : null}
              currentUser={currentUser}
            />
          ))}
        </div>
      )}

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
