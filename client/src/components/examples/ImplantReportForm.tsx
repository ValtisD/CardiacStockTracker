import ImplantReportForm from '../ImplantReportForm';

export default function ImplantReportFormExample() {
  const handleSubmit = (data: any) => {
    console.log('Implant report submitted:', data);
  };

  const handleCancel = () => {
    console.log('Report cancelled');
  };

  return (
    <div className="p-4">
      <ImplantReportForm 
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}