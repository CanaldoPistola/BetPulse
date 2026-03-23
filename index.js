app// ===================== IMPORTS =====================
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

// ===================== DATA DINÂMICA =====================
const today = new Date().toISOString().split("T")[0];

// ===================== FUNÇÃO DE JOGOS =====================
async function fetchAndInsertGames() {
  try {
    console.log("📥 BUSCANDO JOGOS DE:", today);

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
      console.log("⚠️ Nenhum jogo encontrado hoje");
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

      console.log("Inserindo:", gameData.home_team, "vs", gameData.away_team);

      const { error } = await supabase
        .from("games")
        .upsert([gameData], { onConflict: "api_id" });

      if (error) {
        console.error("ERRO AO INSERIR:", error);
      }
    }

    console.log("✅ Jogos atualizados!");
    console.log("Quantidade:", games.length);

  } catch (error) {
    console.error("ERRO AO BUSCAR:", error.response?.data || error.message);
  }
}

// ===================== FUNÇÃO DE PALPITE =====================
async function generatePredictions() {
  console.log("🤖 GERANDO PALPITES...");

  const { data: games, error } = await supabase
    .from("games")
    .select("*")
    .limit(20);

  if (error) {
    console.log("Erro ao buscar jogos:", error);
    return;
  }

  if (!games || games.length === 0) {
    console.log("Nenhum jogo encontrado");
    return;
  }

  for (let game of games) {

    const { data: existing } = await supabase
      .from("predictions")
      .select("id")
      .eq("game_id", game.id)
      .maybeSingle();

    if (existing) {
      console.log("⚠️ Já existe:", game.home_team, "vs", game.away_team);
      continue;
    }

    const probability = Math.random() * (0.8 - 0.6) + 0.6;

    const prediction = {
      game_id: game.id,
      market: "BTTS",
      probability: probability,
      odds: 1.7 + Math.random() * 0.5,
      confidence: probability > 0.7 ? "high" : "medium",
      is_premium: probability > 0.72
    };

    const { error } = await supabase
      .from("predictions")
      .insert([prediction]);

    if (error) {
      console.log("Erro ao inserir:", error);
    } else {
      console.log("✅ Palpite:", game.home_team, "vs", game.away_team);
    }
  }

  console.log("🔥 PALPITES FINALIZADOS");
}

// ===================== EXECUÇÃO =====================
async function start() {
  console.log("🚀 INICIANDO AUTOMAÇÃO...");

  await fetchAndInsertGames();
  await generatePredictions();

  console.log("✅ PROCESSO FINALIZADO!");
}

start();

// ===================== API =====================
const app = express();

// ROTA: JOGOS
app.get("/games", async (req, res) => {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .limit(50);

  if (error) return res.status(500).json(error);

  res.json(data);
});

// ROTA: PALPITES
app.get("/predictions", async (req, res) => {
  const { data, error } = await supabase
    .from("predictions")
    .select("*, games(*)");

  if (error) return res.status(500).json(error);

  res.json(data);
});

// ROTA: ALTA PROBABILIDADE
app.get("/predictions/high", async (req, res) => {
  const { data, error } = await supabase
    .from("predictions")
    .select("*, games(*)")
    .gte("probability", 0.7);

  if (error) return res.status(500).json(error);

  res.json(data);
});

// SERVIDOR
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 API rodando na porta", PORT);
});
