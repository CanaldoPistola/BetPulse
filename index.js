// ===================== IMPORTS =====================
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
const express = require("express");
const cors = require("cors"); // 👈 ADICIONADO
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

app.use(cors());


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

  // 🔥 FILTRO INTELIGENTE (NOVO)
  const text = (
    game.league.name +
    game.teams.home.name +
    game.teams.away.name
  ).toLowerCase();

  if (
    text.includes("u17") ||
    text.includes("u19") ||
    text.includes("u20") ||
    text.includes("u21") ||
    text.includes("u23") ||
    text.includes("youth") ||
    text.includes("reserves") ||
    text.includes("women") ||
    text.includes("femin")
  ) {
    continue;
  }

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
  } catch (err) {
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

// ===================== STRIPE CHECKOUT =====================
app.get("/create-checkout-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: "price_1TGj6a8QWoA2KiD8gu620noY",
          quantity: 1,
        },
      ],
      success_url: "https://betpulse-2.onrender.com",
      cancel_url: "https://betpulse-2.onrender.com",
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error("Erro Stripe:", err.message);
    res.status(500).json({ error: "Erro ao criar checkout" });
  }
});

// ===================== STRIPE WEBHOOK =====================
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === "checkout.session.completed") {
      console.log("💰 PAGAMENTO CONFIRMADO");

      const session = event.data.object;

const email = session.customer_details?.email || session.customer_email;

console.log("EMAIL CAPTURADO:", email);

if (!email) {
  console.error("❌ Email não encontrado no pagamento");
  return res.json({ received: true });
}

const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 30); // 30 dias

const { error } = await supabase
  .from("users")
  .upsert(
    {
      email: email,
      is_vip: true,
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: "email" }
  );

if (error) {
  console.error("❌ ERRO AO SALVAR:", error.message);
} else {
  console.log("✅ USUÁRIO SALVO COMO VIP");
}

      console.log("Cliente:", session.customer_email);
    }

    res.json({ received: true });

  } catch (err) {
    console.error("❌ Erro webhook:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});
app.use(express.json());

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
    .lt("match_date", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  await supabase
    .from("predictions")
    .delete()
    .lt("created_at", now);

  console.log("🧹 Dados antigos removidos");
}