-- CreateTable
CREATE TABLE "match_ready_states" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "homeReady" BOOLEAN NOT NULL DEFAULT false,
    "awayReady" BOOLEAN NOT NULL DEFAULT false,
    "assignedTeamId" TEXT,
    "teamRegion" TEXT,
    "teamLeague" TEXT,
    "teamName" TEXT,
    "assignedAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "previousTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_ready_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "match_ready_states_matchId_key" ON "match_ready_states"("matchId");

-- AddForeignKey
ALTER TABLE "match_ready_states" ADD CONSTRAINT "match_ready_states_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

