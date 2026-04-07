UPDATE "Match" 
SET round = 'Final' 
WHERE round = 'Round 2' 
  AND "roundNumber" = 2 
  AND "matchNumber" = 1
  AND id IN (
    SELECT m.id FROM "Match" m
    JOIN "Tournament" t ON m."tournamentId" = t.id
    WHERE t.slug = 'bwl-season-1'
  );
