// ===================== IMPORTS =====================
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
const express = require("express");

// ===================== CONFIG =====================
console.log("INICIANDO SCRIPT...");

// 🔐 Supabase
const SUPABASE_URL = "https://unjogytlwbafnqotgbei.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuam9neXRsd2JhZm5xb3RnYmVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk1MDAyOCwiZXhwIjoyMDg5NTI2MDI4fQ.e2oFAxrp4wxa6NGAx2Cdf87I3PxXAzzyJpZ30kPvvys"; // depois vamos mover pra ENV

// ⚽ API Football
const API_KEY = "1a896aad078a4eec7ab7121281bcd5ec";

// ===================== CLIENT =====================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===================== EXPRESS =====================
const app = express();

// ===================== DATA =====================
const today = new Date().toISOString().split("T")[0];

// ===================== FUNÇÃO JOGOS =====================
async function fetchAndInsertGames() {
  try {
    console.log("📥 BUSCANDO JOGOS:", today);

    const response = await axios.get(
      `https://v3.football.api-sports.io/fixtures?date=${today}`,
      {
        headers: {
          "x-apisports-key": API_KEY,
        },
      }
    );

    const games = response.data.response;

    if (!games || games.length === 0) {
      console.log("⚠️ Nenhum jogo encontrado");
      return;
    }

    for (let game of games) {
      const gameData = {
        api_id: game.fixture.id,
        match_date: game.fixture.date,
        home_team: game.teams.home.name,
        away_team: game.teams.away.name,
        league: game.league.name,
        status: game.fixture.status.short,
      };

      const { error } = await supabase
        .from("games")
        .upsert([gameData], { onConflict: "api_id" });

      if (error) console.error(error);
    }

    console.log("✅ Jogos atualizados");
  } catch (err) {
    console.log("Erro:", err.message);
  }
}

// ===================== FUNÇÃO PALPITES =====================
async function generatePredictions() {
  console.log("🤖 GERANDO PALPITES");

  const { data: games, error } = await supabase
    .from("games")
    .select("*")
    .limit(20);

  if (error || !games) return;

  for (let game of games) {
    const { data: existing } = await supabase
  .from("predictions")
  .select("id")
  .eq("game_id", game.id)
  .eq("market", "BTTS")
  .limit(1);

if (existing && existing.length > 0) {
  console.log("⚠️ Já existe:", game.home_team, "vs", game.away_team);
  continue;
}

if (existing && existing.length > 0) {
  continue;
}

    if (existing) continue;

   // 🎯 Simula nível de gols do jogo
const goalTrend = Math.random(); // 0 a 1

let market;
let probability;

// 🔥 DECISÃO INTELIGENTE
if (goalTrend > 0.65) {
  market = "OVER_2.5";
  probability = 0.7 + Math.random() * 0.2;
} else if (goalTrend < 0.35) {
  market = "UNDER_2.5";
  probability = 0.65 + Math.random() * 0.15;
} else {
  market = "BTTS";
  probability = 0.6 + Math.random() * 0.2;
}

// 💰 odds baseadas no risco
const odds = 1.6 + (1 - probability);

// 🧠 confiança
const confidence = probability > 0.72 ? "high" : "medium";

// 🔐 premium
const is_premium = probability > 0.75;

const prediction = {
  game_id: game.id,
  market,
  probability,
  odds,
  confidence,
  is_premium
};

    await supabase.from("predictions").upsert([prediction], { onConflict: ["game_id", "market"] })
  }

  console.log("🔥 PALPITES FINALIZADOS");
}

// ===================== ROTAS =====================
app.get("/games", async (req, res) => {
  const { data, error } = await supabase.from("games").select("*").limit(50);
  if (error) return res.status(500).json(error);
  res.json(data);
});

app.get("/predictions", async (req, res) => {
  const { data, error } = await supabase
    .from("predictions")
    .select("*, games(*)")
    .order("probability", { ascending: false });

  if (error) return res.status(500).json(error);

  res.json(data);
});

app.get("/predictions/high", async (req, res) => {
  const { data, error } = await supabase
    .from("predictions")
   .select("*, games(*)")
.gte("probability", 0.7)
.order("probability", { ascending: false });

  if (error) return res.status(500).json(error);
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
  console.log(`🚀 API rodando na porta ${PORT}`);
});