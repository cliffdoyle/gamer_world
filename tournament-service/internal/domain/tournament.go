package domain


//TournamentFormat defines the structure of a tournament
type TournamentFormat string

//Tournament formats
const(
	SingleElimination TournamentFormat="SINGLE_ELIMINATION"
	DoubleElimination TournamentFormat="DOUBLE_ELIMINATION"
	RoundRobin TournamentFormat="ROUND_ROBIN"
	Swiss TournamentFormat="SWISS"
)

//TournamentStatus defines the current state of a tournament
type TournamentStatus string

//Tournament statuses
const(
	Draft TournamentStatus="DRAFT"
	Registration TournamentStatus="REGISTRATION"
	InProgress TournamentStatus="IN_PROGRESS"
	Completed TournamentStatus="COMPLETED"
	Cancelled TournamentStatus="CANCELLED"
)