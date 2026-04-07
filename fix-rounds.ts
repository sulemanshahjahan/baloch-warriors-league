import { prisma } from "./src/lib/db";

async function fixRounds() {
  // Find the BWL Season 1 tournament
  const tournament = await prisma.tournament.findUnique({
    where: { slug: "bwl-season-1" },
    include: {
      matches: {
        where: {
          round: "Round 2",
          roundNumber: 2,
          matchNumber: 1,
        },
      },
    },
  });

  if (!tournament) {
    console.log("Tournament not found");
    return;
  }

  console.log(`Found ${tournament.matches.length} matches with Round 2`);

  for (const match of tournament.matches) {
    console.log(`Match: ${match.id}, Round: ${match.round}, RoundNumber: ${match.roundNumber}, MatchNumber: ${match.matchNumber}`);
    
    // Update to Final
    await prisma.match.update({
      where: { id: match.id },
      data: { round: "Final" },
    });
    console.log(`Updated match ${match.id} to Final`);
  }
}

fixRounds()
  .then(() => console.log("Done"))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
