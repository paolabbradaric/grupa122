
const express = require('express');
const castingRoutes = require('./routes/castingRoutes');
const auditionRoutes = require('./routes/auditionRoutes');

const app = express();
const PORT = 3000;

// Omogućuje čitanje JSON podataka iz zahtjeva.
// Trebat će nam kasnije za POST i PATCH.
app.use(express.json());

// Sve casting rute počinju s /api/castings.
app.use('/api/castings', castingRoutes);
app.use('/api/auditions', auditionRoutes);

// Pokrećemo backend server.
app.listen(PORT, () => {
  console.log(`Server radi na http://localhost:${PORT}`);
});
