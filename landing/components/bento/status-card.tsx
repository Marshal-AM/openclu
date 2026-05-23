"use client"

const STAGES = [
  { name: "CAPTURE", status: "LOCAL", detail: "clu device" },
  { name: "TRANSCRIBE", status: "LOCAL", detail: "groq" },
  { name: "GRAPH", status: "LOCAL", detail: "SKILL.md" },
  { name: "ENCRYPT", status: "CDR", detail: "wasm vault" },
  { name: "STORY IP", status: "MINT", detail: "aeneid" },
  { name: "ARKIV", status: "LIST", detail: "braga" },
]

export function StatusCard() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b-2 border-foreground px-4 py-2">
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
          pipeline.status
        </span>
        <span className="text-[10px] tracking-widest text-[#ea580c] font-mono">ALL LOCAL</span>
      </div>
      <div className="flex-1 flex flex-col p-4 gap-0">
        <div className="grid grid-cols-3 gap-2 border-b border-border pb-2 mb-2">
          <span className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground">Stage</span>
          <span className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground">Layer</span>
          <span className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground text-right">Ref</span>
        </div>
        {STAGES.map((stage) => (
          <div
            key={stage.name}
            className="grid grid-cols-3 gap-2 py-2 border-b border-border last:border-none"
          >
            <span className="text-xs font-mono text-foreground">{stage.name}</span>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 bg-[#ea580c]" />
              <span className="text-xs font-mono text-muted-foreground">{stage.status}</span>
            </div>
            <span className="text-xs font-mono text-foreground text-right">{stage.detail}</span>
          </div>
        ))}
        <div className="mt-auto pt-4 border-t border-border">
          <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
            CDR handles encryption + vault writes. Arkiv handles catalog discovery. Story handles IP
            registration and license-gated decryption. No central server holds your keys.
          </p>
        </div>
      </div>
    </div>
  )
}
