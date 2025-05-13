# Tournament Management Platform -GamerWorld Tournaments

This project is a comprehensive platform for creating, managing, and displaying gaming tournaments in various formats, including Single Elimination, Double Elimination, and Round Robin. It features a Go backend for API and logic, and a Next.js (React) frontend for user interaction and bracket visualization.

## Table of Contents

1.  [Features](#features)
2.  [Tech Stack](#tech-stack)
3.  [Project Structure](#project-structure)
4.  [Setup and Installation](#setup-and-installation)
    *   [Backend (Go)](#backend-go)
    *   [Frontend (Next.js)](#frontend-nextjs)
    *   [Database (PostgreSQL)](#database-postgresql)
5.  [Core Functionality](#core-functionality)
    *   [Tournament Creation & Management](#tournament-creation--management)
    *   [Participant Management](#participant-management)
    *   [Bracket Generation](#bracket-generation)
    *   [Score Updates](#score-updates)
    *   [Bracket Visualization](#bracket-visualization)
6.  [Key Backend Components/Logic](#key-backend-componentslogic)
    *   [Domain Models](#domain-models)
    *   [Repository Layer](#repository-layer)
    *   [Service Layer](#service-layer)
    *   [Bracket Generation Algorithms](#bracket-generation-algorithms)
7.  [Key Frontend Components/Logic](#key-frontend-componentslogic)
    *   [Tournament Detail Page (`/tournaments/[id]`)](#tournament-detail-page-tournamentsid)
    *   [Bracket Rendering (`BracketRenderer.tsx`)](#bracket-rendering-bracketrenderertsx)
    *   [Elimination Bracket (`DarkChallongeBracket.tsx`)](#elimination-bracket-darkchallongebrackettsx)
    *   [Round Robin Table (`RoundRobinTable.tsx`)](#round-robin-table-roundrobintabletsx)
    *   [Statistics Tables](#statistics-tables)
8.  [API Endpoints (Overview)](#api-endpoints-overview)
9.  [Future Enhancements / TODO](#future-enhancements--todo)
10. [Contributing](#contributing)
11. [License](#license)

## Features

*   User Authentication (assumed, context: `useAuth`)
*   Tournament Creation: Specify name, game, description, format, dates, etc.
*   Multiple Tournament Formats:
    *   Single Elimination
    *   Double Elimination
    *   Round Robin
    *   Swiss (basic placeholder)
*   Participant Management: Add participants to tournaments before bracket generation.
*   Automated Bracket Generation: Creates match schedules based on selected format and participants.
    *   Handles seeding and byes for elimination formats.
    *   Uses circle method for Round Robin.
*   Score Reporting:
    *   Inline score editing for Round Robin matches.
    *   Modal/Popover score editing for Elimination bracket matches.
    *   Optimistic UI updates for a smoother user experience.
*   Dynamic Bracket/Table Visualization:
    *   Interactive SVG-based elimination brackets (`DarkChallongeBracket.tsx`).
    *   Clear Round Robin standings and match lists (`RoundRobinTable.tsx`).
    *   Participant statistics tables for elimination formats.
*   Real-time (or near real-time after refresh) updates to brackets and standings upon score entry.
*   Clear visual distinction for match status, winners, and different bracket sections (e.g., Losers Bracket).

## Tech Stack

*   **Backend:** Go
    *   Web Framework: Gin 
    *   Database: PostgreSQL
    *   ORM/DB Layer: `database/sql` 
    *   UUIDs: `github.com/google/uuid`
*   **Frontend:** Next.js (React)
    *   State Management: React Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`), Context API (`useAuth`)
    *   Styling: Tailwind CSS (potentially with DaisyUI or similar component library for `btn`, `card`, etc.)
    *   Routing: Next.js App Router
    *   Icons: Heroicons (`@heroicons/react`)
    *   API Client: Custom fetch-based client (`src/lib/api/tournament.ts`)
*   **Database:** PostgreSQL 

## Setup and Installation

### Backend (Go)

1.  **Prerequisites:** Go, PostgreSQL server.
2.  **Clone the repository:** `git clone https://github.com/cliffdoyle/gamer_world.git`
3.  **Navigate to backend directory:** `cd tournament-service`
4.  **Database Setup:**
    *   Create a PostgreSQL database.
    *   Run database migrations to create necessary tables (`tournaments`, `participants`, `matches`). Ensure the `matches` table includes:
        *   `bracket_type VARCHAR(20)`
        *   `participant1_prereq_match_id UUID NULL`
        *   `participant2_prereq_match_id UUID NULL`
        *   `participant1_prereq_match_result_source VARCHAR(10) NULL`
        *   `participant2_prereq_match_result_source VARCHAR(10) NULL`
        *   And all other fields from `domain.Match`.
5.  **Configuration:**
    *   Set up environment variables or a config file for:
        *   Database connection string (user, password, host, port, dbname)
        *   JWT secret
        *   Server port
6.  **Install Dependencies:** `go mod tidy`
7.  **Run the server:** `go run cmd/server/main.go` 

### Frontend (Next.js)

1.  **Prerequisites:** Node.js, npm.
2.  **Clone the repository:** `git clone https://github.com/cliffdoyle/gamer_world.git`
3.  **Navigate to frontend directory:** `cd tournament-frontend`
4.  **Install Dependencies:** `npm install` or `yarn install`
    *   Ensure `@heroicons/react` and `tailwind-scrollbar` (if used) are installed.
5.  **Configuration:**
    *   Create a `.env.local` file in the root of `tournament-frontend`.
    *   Add your backend API base URL:
        ```env
        NEXT_PUBLIC_API_BASE_URL=http://localhost:8082 # 
        ```
    *   `src/lib/api/config.ts` should use this environment variable.
6.  **Run the development server:** `npm run dev` or `yarn dev`
7.  Open [http://localhost:3000](http://localhost:3000) in your browser.

### Database (PostgreSQL)

*   Ensure your PostgreSQL server is running.
*   Create the tournament database if it doesn't exist.
*   Apply the schema migrations to create tables: `tournaments`, `participants`, `matches`.
    *   **`matches` table requires special attention** to include all fields from the Go `domain.Match` struct, particularly the `bracket_type` and the four prerequisite fields for TBD resolution (`participant1_prereq_match_id`, `participant2_prereq_match_id`, `participant1_prereq_match_result_source`, `participant2_prereq_match_result_source`).

## Core Functionality

### Tournament Creation & Management
*   Users can create new tournaments, specifying essential details.
*   Tournament status (`DRAFT`, `REGISTRATION`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`) tracks its lifecycle.

### Participant Management
*   Participants can be added to tournaments during the `DRAFT` or `REGISTRATION` phase, before the bracket is generated and within registration deadlines.
*   The system checks against `maxParticipants`.

### Bracket Generation
*   Triggered manually via the UI by an authorized user.
*   Requires at least 2 participants.
*   The Go backend's `bracket` package contains distinct generators:
    *   `SingleEliminationGenerator`: Uses seeding (`applyChallongeSeeding`) and handles byes. Populates prerequisite match fields for accurate "Winner of Mx" display.
    *   `DoubleEliminationGenerator`:
        *   Uses `generateWinnersBracketFromSingleElim` (which itself calls the core SE logic) for the Winners Bracket.
        *   `generateLosersBracket` logic determines how losers drop and are paired with advancing LB players, setting prerequisite fields (including `_result_source` as "LOSER" or "WINNER").
        *   `generateFinalMatches` creates 1 or 2 Grand Final matches with correct prerequisite links from WB and LB finals.
    *   `RoundRobinGenerator`: Uses the circle method.
    *   `SwissGenerator`: Basic placeholder structure.
*   Once generated, participants can no longer be added/removed.

### Score Updates
*   Managed through the `TournamentDetailPage` (`page.tsx`).
*   **Round Robin:** Features inline editing directly on match cards via `RoundRobinTable.tsx`.
*   **Elimination (SE/DE):** Uses a popover-style modal (`MatchScoreEditor.tsx`) triggered by clicking a match (or an edit icon) in the SVG bracket (`DarkChallongeBracket.tsx`).
*   Uses optimistic UI updates for a responsive feel, then syncs with the backend.
*   Backend `UpdateMatchScore` service correctly determines `winner_id` (or `nil` for RR draws) and `status` before saving and advancing participants in elimination formats.

### Bracket Visualization
*   `BracketRenderer.tsx` conditionally renders the appropriate display component based on tournament format.
*   **`DarkChallongeBracket.tsx`:**
    *   Renders interactive SVG brackets for Single and Double Elimination.
    *   Dynamically calculates match positions and connector lines.
    *   Displays "Winner of Mx" / "Loser of Mx" for TBD slots if backend provides prerequisite data (`participantX_prereq_match_id` and `participantX_prereq_match_result_source`).
    *   Includes visual cues for editable matches.
*   **`RoundRobinTable.tsx`:**
    *   Displays a clear standings table (Rank, MP, W, L, D, Pts).
    *   Lists matches grouped by round with scores.
*   **`EliminationStatsTable.tsx`:**
    *   Provides a statistics table (MP, W, L, Pts) for participants in SE/DE tournaments.

## Key Backend Components/Logic

### Domain Models (`internal/domain`)
*   `Tournament`, `Participant`, `Match` structs define the core data structures.
*   `Match` struct includes crucial fields: `bracket_type`, `loser_next_match_id`, `participantX_prereq_match_id`, and `participantX_prereq_match_result_source`.
*   Enums for `TournamentFormat`, `TournamentStatus`, `MatchStatus`, `BracketType`, `PrereqSourceType`.

### Repository Layer (`internal/repository`)
*   Handles all direct database interactions (CRUD operations) for `tournaments`, `participants`, and `matches` tables using `database/sql`.
*   Must be updated to read/write the new prerequisite fields in the `matches` table.

### Service Layer (`internal/service`)
*   `tournamentService` orchestrates business logic.
*   `CreateTournament`: Handles creation, setting initial status to `DRAFT` or `REGISTRATION`.
*   `AddParticipant`: Adds a participant if rules allow.
*   `GenerateBracket`: Calls the appropriate generator from the `bracket` package based on `tournament.Format`. Crucially updates `matches` and ideally the `tournament.status`.
*   `UpdateMatchScore`: The refined version correctly determines `winner_id` based on scores for all formats (nil for RR draws), updates match status, saves the match, and then handles participant advancement in elimination brackets based on `next_match_id` and `loser_next_match_id`, ideally using prerequisite data for precise slotting.

### Bracket Generation Algorithms (`internal/bracket`)
*   **`SingleEliminationGenerator`**: Core logic (`generateSingleEliminationInternal`) sets `NextMatchID` and `ParticipantXPrereqMatchID`/`Source` ("WINNER").
*   **`DoubleEliminationGenerator`**:
    *   `generateWinnersBracketFromSingleElim`: Calls the core SE logic.
    *   `generateLosersBracket`: Complex logic to create LB structure. **This part is critical and must accurately set `LoserNextMatchID` on WB matches, `NextMatchID` on LB matches, and the full set of prerequisite fields (`ID` and `Source` as "WINNER" or "LOSER") for each slot in new LB matches.**
    *   `generateFinalMatches`: Creates GF1 (and optional GF2) linking WB/LB finals and setting appropriate prerequisite data.
*   Relies on helper functions for seeding (`applyChallongeSeeding`) and byes.

## Key Frontend Components/Logic

### Tournament Detail Page (`/tournaments/[id]/page.tsx`)
*   Fetches all data for a specific tournament (`tournament`, `participants`, `matches`).
*   Manages UI state: loading, errors, modal visibility, inline editing state for RR.
*   Handles user actions: adding participants, generating bracket, initiating score updates.
*   Implements optimistic UI updates for score changes.
*   Renders `EliminationStatsTable` or delegates bracket/table display to `BracketRenderer`.
*   Controls the visibility and data for `MatchScoreEditor`.

### Bracket Rendering (`BracketRenderer.tsx`)
*   A simple conditional renderer that chooses between `DarkChallongeBracket.tsx` (for SE/DE) and `RoundRobinTable.tsx`.
*   Passes down necessary props, including callbacks for editing and inline editing state for RR.

### Elimination Bracket (`DarkChallongeBracket.tsx`)
*   Renders SE/DE tournaments as an SVG.
*   **Layout Algorithm:** Complex `useEffect` hook calculates X/Y positions for each match, grouping them by `ui_bracket_section` (WINNERS, LOSERS, GRAND_FINALS) to create distinct visual areas. Aims for compact, Challonge-like layout.
*   **Connector Lines:** Draws SVG `<path>` elements between matches based on `next_match_id` and `loser_next_match_id`, targeting correct P1/P2 slots using prerequisite data if available.
*   **TBD Labels:** Uses `participantX_prereq_match_id` and `participantX_prereq_match_result_source` (from API via props) to display "W of Mx" or "L of Mx".
*   **Editing Cue:** Displays an SVG edit icon on matches; clicking the match group triggers `onMatchClick` handled by `page.tsx` to open the `MatchScoreEditor` (styled as a popover).

### Round Robin Table (`RoundRobinTable.tsx`)
*   Calculates and displays a sortable standings table (W, L, D, Pts).
*   Lists matches grouped by round.
*   **Inline Score Editing:** When a match is clicked (and `onMatchClick` is triggered, setting state in `page.tsx`), it displays input fields directly within the match card for score entry.
*   Styled for dark theme readability.

### Statistics Tables
*   `EliminationStatsTable.tsx`: Displays participant stats (MP, W, L, Points) for SE/DE formats.
*   `RoundRobinTable.tsx`: Includes an integrated standings table.

## API Endpoints (Overview)

*   `GET /tournaments`: List all tournaments.
*   `POST /tournaments`: Create a new tournament.
*   `GET /tournaments/{id}`: Get details for a specific tournament.
*   `PUT /tournaments/{id}`: Update tournament details (e.g., status).
*   `GET /tournaments/{id}/participants`: List participants for a tournament.
*   `POST /tournaments/{id}/participants`: Add a participant.
*   `GET /tournaments/{id}/matches`: Get all matches for a tournament.
*   `POST /tournaments/{id}/bracket`: Generate the bracket/matches.
*   `PUT /tournaments/{id}/matches/{matchId}`: Update a match (scores, status, etc.).

## Future Enhancements / TODO

*   **Full Double Elimination Layout Perfection:** Ensure `DarkChallongeBracket.tsx` handles all DE scenarios and edge cases for match placement and connector lines with high fidelity. Debug any visual issues with LB/GF.
*   **True Inline SVG Editing (Advanced):** If the popover-style editor for SE/DE isn't ideal, explore `<foreignObject>` or pure SVG text input simulation (complex).
*   **Robust Swiss System Implementation:** Fully implement Swiss pairing logic in the backend and a corresponding frontend display.
*   **User Roles & Permissions:** More granular control over who can create tournaments, add participants, report scores.
*   **Real-time Updates:** Use WebSockets or similar for instant updates across all connected clients when scores change or brackets are updated.
*   **Seeding Management:** UI for manual seeding or adjusting automated seeding.
*   **Tie-breaker Rules:** Implement more complex tie-breaker rules for Round Robin standings (e.g., head-to-head results, score difference within matches).
*   **Responsive Design Improvements:** Further fine-tune layouts for smaller screens.
*   **Testing:** Comprehensive unit and integration tests for both backend and frontend.
*   **Error Handling & User Feedback:** More detailed and user-friendly error messages. Loading indicators for all async actions.
*   **Accessibility (a11y):** Ensure the bracket and tables are keyboard navigable and screen-reader friendly.

## License

 MIT