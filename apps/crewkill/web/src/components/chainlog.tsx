"use client";

import type { MatchTx, MatchView } from"@crewkill/protocol";
import type { ChainConfig } from"@/lib/api";
import { useMemo, useState } from"react";
import { Panel } from"./pieces";

/**
 * Every transaction this match has produced, linked to a block explorer.
 *
 * A privacy game makes a lot of claims that a viewer has to take on trust - the roles were
 * fair, the votes were counted, the pot was paid. This is the part they do not have to: each
 * row is a hash they can open on Voyager and read for themselves.
 *
 * It is also the honest answer to"is this actually on-chain, or is it a database with a
 * blockchain-coloured theme?"
 */

/** Human labels for the machine names the keeper records. */
const LABELS: Record<string, string> = {
  create_match:"Lobby opened",
  agent_join_seat:"Agent bought a seat",
  join_seat:"Seat bought",
  start_match:"Roster locked, seed published",
  record_vote:"Ballot counted",
  record_kill:"Night action recorded",
  end_play:"Play ended",
  reveal_seat:"Role secret published",
  settle:"Settled on-chain",
  claim:"Payout claimed",
  abort_match:"Match aborted, stakes returned",
  fund_treasury:"Treasury funded",
  set_minter:"Ballot minting handed to the game",
};

/**
 * Builds an explorer link.
 *
 * Devnet has no explorer worth linking to - the address in config points at the JSON-RPC
 * endpoint, which would open a blank page and look broken. Better to show the hash plainly
 * and say why it is not a link than to hand the viewer a dead one.
 */
function explorerTxUrl(config: ChainConfig, hash: string): string | null {
  if (config.network ==="devnet") return null;
  const base = config.explorer.replace(/\/+$/,"");
  return `${base}/tx/${hash}`;
}

export function ChainLog({
  match,
  config,
}: {
  match: MatchView;
  config: ChainConfig;
}) {
  const [expanded, setExpanded] = useState(false);

  // Newest first: during a live match the interesting transaction is the one that just landed.
  const txs = useMemo(
    () => [...match.txHashes].sort((a, b) => (a.at < b.at ? 1 : -1)),
    [match.txHashes],
  );

  if (txs.length === 0) {
    return (
      <Panel weight="rail" title="On chain">
        <p className="text-[12px] text-[var(--color-dim)]">
          Nothing yet. The first transaction lands when the lobby opens on-chain.
        </p>
      </Panel>
    );
  }

  const shown = expanded ? txs : txs.slice(0, 6);

  return (
    <Panel
      title="On chain"
      right={
        <span className="text-[11px] text-[var(--color-dim)]">
          {txs.length} transaction{txs.length === 1 ?"" :"s"}
        </span>
      }
    >
      <ol className="space-y-1.5">
        {shown.map((tx) => (
          <TxRow key={tx.hash} tx={tx} config={config} />
        ))}
      </ol>

      {txs.length > 6 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-[11px] text-[var(--color-dim)] hover:text-[var(--color-ink)]"
        >
          {expanded ?"show fewer" : `show all ${txs.length}`}
        </button>
      )}

      {config.network ==="devnet" && (
        <p className="mt-3 border-t border-[var(--color-line)] pt-2 text-[11px] text-[var(--color-dim)]">
          Devnet has no block explorer, so these are shown as plain hashes. On Sepolia and
          mainnet each one links out to Voyager.
        </p>
      )}
    </Panel>
  );
}

function TxRow({ tx, config }: { tx: MatchTx; config: ChainConfig }) {
  const url = explorerTxUrl(config, tx.hash);
  const label = LABELS[tx.kind] ?? tx.kind.replace(/_/g,"");
  const short = `${tx.hash.slice(0, 10)}…${tx.hash.slice(-6)}`;
  const at = new Date(tx.at);

  const body = (
    <>
      <span className="min-w-0 flex-1 truncate text-[var(--color-ink)]">{label}</span>
      <span className="shrink-0 font-mono text-[10px] text-[var(--color-dim)]">{short}</span>
    </>
  );

  return (
    <li className="flex items-baseline gap-2 text-[12px]">
      <time
        dateTime={tx.at}
        className="w-12 shrink-0 tabular-nums text-[10px] text-[var(--color-dim)]"
      >
        {Number.isNaN(at.getTime())
          ?""
          : at.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
      </time>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="flex min-w-0 flex-1 items-baseline gap-2 hover:text-[var(--color-cyan)]"
          title={tx.hash}
        >
          {body}
        </a>
      ) : (
        <span className="flex min-w-0 flex-1 items-baseline gap-2" title={tx.hash}>
          {body}
        </span>
      )}
    </li>
  );
}

/**
 * Where this match lives on-chain: the network, the contracts, and the pool it settles
 * through. Small, but it is the difference between"trust us" and"here is the address".
 */
export function DeploymentCard({ config }: { config: ChainConfig }) {
  const entries: Array<[string, string]> = [
    ["Game", config.contracts.game],
    ["Ballot", config.contracts.ballot],
    ["Privacy pool", config.contracts.pool],
    ["Stake token", config.contracts.stakeToken],
  ];

  return (
    <Panel
      title="Deployment"
      right={
        <span
          className="text-[11px]"
          style={{
            color: config.realPool ?"var(--color-signal)" :"var(--color-amber)",
          }}
        >
          {config.network}
        </span>
      }
    >
      <dl className="space-y-1.5 text-[11px]">
        {entries.map(([label, address]) => {
          const url =
            config.network ==="devnet"
              ? null
              : `${config.explorer.replace(/\/+$/,"")}/contract/${address}`;
          return (
            <div key={label} className="grid min-w-0 grid-cols-[7rem_1fr] gap-2">
              <dt className="text-[var(--color-dim)]">{label}</dt>
              <dd className="min-w-0 truncate font-mono text-[10px]">
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-[var(--color-cyan)]"
                    title={address}
                  >
                    {address}
                  </a>
                ) : (
                  <span title={address}>{address}</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-dim)]">
        {config.realPool
          ?"Stakes are shielded through the live STRK20 privacy pool, so the game contract records a commitment and never an address."
          :"A local pool stands in for STRK20 on devnet. The contract's side of the interface is identical, so nothing about the game changes when it points at the real one."}
      </p>
    </Panel>
  );
}
