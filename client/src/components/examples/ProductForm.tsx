import ProductForm from '../ProductForm';

export default function ProductFormExample() {
  const handleSubmit = (data: any) => {
    console.log('Product submitted:', data);
  };

  const handleCancel = () => {
    console.log('Form cancelled');
  };

  return (
    <div className="p-4">
      <ProductForm 
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}