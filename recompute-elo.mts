import { recomputeAllElo } from "./src/lib/elo.ts";
import { prisma } from "./src/lib/db.ts";
const res = await recomputeAllElo();
console.log("ELO recomputed. matches processed:", res.matchesProcessed);
// Show the duo member's new ELO + elo history count from team matches
const p = await prisma.player.findFirst({ where: { name: "Suleman" }, select: { id: true, name: true, eloRating: true } });
if (p) {
  const hist = await prisma.eloHistory.count({ where: { playerId: p.id } });
  console.log(`${p.name}: ELO ${p.eloRating}, elo history rows: ${hist}`);
}
await prisma.$disconnect();
