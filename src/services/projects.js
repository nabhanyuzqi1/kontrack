// src/services/projects.js
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  orderBy,
  where,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { withTimeout } from '../utils/async';

// Collection reference
const PROJECTS_COLLECTION = 'projects';

/**
 * Add a new project
 * @param {Object} projectData - Project data object
 * @param {string} userId - User ID (optional)
 * @param {string} userEmail - User email (optional)
 * @returns {Promise<string>} - Document ID of created project
 */
export const addProject = async (projectData, userId = null, userEmail = null) => {
  try {
    console.log('Adding project:', projectData);
    
    // Validate required fields
    if (!projectData.name || !projectData.partner || !projectData.value) {
      throw new Error('Missing required fields: name, partner, or value');
    }
    
    // Prepare data with timestamps
    const dataToSave = {
      ...projectData,
      value: Number(projectData.value),
      taxRate: Number(projectData.taxRate) || 11,
      paidAmount: Number(projectData.paidAmount) || 0,
      status: projectData.status || 'akan-datang',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      // Add user info if provided
      ...(userId && { createdBy: userId }),
      ...(userEmail && { createdByEmail: userEmail })
    };
    
    // Add to Firestore
    const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), dataToSave);
    console.log('Project created with ID:', docRef.id);
    
    return docRef.id;
  } catch (error) {
    console.error('Error adding project:', error);
    throw new Error(`Failed to add project: ${error.message}`);
  }
};

/**
 * Update an existing project
 * @param {string} projectId - Project document ID
 * @param {Object} updates - Fields to update
 * @param {string} userId - User ID (optional)
 * @param {string} userEmail - User email (optional)
 * @returns {Promise<void>}
 */
export const updateProject = async (projectId, updates, userId = null, userEmail = null) => {
  try {
    console.log('Updating project:', projectId, updates);
    
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    
    // Add updated timestamp and user info
    const dataToUpdate = {
      ...updates,
      updatedAt: Timestamp.now(),
      // Add user info if provided
      ...(userId && { updatedBy: userId }),
      ...(userEmail && { updatedByEmail: userEmail })
    };
    
    // Ensure numeric fields are numbers
    if (dataToUpdate.value !== undefined) {
      dataToUpdate.value = Number(dataToUpdate.value);
    }
    if (dataToUpdate.taxRate !== undefined) {
      dataToUpdate.taxRate = Number(dataToUpdate.taxRate);
    }
    if (dataToUpdate.paidAmount !== undefined) {
      dataToUpdate.paidAmount = Number(dataToUpdate.paidAmount);
    }
    
    await updateDoc(projectRef, dataToUpdate);
    console.log('Project updated successfully');
  } catch (error) {
    console.error('Error updating project:', error);
    throw new Error(`Failed to update project: ${error.message}`);
  }
};

/**
 * Delete a project and all its transactions
 * @param {string} projectId - Project document ID
 * @returns {Promise<void>}
 */
export const deleteProject = async (projectId) => {
  try {
    console.log('Deleting project:', projectId);
    
    // Get all transactions for this project
    const transactionsQuery = query(
      collection(db, 'transactions'),
      where('projectId', '==', projectId)
    );
    const transactionSnapshot = await getDocs(transactionsQuery);
    
    // Use batch to delete project and its transactions
    const batch = writeBatch(db);
    
    // Delete all related transactions
    transactionSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    // Delete the project
    batch.delete(doc(db, PROJECTS_COLLECTION, projectId));
    
    // Commit the batch
    await batch.commit();
    
    console.log(`Project ${projectId} and ${transactionSnapshot.size} related transactions deleted`);
  } catch (error) {
    console.error('Error deleting project:', error);
    throw new Error(`Failed to delete project: ${error.message}`);
  }
};

/**
 * Get all projects
 * @returns {Promise<Array>} - Array of project objects
 */
export const getAllProjects = async () => {
  try {
    const q = query(
      collection(db, PROJECTS_COLLECTION),
      orderBy('createdAt', 'desc')
    );
    
    // Batas waktu: Firestore tak selalu reject saat offline → cegah UI menggantung.
    const querySnapshot = await withTimeout(getDocs(q), 15000);
    const projects = [];

    querySnapshot.forEach((doc) => {
      projects.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return projects;
  } catch (error) {
    console.error('Error getting projects:', error);
    throw new Error(`Failed to retrieve projects: ${error.message}`);
  }
};

/**
 * Get project by ID
 * @param {string} projectId - Project document ID
 * @returns {Promise<Object>} - Project object
 */
export const getProject = async (projectId) => {
  try {
    const docRef = doc(db, PROJECTS_COLLECTION, projectId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      };
    } else {
      throw new Error('Project not found');
    }
  } catch (error) {
    console.error('Error getting project by ID:', error);
    throw new Error(`Failed to retrieve project: ${error.message}`);
  }
};

// Alias for backward compatibility
export const getProjectById = getProject;

/**
 * Get projects by status
 * @param {string} status - Project status
 * @returns {Promise<Array>} - Array of project objects
 */
export const getProjectsByStatus = async (status) => {
  try {
    const q = query(
      collection(db, PROJECTS_COLLECTION),
      where('status', '==', status),
      orderBy('startDate', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const projects = [];
    
    querySnapshot.forEach((doc) => {
      projects.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`Retrieved ${projects.length} projects with status ${status}`);
    return projects;
  } catch (error) {
    console.error('Error getting projects by status:', error);
    throw new Error(`Failed to retrieve projects by status: ${error.message}`);
  }
};

/**
 * Calculate project statistics
 * @param {Array} projects - Array of project objects
 * @returns {Object} - Statistics object
 */
export const calculateProjectStats = (projects) => {
  const stats = {
    totalProjects: projects.length,
    totalValue: 0,
    totalPaid: 0,
    totalRemaining: 0,
    byStatus: {
      'akan-datang': 0,
      'ongoing': 0,
      'retensi': 0,
      'selesai': 0
    },
    averageValue: 0,
    completionRate: 0
  };
  
  projects.forEach(project => {
    const value = Number(project.value) || 0;
    const paid = Number(project.paidAmount) || 0;
    
    stats.totalValue += value;
    stats.totalPaid += paid;
    
    // Count by status
    if (stats.byStatus[project.status] !== undefined) {
      stats.byStatus[project.status]++;
    }
  });
  
  stats.totalRemaining = stats.totalValue - stats.totalPaid;
  stats.averageValue = stats.totalProjects > 0 ? stats.totalValue / stats.totalProjects : 0;
  stats.completionRate = stats.totalValue > 0 ? (stats.totalPaid / stats.totalValue) * 100 : 0;
  
  return stats;
};

/**
 * Update project status based on dates
 * @param {string} projectId - Project ID
 * @returns {Promise<void>}
 */
export const updateProjectStatus = async (projectId) => {
  try {
    const project = await getProject(projectId);
    const today = new Date();
    const startDate = new Date(project.startDate);
    const endDate = new Date(project.endDate);
    
    let newStatus = project.status;
    
    if (today < startDate) {
      newStatus = 'akan-datang';
    } else if (today >= startDate && today <= endDate) {
      newStatus = 'ongoing';
    } else if (today > endDate && project.paidAmount < project.value) {
      newStatus = 'retensi';
    } else if (project.paidAmount >= project.value) {
      newStatus = 'selesai';
    }
    
    if (newStatus !== project.status) {
      await updateProject(projectId, { status: newStatus });
      console.log(`Project ${projectId} status updated to ${newStatus}`);
    }
  } catch (error) {
    console.error('Error updating project status:', error);
    // Don't throw error to prevent cascading failures
  }
};

/**
 * Get upcoming project deadlines
 * @param {number} days - Number of days to look ahead
 * @returns {Promise<Array>} - Array of projects nearing deadline
 */
export const getProjectsWithUpcomingDeadlines = async (days = 7) => {
  try {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);
    
    const projects = await getAllProjects();
    
    const upcomingDeadlines = projects.filter(project => {
      if (project.status !== 'ongoing') return false;
      
      const endDate = new Date(project.endDate);
      return endDate >= today && endDate <= futureDate;
    });
    
    return upcomingDeadlines.sort((a, b) => 
      new Date(a.endDate) - new Date(b.endDate)
    );
  } catch (error) {
    console.error('Error getting upcoming deadlines:', error);
    throw new Error(`Failed to retrieve upcoming deadlines: ${error.message}`);
  }
};

// Alias for backward compatibility
export const getUpcomingDeadlines = getProjectsWithUpcomingDeadlines;

// Export all functions
export default {
  addProject,
  updateProject,
  deleteProject,
  getAllProjects,
  getProject,
  getProjectById,
  getProjectsByStatus,
  calculateProjectStats,
  updateProjectStatus,
  getProjectsWithUpcomingDeadlines,
  getUpcomingDeadlines
};