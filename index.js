// ===================== IMPORTS =====================
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
const express = require("express");

// ===================== CONFIG =====================
console.log("INICIANDO SCRIPT...");

// 🔐 ENV (OBRIGATÓRIO NO RENDER)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const API_KEY = process.env.API_KEY;

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

    const url = https://v3.football.api-sports.io/fixtures?date=${today};

const response = await axios.get(url, {
  headers: {
    "x-apisports-key": API_KEY,
  },
  timeout: 10000,
});

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

      await supabase
        .from("games")
        .upsert([gameData], { onConflict: "api_id" });
    }

    console.log("✅ Jogos atualizados");
  } catch (err) {
    console.error("Erro ao buscar jogos:", err.message);
  }
}

// ===================== FUNÇÃO PALPITES =====================
async function generatePredictions() {
  try {
    console.log("🤖 GERANDO PALPITES");

    const { data: games } = await supabase
      .from("games")
      .select("*")
      .eq("status", "NS")
      .limit(20);

    if (!games) return;

    for (let game of games) {
      const { data: existing } = await supabase
        .from("predictions")
        .select("id")
        .eq("game_id", game.id)
        .limit(1);

      if (existing && existing.length > 0) continue;

      const probability = 0.6 + Math.random() * 0.3;

      const prediction = {
        game_id: game.id,
        market: "BTTS",
        probability,
        odds: 1.6 + (1 - probability),
        confidence: probability > 0.72 ? "high" : "medium",
        is_premium: probability > 0.75
      };

      await supabase
        .from("predictions")
        .upsert([prediction], { onConflict: ["game_id", "market"] });
    }

    console.log("🔥 PALPITES FINALIZADOS");
  } catch (err) {
    console.error("Erro ao gerar palpites:", err.message);
  }
}

// ===================== ROTAS =====================

// HEALTH CHECK (IMPORTANTE PRO RENDER)
app.get("/", (req, res) => {
  res.send("API ONLINE 🚀");
});

// TODOS
app.get("/predictions", async (req, res) => {
  const { data, error } = await supabase
    .from("predictions")
    .select(", games()")
    .order("probability", { ascending: false });

  if (error) return res.status(500).json(error);
  res.json(data);
});

// FREE
app.get("/predictions/free", async (req, res) => {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("predictions")
    .select(", games()")
    .eq("is_premium", false)
    .gte("games.match_date", now)
    .limit(5);

  if (error) return res.status(500).json(error);
  res.json(data);
});

// VIP
app.get("/predictions/vip", async (req, res) => {
  const token = (req.headers.authorization || req.query.token || "")
    .toString()
    .trim();

  if (token !== "BETPULSE2026") {
    return res.status(403).json({ error: "Acesso negado" });
  }

  const { data, error } = await supabase
    .from("predictions")
    .select(", games()")
    .eq("is_premium", true);

  if (error) return res.status(500).json(error);
  res.json(data);
});

// JOGOS
app.get("/games", async (req, res) => {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .limit(50);

  if (error) return res.status(500).json(error);
  res.json(data);
});

// ===================== SERVER =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(🚀 API rodando na porta ${PORT});
});

// ===================== START (SEM QUEBRAR DEPLOY) =====================
setTimeout(() => {
  fetchAndInsertGames();
  generatePredictions();
}, 3000);