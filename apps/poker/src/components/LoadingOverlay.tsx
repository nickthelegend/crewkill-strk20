interface Props {
  message: string;
  visible: boolean;
}

export function LoadingOverlay({ message, visible }: Props) {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${
        visible
          ? 'opacity-100 pointer-events-auto'
          : 'opacity-0 pointer-events-none'
      }`}
      style={{ backdropFilter: visible ? 'blur(4px)' : 'blur(0px)', background: visible ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)' }}
    >
      <div
        className={`bg-black/50 border border-white/[0.08] rounded-2xl p-8 max-w-xs w-full text-center shadow-2xl transition-all duration-300 ${
          visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-2'
        }`}
      >
        {/* Spinner ring */}
        <div className="relative w-10 h-10 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
          <div className="absolute inset-0 rounded-full border border-t-white/60 animate-spin" />
        </div>

        <div className="text-xs font-medium text-white/40 uppercase tracking-widest mb-3">Processing</div>
        <div className="text-sm text-white/70 leading-relaxed">{message}</div>
        <div className="text-[10px] text-white/20 mt-4 uppercase tracking-wider">ZK proofs may take 10–30 seconds</div>
      </div>
    </div>
  );
}
