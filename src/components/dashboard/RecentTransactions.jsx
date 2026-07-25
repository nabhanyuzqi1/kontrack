// src/components/dashboard/RecentTransactions.jsx
import React from 'react';
import TransactionTable from '../transactions/TransactionTable';
import { Card, CardHeader } from '../ui/Card';

const RecentTransactions = ({ transactions }) => (
  <Card>
    <CardHeader title="Transaksi Terbaru" />
    <TransactionTable transactions={transactions} onEdit={null} onDelete={null} showProject={true} />
  </Card>
);

export default RecentTransactions;
