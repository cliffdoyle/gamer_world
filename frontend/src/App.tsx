import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Container } from '@mui/material';
import { TournamentTester } from './components/TournamentTester';

function App() {
  return (
    <Router>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Tournament Manager
          </Typography>
          <Button color="inherit" component={Link} to="/test">
            Test Tournament
          </Button>
        </Toolbar>
      </AppBar>

      <Container>
        <Routes>
          <Route path="/test" element={<TournamentTester />} />
        </Routes>
      </Container>
    </Router>
  );
}

export default App; 