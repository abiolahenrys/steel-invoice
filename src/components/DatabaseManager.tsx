
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Database, 
  Search, 
  Edit, 
  Trash2, 
  Plus, 
  Download,
  Upload,
  Filter,
  RefreshCw
} from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useInvoices } from '@/hooks/useInvoices';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const DatabaseManager = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTable, setActiveTable] = useState('invoices');

  const { user } = useAuth();
  const { data: clients = [] } = useClients();
  const { data: invoices = [] } = useInvoices();

  // Fetch invoice items
  const { data: invoiceItems = [] } = useQuery({
    queryKey: ['invoice_items'],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*');
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch all profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*');
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const tables = {
    invoices: invoices.map(inv => ({
      ...inv,
      client_name: inv.clients?.company_name || 'Unknown'
    })),
    clients,
    profiles,
    invoice_items: invoiceItems.map(item => ({
      ...item,
      invoices: undefined // Remove nested invoice data for cleaner display
    }))
  };

  const tableConfigs = {
    invoices: {
      name: 'Invoices',
      columns: ['id', 'invoice_number', 'client_name', 'total_amount', 'status', 'issue_date', 'due_date'],
      editable: ['total_amount', 'status', 'issue_date', 'due_date']
    },
    clients: {
      name: 'Clients',
      columns: ['id', 'company_name', 'contact_name', 'email', 'phone', 'address'],
      editable: ['company_name', 'contact_name', 'email', 'phone', 'address']
    },
    profiles: {
      name: 'User Profiles',
      columns: ['id', 'first_name', 'last_name', 'created_at'],
      editable: ['first_name', 'last_name']
    },
    invoice_items: {
      name: 'Invoice Items',
      columns: ['id', 'invoice_id', 'description', 'quantity', 'unit_price', 'line_total'],
      editable: ['description', 'quantity', 'unit_price', 'line_total']
    }
  };

  const formatValue = (value: any, column: string) => {
    if (value === null || value === undefined) return '-';
    
    if (column.includes('amount') || column.includes('price') || column.includes('total')) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(Number(value));
    }
    
    if (column.includes('date') || column.includes('at')) {
      return new Date(value).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    return String(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      case 'draft': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const currentTable = tables[activeTable as keyof typeof tables] || [];
  const currentConfig = tableConfigs[activeTable as keyof typeof tableConfigs];

  const filteredData = currentTable.filter((row: any) => {
    if (!searchTerm) return true;
    return Object.values(row).some(value => 
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Database Manager</h1>
          <p className="text-steel-600 mt-1">Direct access to view and manage database records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button className="steel-button">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="steel-card">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-steel-400 h-4 w-4" />
                <Input
                  placeholder={`Search ${currentConfig?.name.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Advanced Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Database Tables */}
      <Card className="steel-card">
        <CardHeader>
          <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
            <Database className="w-5 h-5 mr-2" />
            Database Tables
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTable} onValueChange={setActiveTable}>
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="invoices">Invoices ({tables.invoices.length})</TabsTrigger>
              <TabsTrigger value="clients">Clients ({tables.clients.length})</TabsTrigger>
              <TabsTrigger value="profiles">Profiles ({tables.profiles.length})</TabsTrigger>
              <TabsTrigger value="invoice_items">Items ({tables.invoice_items.length})</TabsTrigger>
            </TabsList>

            {Object.keys(tables).map((tableName) => (
              <TabsContent key={tableName} value={tableName} className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">
                    {tableConfigs[tableName as keyof typeof tableConfigs]?.name} 
                    <span className="text-steel-500 text-sm ml-2">
                      ({filteredData.length} records)
                    </span>
                  </h3>
                  <Button size="sm" className="steel-button">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Record
                  </Button>
                </div>

                <div className="overflow-x-auto border border-steel-200 rounded-lg">
                  <table className="w-full">
                    <thead className="bg-steel-50">
                      <tr>
                        {currentConfig?.columns.map((column) => (
                          <th key={column} className="text-left py-3 px-4 font-medium text-steel-700 text-sm">
                            {column.replace(/_/g, ' ').toUpperCase()}
                          </th>
                        ))}
                        <th className="text-left py-3 px-4 font-medium text-steel-700 text-sm">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((row: any, index: number) => (
                        <tr key={row.id || index} className="border-b border-steel-100 hover:bg-steel-50">
                          {currentConfig?.columns.map((column) => (
                            <td key={column} className="py-3 px-4 text-sm">
                              {column === 'status' ? (
                                <Badge className={getStatusColor(row[column])}>
                                  {row[column]}
                                </Badge>
                              ) : (
                                <span className={column === 'id' ? 'font-mono text-xs text-steel-500' : 'text-gray-900'}>
                                  {formatValue(row[column], column)}
                                </span>
                              )}
                            </td>
                          ))}
                          <td className="py-3 px-4">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredData.length === 0 && (
                  <div className="text-center py-8">
                    <Database className="w-12 h-12 mx-auto text-steel-300 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">No records found</h3>
                    <p className="text-steel-600">
                      {searchTerm ? 'No records match your search criteria.' : 'This table is empty.'}
                    </p>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Database Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(tables).map(([tableName, data]) => (
          <Card key={tableName} className="steel-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-steel-600 capitalize">
                    {tableName.replace('_', ' ')}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">{data.length}</p>
                </div>
                <Database className="w-8 h-8 text-primary-600" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DatabaseManager;
