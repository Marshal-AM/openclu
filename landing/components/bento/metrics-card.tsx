"use client"

export function MetricsCard() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b-2 border-foreground px-4 py-2">
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
          protocol.stack
        </span>
        <span className="inline-block h-2 w-2 bg-[#ea580c]" />
      </div>
      <div className="flex-1 flex flex-col justify-center gap-5 p-6">
        <div className="flex flex-col gap-2 border-l-2 border-[#ea580c] pl-4">
          <span className="text-xs font-mono font-bold tracking-[0.2em] uppercase text-[#ea580c]">
            Story CDR
          </span>
          <p className="text-xs font-mono text-muted-foreground leading-relaxed">
            Confidential Data Rails encrypts each skill bundle on your device before it ever leaves.
            Threshold encryption via Story validators — buyers need a Story license token to decrypt.
            Raw audio stays local; only ciphertext is pinned to Helia/IPFS.
          </p>
        </div>
        <div className="flex flex-col gap-2 border-l-2 border-foreground pl-4">
          <span className="text-xs font-mono font-bold tracking-[0.2em] uppercase text-foreground">
            Arkiv Network
          </span>
          <p className="text-xs font-mono text-muted-foreground leading-relaxed">
            Arkiv is the discovery layer. Each skill is a Braga <code className="text-foreground">skillListing</code>{" "}
            with tags, metadata, and a CID pointer — written by your device wallet as{" "}
            <code className="text-foreground">$owner</code>. Agents browse, search, and purchase from the public catalog.
          </p>
        </div>
        <div className="flex flex-col gap-2 border-l-2 border-foreground/40 pl-4">
          <span className="text-xs font-mono font-bold tracking-[0.2em] uppercase text-muted-foreground">
            Story Protocol
          </span>
          <p className="text-xs font-mono text-muted-foreground leading-relaxed">
            Registers the skill as on-chain IP on Story Aeneid. License mints gate CDR vault access —
            attribution and royalties are enforced by the protocol, not by us.
          </p>
        </div>
      </div>
    </div>
  )
}
