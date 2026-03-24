// ===================== IMPORTS =====================
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
const express = require("express");

// ===================== CONFIG =====================
console.log("INICIANDO SCRIPT...");

// 🔐 Supabase
const SUPABASE_URL = "https://unjogytlwbafnqotgbei.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuam9neXRsd2JhZm5xb3RnYmVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk1MDAyOCwiZXhwIjoyMDg5NTI2MDI4fQ.e2oFAxrp4wxa6NGAx2Cdf87I3PxXAzzyJpZ30kPvvys"; 

// ⚽ API Football
const API_KEY = "1a896aad078a4eec7ab7121281bcd5ec";

// ===================== CLIENT =====================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===================== DATA =====================
const today = new Date().toISOString().split("T")[0];

// ===================== EXPRESS =====================
const app = express();

// ===================== BUSCAR JOGOS =====================
async function fetchAndInsertGames() {
  try {
    const response = await axios.get(
      `https://v3.football.api-sports.io/fixtures?date=${today}`,
      {
        headers: {
          "x-apisports-key": API_KEY,
        },
      }
    );

    const games = response.data.response;

    for (let game of games) {
      const gameData = {
        api_id: game.fixture.id,
        match_date: game.fixture.date,
        home_team: game.teams.home.name,
        away_team: game.teams.away.name,
        league: game.league.name,
        status: game.fixture.status.short,
      };

      await supabase
        .from("games")
        .upsert([gameData], { onConflict: "api_id" });
    }

    console.log("✅ Jogos atualizados");
  } catch (error) {
    console.log("Erro:", error.message);
  }
}

// ===================== PALPITES =====================
async function generatePredictions() {
  const { data: games } = await supabase
    .from("games")
    .select("*")
    .limit(20);

  for (let game of games || []) {
    const probability = Math.random() * 0.2 + 0.6;

    await supabase.from("predictions").insert([
      {
        game_id: game.id,
        market: "BTTS",
        probability,
        odds: 1.7,
        confidence: probability > 0.7 ? "high" : "medium",
        is_premium: probability > 0.72,
      },
    ]);
  }

  console.log("🔥 Palpites gerados");
}

// ===================== ROTAS =====================
app.get("/games", async (req, res) => {
  const { data } = await supabase.from("games").select("*");
  res.json(data);
});

app.get("/predictions", async (req, res) => {
  const { data } = await supabase
    .from("predictions")
    .select("*, games(*)");

  res.json(data);
});

// ===================== START =====================
async function start() {
  await fetchAndInsertGames();
  await generatePredictions();
}

start();

// ===================== SERVER =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Rodando na porta", PORT);
});