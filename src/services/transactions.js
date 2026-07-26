// src/services/transactions.js
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  getDocs,
  getDoc,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { db, storage } from './firebase';
import { invalidate, CACHE_KEYS } from './cache';

// Collection reference
const TRANSACTIONS_COLLECTION = 'transactions';

/**
 * Add a new transaction
 * @param {Object} transactionData - Transaction data object
 * @returns {Promise<string>} - Document ID of created transaction
 */
export const addTransaction = async (transactionData) => {
  try {
    console.log('Adding transaction:', transactionData);
    
    // Validate required fields
    if (!transactionData.projectId || !transactionData.amount || !transactionData.type) {
      throw new Error('Missing required fields: projectId, amount, or type');
    }
    
    // Prepare data with timestamps
    const dataToSave = {
      ...transactionData,
      amount: Number(transactionData.amount),
      date: transactionData.date || new Date().toISOString(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    // Add to Firestore
    const docRef = await addDoc(collection(db, TRANSACTIONS_COLLECTION), dataToSave);
    invalidate(CACHE_KEYS.TRANSACTIONS);
    invalidate(CACHE_KEYS.PROJECTS);
    
    // Update project paid amount if it's an income transaction
    if (transactionData.type === 'income' && transactionData.projectId) {
      await updateProjectPaidAmount(transactionData.projectId);
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error adding transaction:', error);
    throw new Error(`Failed to add transaction: ${error.message}`);
  }
};

/**
 * Update an existing transaction
 * @param {string} transactionId - Transaction document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export const updateTransaction = async (transactionId, updates) => {
  try {
    console.log('Updating transaction:', transactionId, updates);
    
    const transactionRef = doc(db, TRANSACTIONS_COLLECTION, transactionId);
    
    // Add updated timestamp
    const dataToUpdate = {
      ...updates,
      updatedAt: Timestamp.now()
    };
    
    // If amount is being updated, ensure it's a number
    if (dataToUpdate.amount !== undefined) {
      dataToUpdate.amount = Number(dataToUpdate.amount);
    }
    
    await updateDoc(transactionRef, dataToUpdate);
    invalidate(CACHE_KEYS.TRANSACTIONS);
    invalidate(CACHE_KEYS.PROJECTS);
    
    // Update project paid amount if relevant
    if (updates.projectId || updates.amount !== undefined || updates.type) {
      const projectId = updates.projectId || (await getTransactionById(transactionId)).projectId;
      await updateProjectPaidAmount(projectId);
    }
  } catch (error) {
    console.error('Error updating transaction:', error);
    throw new Error(`Failed to update transaction: ${error.message}`);
  }
};

/**
 * Delete a transaction
 * @param {string} transactionId - Transaction document ID
 * @param {Object} transaction - Transaction object (for cleanup)
 * @returns {Promise<void>}
 */
export const deleteTransaction = async (transactionId, transaction) => {
  try {
    console.log('Deleting transaction:', transactionId);
    
    // Delete associated image from storage if exists
    if (transaction?.imagePath) {
      try {
        const imageRef = ref(storage, transaction.imagePath);
        await deleteObject(imageRef);
        console.log('Associated image deleted from storage');
      } catch (storageError) {
        console.error('Error deleting image from storage:', storageError);
        // Continue with transaction deletion even if image deletion fails
      }
    }
    
    // Delete transaction document
    await deleteDoc(doc(db, TRANSACTIONS_COLLECTION, transactionId));
    console.log('Transaction deleted successfully');
    
    // Update project paid amount
    if (transaction?.projectId) {
      await updateProjectPaidAmount(transaction.projectId);
    }
  } catch (error) {
    console.error('Error deleting transaction:', error);
    throw new Error(`Failed to delete transaction: ${error.message}`);
  }
};

/**
 * Get all transactions
 * @returns {Promise<Array>} - Array of transaction objects
 */
export const getAllTransactions = async () => {
  try {
    const q = query(
      collection(db, TRANSACTIONS_COLLECTION),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const transactions = [];
    
    querySnapshot.forEach((doc) => {
      transactions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`Retrieved ${transactions.length} transactions`);
    return transactions;
  } catch (error) {
    console.error('Error getting transactions:', error);
    throw new Error(`Failed to retrieve transactions: ${error.message}`);
  }
};

/**
 * Get transactions by project ID
 * @param {string} projectId - Project ID to filter by
 * @returns {Promise<Array>} - Array of transaction objects
 */
export const getTransactionsByProject = async (projectId) => {
  try {
    const q = query(
      collection(db, TRANSACTIONS_COLLECTION),
      where('projectId', '==', projectId),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const transactions = [];
    
    querySnapshot.forEach((doc) => {
      transactions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`Retrieved ${transactions.length} transactions for project ${projectId}`);
    return transactions;
  } catch (error) {
    console.error('Error getting transactions by project:', error);
    throw new Error(`Failed to retrieve project transactions: ${error.message}`);
  }
};

/**
 * Get transactions by date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} - Array of transaction objects
 */
export const getTransactionsByDateRange = async (startDate, endDate) => {
  try {
    const q = query(
      collection(db, TRANSACTIONS_COLLECTION),
      where('date', '>=', startDate.toISOString()),
      where('date', '<=', endDate.toISOString()),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const transactions = [];
    
    querySnapshot.forEach((doc) => {
      transactions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`Retrieved ${transactions.length} transactions in date range`);
    return transactions;
  } catch (error) {
    console.error('Error getting transactions by date range:', error);
    throw new Error(`Failed to retrieve transactions by date range: ${error.message}`);
  }
};

/**
 * Get transaction by ID
 * @param {string} transactionId - Transaction document ID
 * @returns {Promise<Object>} - Transaction object
 */
export const getTransactionById = async (transactionId) => {
  try {
    const docRef = doc(db, TRANSACTIONS_COLLECTION, transactionId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      };
    } else {
      throw new Error('Transaction not found');
    }
  } catch (error) {
    console.error('Error getting transaction by ID:', error);
    throw new Error(`Failed to retrieve transaction: ${error.message}`);
  }
};

/**
 * Calculate transaction statistics
 * @param {Array} transactions - Array of transaction objects
 * @returns {Object} - Statistics object
 */
export const calculateTransactionStats = (transactions) => {
  const stats = {
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    transactionCount: transactions.length,
    incomeCount: 0,
    expenseCount: 0,
    byCategory: {},
    byMonth: {}
  };
  
  transactions.forEach(transaction => {
    const amount = Number(transaction.amount) || 0;
    
    if (transaction.type === 'income') {
      stats.totalIncome += amount;
      stats.incomeCount++;
    } else {
      stats.totalExpense += amount;
      stats.expenseCount++;
    }
    
    // Group by category
    if (!stats.byCategory[transaction.category]) {
      stats.byCategory[transaction.category] = {
        income: 0,
        expense: 0,
        count: 0
      };
    }
    
    stats.byCategory[transaction.category].count++;
    if (transaction.type === 'income') {
      stats.byCategory[transaction.category].income += amount;
    } else {
      stats.byCategory[transaction.category].expense += amount;
    }
    
    // Group by month
    const date = new Date(transaction.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!stats.byMonth[monthKey]) {
      stats.byMonth[monthKey] = {
        income: 0,
        expense: 0,
        count: 0
      };
    }
    
    stats.byMonth[monthKey].count++;
    if (transaction.type === 'income') {
      stats.byMonth[monthKey].income += amount;
    } else {
      stats.byMonth[monthKey].expense += amount;
    }
  });
  
  stats.balance = stats.totalIncome - stats.totalExpense;
  
  return stats;
};

/**
 * Update project paid amount based on income transactions
 * @param {string} projectId - Project ID
 * @returns {Promise<void>}
 */
const updateProjectPaidAmount = async (projectId) => {
  try {
    // Import updateDoc from projects service to avoid circular dependency
    const { doc: projectDoc, updateDoc: updateProjectDoc } = await import('firebase/firestore');
    
    // Get all income transactions for this project
    const incomeTransactions = await getTransactionsByProject(projectId);
    const incomeOnly = incomeTransactions.filter(t => t.type === 'income');
    
    // Calculate total paid amount
    const paidAmount = incomeOnly.reduce((sum, t) => sum + Number(t.amount), 0);
    
    // Update project document
    const projectRef = projectDoc(db, 'projects', projectId);
    await updateProjectDoc(projectRef, {
      paidAmount: paidAmount,
      updatedAt: Timestamp.now()
    });
    
    console.log(`Updated project ${projectId} paid amount to ${paidAmount}`);
  } catch (error) {
    console.error('Error updating project paid amount:', error);
    // Don't throw error to prevent transaction failure
  }
};

/**
 * Batch delete transactions
 * @param {Array<string>} transactionIds - Array of transaction IDs to delete
 * @returns {Promise<void>}
 */
export const batchDeleteTransactions = async (transactionIds) => {
  try {
    const batch = writeBatch(db);
    
    transactionIds.forEach(id => {
      const docRef = doc(db, TRANSACTIONS_COLLECTION, id);
      batch.delete(docRef);
    });
    
    await batch.commit();
    console.log(`Batch deleted ${transactionIds.length} transactions`);
  } catch (error) {
    console.error('Error batch deleting transactions:', error);
    throw new Error(`Failed to batch delete transactions: ${error.message}`);
  }
};

// Export all functions
export default {
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getAllTransactions,
  getTransactionsByProject,
  getTransactionsByDateRange,
  getTransactionById,
  calculateTransactionStats,
  batchDeleteTransactions
};