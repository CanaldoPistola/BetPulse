// ===================== IMPORTS =====================
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
const express = require("express");

// ===================== CONFIG =====================
console.log("INICIANDO SCRIPT...");

// 🔐 ENV (Render)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const API_KEY = process.env.API_KEY;

// ===================== CLIENT =====================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===================== EXPRESS =====================
const app = express();

// ===================== DATA =====================
const today = new Date(
  new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
)
  .toISOString()
  .split("T")[0];

// ===================== FUNÇÃO JOGOS =====================
async function fetchAndInsertGames() {
  try {
    console.log("📥 BUSCANDO JOGOS:", today);

    const url = `https://v3.football.api-sports.io/fixtures?date=${today}`;

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

    for (const game of games) {
      const gameData = {
        api_id: game.fixture.id,
        match_date: game.fixture.date,
        home_team: game.teams.home.name,
        away_team: game.teams.away.name,
        home_logo: game.teams.home.logo || null,
        away_logo: game.teams.away.logo || null,
        league: game.league.name,
        status: game.fixture.status.short,
      };

      const { error } = await supabase
        .from("games")
        .upsert([gameData], { onConflict: "api_id" });

      if (error) {
        console.error("Erro ao salvar jogo:", error.message);
      }
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
      .limit(10);

    if (!games) return;

    const markets = [
      "BTTS",
      "OVER_2.5",
      "UNDER_2.5",
      "OVER_1.5",
      "MATCH_WIN_HOME",
      "MATCH_WIN_AWAY",
      "UNDER_1.5",
      "HT_OVER_0.5"
    ];

    for (const game of games) {
      for (const market of markets) {

        const { data: existing } = await supabase
          .from("predictions")
          .select("id")
          .eq("game_id", game.id)
          .eq("market", market)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const probability = 0.55 + Math.random() * 0.4;

        if (probability < 0.72) continue;

        const prediction = {
          game_id: game.id,
          market,
          probability,
          odds: Number((1.5 + (1 - probability)).toFixed(2)),
          confidence: probability > 0.80 ? "high" : "medium",
          is_premium: probability > 0.80
        };

        await supabase
          .from("predictions")
          .insert([prediction]);
      }
    }

    console.log("🔥 PALPITES FINALIZADOS");
  }} catch (err) {
    console.error("Erro ao gerar palpites:", err.message);
  }
} // ✅ FECHANDO A FUNÇÃO generatePredictions

// ===================== ROTAS =====================

// HEALTH CHECK
app.get("/", (req, res) => {
  res.send("API ONLINE 🚀");
});

// TODOS
app.get("/predictions", async (req, res) => {
  const { data, error } = await supabase
    .from("predictions")
    .select("*, games!fk_game(*)")
    .order("probability", { ascending: false });

  if (error) return res.status(500).json(error);
  res.json(data);
});

// FREE
app.get("/predictions/free", async (req, res) => {
  const { data, error } = await supabase
    .from("predictions")
    .select("*, games!fk_game(*)")
    .eq("is_premium", false)
    .order("probability", { ascending: false })
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
    .select("*, games!fk_game(*)")
    .eq("is_premium", true)
    .order("probability", { ascending: false })
    .limit(15);

  if (error) return res.status(500).json(error);
  res.json(data);
});

// JOGOS
app.get("/games", async (req, res) => {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("games")
    .select("*")
    .gte("match_date", today + "T00:00:00")
    .order("match_date", { ascending: true })
    .limit(50);

  if (error) return res.status(500).json(error);
  res.json(data);
});

// ===================== SERVER =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
});

// ===================== START =====================
setTimeout(async () => {
  console.log("🚀 Iniciando ciclo completo...");

  await cleanOldGames();
  await fetchAndInsertGames();
  await generatePredictions();

}, 3000);

// ===================== LIMPAR DADOS ANTIGOS =====================
async function cleanOldGames() {
  const now = new Date().toISOString();

  await supabase
    .from("games")
    .delete()
    .lt("match_date", now);

  await supabase
    .from("predictions")
    .delete()
    .lt("created_at", now);

  console.log("🧹 Dados antigos removidos");
}