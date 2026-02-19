interface ToastProps {
  message: string;
  type: 'success' | 'error';
}

export default function Toast({ message, type }: ToastProps) {
  return (
    <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-lg text-sm font-medium z-50 animate-slide-in
      ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {type === 'success' ? '✓' : '✗'} {message}
    </div>
  );
}
