-- CreateTable
CREATE TABLE "Deployment" (
    "id" SERIAL NOT NULL,
    "network" TEXT NOT NULL,
    "gameAddress" TEXT NOT NULL,
    "ballotAddress" TEXT NOT NULL,
    "poolAddress" TEXT NOT NULL,
    "stakeToken" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" SERIAL NOT NULL,
    "deploymentId" INTEGER NOT NULL,
    "onchainId" BIGINT NOT NULL,
    "phase" INTEGER NOT NULL DEFAULT 0,
    "roundPhase" TEXT,
    "round" INTEGER NOT NULL DEFAULT 0,
    "rounds" INTEGER NOT NULL,
    "seatCount" INTEGER NOT NULL,
    "seatsFilled" INTEGER NOT NULL DEFAULT 0,
    "stakeAmount" TEXT NOT NULL,
    "potAmount" TEXT NOT NULL DEFAULT '0',
    "impostorBps" INTEGER NOT NULL,
    "detectiveBps" INTEGER NOT NULL,
    "protocolBps" INTEGER NOT NULL,
    "seedCommitment" TEXT NOT NULL,
    "operatorSeed" TEXT,
    "finalSeed" TEXT,
    "crewWon" BOOLEAN,
    "impostorCount" INTEGER,
    "detectiveWeightTotal" INTEGER NOT NULL DEFAULT 0,
    "roundsPlayed" INTEGER NOT NULL DEFAULT 0,
    "phaseEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seat" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "seatCommitment" TEXT NOT NULL,
    "persona" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "isAgent" BOOLEAN NOT NULL DEFAULT false,
    "agentRoleSecret" TEXT,
    "agentClaimSecret" TEXT,
    "alive" BOOLEAN NOT NULL DEFAULT true,
    "eliminatedRound" INTEGER,
    "eliminatedBy" TEXT,
    "revealed" BOOLEAN NOT NULL DEFAULT false,
    "roleSecret" TEXT,
    "isImpostor" BOOLEAN,
    "payout" TEXT,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchEvent" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "seat" INTEGER,
    "target" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainTx" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER,
    "network" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChainTx_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Deployment_network_key" ON "Deployment"("network");

-- CreateIndex
CREATE INDEX "Match_phase_idx" ON "Match"("phase");

-- CreateIndex
CREATE UNIQUE INDEX "Match_deploymentId_onchainId_key" ON "Match"("deploymentId", "onchainId");

-- CreateIndex
CREATE INDEX "Seat_matchId_seatCommitment_idx" ON "Seat"("matchId", "seatCommitment");

-- CreateIndex
CREATE UNIQUE INDEX "Seat_matchId_index_key" ON "Seat"("matchId", "index");

-- CreateIndex
CREATE INDEX "MatchEvent_matchId_id_idx" ON "MatchEvent"("matchId", "id");

-- CreateIndex
CREATE INDEX "ChainTx_matchId_idx" ON "ChainTx"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "ChainTx_network_hash_key" ON "ChainTx"("network", "hash");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChainTx" ADD CONSTRAINT "ChainTx_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
