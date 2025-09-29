import InventoryTable from '../InventoryTable';

export default function InventoryTableExample() {
  const handleTransfer = (itemId: string, quantity: number, direction: 'in' | 'out') => {
    console.log(`Transfer ${direction} ${quantity} units of item ${itemId}`);
  };

  return (
    <div className="p-4">
      <InventoryTable 
        location="home" 
        onTransfer={handleTransfer}
      />
    </div>
  );
}