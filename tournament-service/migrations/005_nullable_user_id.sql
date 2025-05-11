ALTER TABLE matches
ADD COLUMN participant1_prereq_match_id UUID NULL,
ADD COLUMN participant2_prereq_match_id UUID NULL,
ADD COLUMN participant1_prereq_match_result_source VARCHAR(10) NULL, -- Adjust VARCHAR size if needed ('WINNER'/'LOSER')
ADD COLUMN participant2_prereq_match_result_source VARCHAR(10) NULL;

-- Optional: Add foreign key constraints if desired
-- ALTER TABLE matches ADD CONSTRAINT fk_p1_prereq FOREIGN KEY (participant1_prereq_match_id) REFERENCES matches(id) ON DELETE SET NULL;
-- ALTER TABLE matches ADD CONSTRAINT fk_p2_prereq FOREIGN KEY (participant2_prereq_match_id) REFERENCES matches(id) ON DELETE SET NULL;