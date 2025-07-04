
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Trash2, Search, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { useClients, useCreateClient } from '@/hooks/useClients';
import { useInventory } from '@/hooks/useInventory';
import { useCreateInvoice, useUpdateInvoice } from '@/hooks/useInvoices';
import { useCreateInvoiceItems, useUpdateInventoryQuantity } from '@/hooks/useInvoiceItems';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import ClientModal from './ClientModal';

type Invoice = Tables<'invoices'> & {
  clients?: {
    id: string;
    company_name: string;
    contact_name: string;
    email: string;
    address?: string;
  };
};

interface InvoiceItem {
  id: string;
  inventory_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice?: Invoice;
}

type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue';

const InvoiceModal: React.FC<InvoiceModalProps> = ({ isOpen, onClose, invoice }) => {
  const [formData, setFormData] = useState<{
    client_id: string;
    invoice_number: string;
    issue_date: Date;
    due_date: Date;
    notes: string;
    status: InvoiceStatus;
  }>({
    client_id: '',
    invoice_number: '',
    issue_date: new Date(),
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    notes: '',
    status: 'draft'
  });

  const [items, setItems] = useState<InvoiceItem[]>([
    { id: '1', inventory_id: '', description: '', quantity: 1, unit_price: 0, line_total: 0 }
  ]);

  const [clientSearch, setClientSearch] = useState('');
  const [inventorySearches, setInventorySearches] = useState<Record<string, string>>({});
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  const { data: clients = [] } = useClients();
  const { data: inventory = [] } = useInventory();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const createInvoiceItems = useCreateInvoiceItems();
  const updateInventoryQuantity = useUpdateInventoryQuantity();
  const createClient = useCreateClient();
  const { toast } = useToast();

  // Filter clients based on search
  const filteredClients = clients.filter(client =>
    client.company_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.contact_name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  // Filter inventory based on search and availability
  const getFilteredInventory = (searchTerm: string) => {
    return inventory.filter(item => 
      item.quantity > 0 && (
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    );
  };

  useEffect(() => {
    if (invoice && isOpen) {
      console.log('Loading invoice data:', invoice);
      setFormData({
        client_id: invoice.client_id,
        invoice_number: invoice.invoice_number,
        issue_date: new Date(invoice.issue_date),
        due_date: new Date(invoice.due_date),
        notes: invoice.notes || '',
        status: invoice.status as InvoiceStatus
      });
      
      // For existing invoices, show a simple line item
      setItems([{
        id: '1',
        inventory_id: '',
        description: 'Steel fabrication services',
        quantity: 1,
        unit_price: invoice.subtotal,
        line_total: invoice.subtotal
      }]);
    } else if (!invoice && isOpen) {
      const invoiceCount = Date.now().toString().slice(-4);
      setFormData({
        client_id: '',
        invoice_number: `INV-${invoiceCount}`,
        issue_date: new Date(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: '',
        status: 'draft'
      });
      setItems([{ id: '1', inventory_id: '', description: '', quantity: 1, unit_price: 0, line_total: 0 }]);
      setInventorySearches({});
    }
  }, [invoice, isOpen]);

  const calculateItemTotal = (quantity: number, unitPrice: number) => {
    return quantity * unitPrice;
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.line_total, 0);
  };

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: string | number) => {
    console.log('Updating item:', id, field, value);
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        if (field === 'quantity') {
          const newQuantity = Number(value);
          
          // Check if quantity exceeds available inventory
          if (updatedItem.inventory_id) {
            const inventoryItem = inventory.find(inv => inv.id === updatedItem.inventory_id);
            if (inventoryItem && newQuantity > inventoryItem.quantity) {
              toast({
                title: "Insufficient Inventory",
                description: `Only ${inventoryItem.quantity} units available for ${inventoryItem.name}`,
                variant: "destructive",
              });
              // Set quantity to maximum available
              updatedItem.quantity = inventoryItem.quantity;
            } else {
              updatedItem.quantity = newQuantity;
            }
          } else {
            updatedItem.quantity = newQuantity;
          }
        }
        
        if (field === 'quantity' || field === 'unit_price') {
          updatedItem.line_total = calculateItemTotal(
            field === 'quantity' ? updatedItem.quantity : updatedItem.quantity,
            field === 'unit_price' ? Number(value) : updatedItem.unit_price
          );
        }
        
        console.log('Updated item:', updatedItem);
        return updatedItem;
      }
      return item;
    }));
  };

  const handleInventorySelect = (itemId: string, inventoryItemId: string) => {
    console.log('Selecting inventory item:', itemId, inventoryItemId);
    const inventoryItem = inventory.find(item => item.id === inventoryItemId);
    if (inventoryItem) {
      console.log('Found inventory item:', inventoryItem);
      setItems(prevItems => prevItems.map(item => {
        if (item.id === itemId) {
          // Validate quantity doesn't exceed available stock
          const validQuantity = Math.min(item.quantity, inventoryItem.quantity);
          
          const updatedItem = {
            ...item,
            inventory_id: inventoryItemId,
            description: inventoryItem.name,
            unit_price: inventoryItem.unit_price,
            quantity: validQuantity,
            line_total: calculateItemTotal(validQuantity, inventoryItem.unit_price)
          };
          console.log('Updated item with inventory:', updatedItem);
          return updatedItem;
        }
        return item;
      }));
      
      // Clear the search for this item
      setInventorySearches(prev => ({
        ...prev,
        [itemId]: ''
      }));
    }
  };

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      inventory_id: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      line_total: 0
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
      // Remove search state for this item
      setInventorySearches(prev => {
        const newSearches = { ...prev };
        delete newSearches[id];
        return newSearches;
      });
    }
  };

  const validateItems = () => {
    for (const item of items) {
      if (!item.inventory_id || !item.description || item.quantity <= 0 || item.unit_price <= 0) {
        return false;
      }
      
      // Check inventory availability
      const inventoryItem = inventory.find(inv => inv.id === item.inventory_id);
      if (inventoryItem && item.quantity > inventoryItem.quantity) {
        toast({
          title: "Insufficient Inventory",
          description: `Only ${inventoryItem.quantity} units available for ${inventoryItem.name}`,
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  const handleAddNewClient = () => {
    setIsClientModalOpen(true);
    setIsClientDropdownOpen(false);
  };

  const handleClientModalClose = () => {
    setIsClientModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.client_id) {
      toast({
        title: "Error",
        description: "Please select a client",
        variant: "destructive",
      });
      return;
    }

    if (!invoice && !validateItems()) {
      toast({
        title: "Error",
        description: "Please select inventory items for all line items",
        variant: "destructive",
      });
      return;
    }

    const subtotal = calculateSubtotal();
    const invoiceData = {
      client_id: formData.client_id,
      invoice_number: formData.invoice_number,
      issue_date: format(formData.issue_date, 'yyyy-MM-dd'),
      due_date: format(formData.due_date, 'yyyy-MM-dd'),
      notes: formData.notes,
      status: formData.status,
      subtotal: subtotal,
      tax_amount: 0,
      total_amount: subtotal
    };

    console.log('Final invoice data being submitted:', invoiceData);

    try {
      let invoiceId: string;

      if (invoice) {
        // Update existing invoice
        const updatedInvoice = await updateInvoice.mutateAsync({ 
          id: invoice.id, 
          ...invoiceData
        });
        invoiceId = invoice.id;
      } else {
        // Create new invoice
        const newInvoice = await createInvoice.mutateAsync(invoiceData);
        invoiceId = newInvoice.id;
        
        // Create invoice items with inventory_id
        const invoiceItems = items.map(item => ({
          invoice_id: invoiceId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total
        }));
        
        await createInvoiceItems.mutateAsync(invoiceItems);
        
        // Reduce inventory quantities
        for (const item of items) {
          if (item.inventory_id && item.quantity > 0) {
            await updateInventoryQuantity.mutateAsync({
              inventoryId: item.inventory_id,
              quantityToReduce: item.quantity
            });
          }
        }
      }

      toast({
        title: "Success",
        description: invoice ? "Invoice updated successfully" : "Invoice created successfully",
      });
      onClose();
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Error",
        description: "Failed to save invoice",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{invoice ? 'Edit Invoice' : 'Create New Invoice'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="client">Client *</Label>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search clients..."
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setIsClientDropdownOpen(true);
                      }}
                      onFocus={() => setIsClientDropdownOpen(true)}
                      className="pl-10"
                    />
                  </div>
                  {isClientDropdownOpen && clientSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {filteredClients.length > 0 ? (
                        <>
                          {filteredClients.map((client) => (
                            <div
                              key={client.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onClick={() => {
                                setFormData({ ...formData, client_id: client.id });
                                setClientSearch(client.company_name);
                                setIsClientDropdownOpen(false);
                              }}
                            >
                              <div className="font-medium">{client.company_name}</div>
                              <div className="text-sm text-gray-600">{client.contact_name}</div>
                            </div>
                          ))}
                          <div
                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-t border-gray-200 text-blue-600 font-medium flex items-center"
                            onClick={handleAddNewClient}
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Add New Client
                          </div>
                        </>
                      ) : (
                        <div
                          className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-blue-600 font-medium flex items-center"
                          onClick={handleAddNewClient}
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Add New Client
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {!clientSearch && (
                  <Select value={formData.client_id} onValueChange={(value) => {
                    setFormData({ ...formData, client_id: value });
                    const selectedClient = clients.find(c => c.id === value);
                    if (selectedClient) {
                      setClientSearch(selectedClient.company_name);
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <Label htmlFor="invoice_number">Invoice Number *</Label>
                <Input
                  id="invoice_number"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Issue Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(formData.issue_date, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.issue_date}
                      onSelect={(date) => date && setFormData({ ...formData, issue_date: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>Due Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(formData.due_date, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.due_date}
                      onSelect={(date) => date && setFormData({ ...formData, due_date: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Status */}
            <div>
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value: InvoiceStatus) => {
                  setFormData(prev => ({ ...prev, status: value }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Line Items - only show for new invoices */}
            {!invoice && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <Label className="text-lg font-semibold">Invoice Items *</Label>
                  <Button type="button" onClick={addItem} variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                </div>

                {inventory.filter(item => item.quantity > 0).length === 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <p className="text-yellow-800 text-sm">
                      No inventory items available. Please add inventory items before creating an invoice.
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={item.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Item #{index + 1}</span>
                        {items.length > 1 && (
                          <Button 
                            type="button" 
                            onClick={() => removeItem(item.id)}
                            variant="outline" 
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <Label htmlFor={`inventory-${item.id}`}>Select Inventory Item *</Label>
                          
                          {/* Show selected item if one is chosen */}
                          {item.inventory_id && item.description ? (
                            <div className="border rounded-md p-4 bg-gray-50">
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-medium">{item.description}</div>
                                  <div className="text-sm text-gray-600">
                                    {formatCurrency(item.unit_price)} - Available: {
                                      inventory.find(inv => inv.id === item.inventory_id)?.quantity || 0
                                    }
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setItems(prevItems => prevItems.map(prevItem => 
                                      prevItem.id === item.id 
                                        ? { ...prevItem, inventory_id: '', description: '', unit_price: 0, line_total: 0 }
                                        : prevItem
                                    ));
                                  }}
                                >
                                  Change Item
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="relative">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                <Input
                                  placeholder="Search inventory items..."
                                  value={inventorySearches[item.id] || ''}
                                  onChange={(e) => setInventorySearches(prev => ({
                                    ...prev,
                                    [item.id]: e.target.value
                                  }))}
                                  className="pl-10"
                                />
                              </div>
                              {inventorySearches[item.id] && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                  {getFilteredInventory(inventorySearches[item.id]).map((inventoryItem) => (
                                    <div
                                      key={inventoryItem.id}
                                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                      onClick={() => {
                                        handleInventorySelect(item.id, inventoryItem.id);
                                      }}
                                    >
                                      <div className="font-medium">{inventoryItem.name}</div>
                                      <div className="text-sm text-gray-600">
                                        {formatCurrency(inventoryItem.unit_price)} - Qty: {inventoryItem.quantity}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Fallback select dropdown */}
                          {!item.inventory_id && !inventorySearches[item.id] && (
                            <Select 
                              value={item.inventory_id} 
                              onValueChange={(value) => handleInventorySelect(item.id, value)}
                              required
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select inventory item" />
                              </SelectTrigger>
                              <SelectContent>
                                {inventory.filter(inventoryItem => inventoryItem.quantity > 0).map((inventoryItem) => (
                                  <SelectItem key={inventoryItem.id} value={inventoryItem.id}>
                                    {inventoryItem.name} - {formatCurrency(inventoryItem.unit_price)} (Qty: {inventoryItem.quantity})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        <div>
                          <Label htmlFor={`quantity-${item.id}`}>Quantity *</Label>
                          <Input
                            id={`quantity-${item.id}`}
                            type="number"
                            min="1"
                            max={inventory.find(inv => inv.id === item.inventory_id)?.quantity || 999}
                            value={item.quantity}
                            onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 1)}
                            required
                          />
                          {item.inventory_id && (
                            <div className="text-xs text-gray-500 mt-1">
                              Available: {inventory.find(inv => inv.id === item.inventory_id)?.quantity || 0}
                            </div>
                          )}
                        </div>

                        <div>
                          <Label htmlFor={`unit_price-${item.id}`}>Unit Price (₦) *</Label>
                          <Input
                            id={`unit_price-${item.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                            required
                          />
                        </div>

                        <div className="md:col-span-2">
                          <Label>Line Total</Label>
                          <div className="text-lg font-semibold text-gray-900">
                            {formatCurrency(item.line_total)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span>{formatCurrency(calculateSubtotal())}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Additional notes for this invoice..."
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createInvoice.isPending || updateInvoice.isPending}>
                {createInvoice.isPending || updateInvoice.isPending ? 'Saving...' : (invoice ? 'Update Invoice' : 'Create Invoice')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ClientModal
        isOpen={isClientModalOpen}
        onClose={handleClientModalClose}
      />
    </>
  );
};

export default InvoiceModal;
