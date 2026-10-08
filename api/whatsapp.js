import { createClient } from "@supabase/supabase-js";
import { formatCurrency, getTypeFromAmount, normalizeCategory } from "../src/lib/finance.js";
import { parseQuickTextMovement } from "../src/lib/quickMovement.js";

const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v24.0";
const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const allowedFrom = String(process.env.WHATSAPP_ALLOWED_FROM || "")
  .split(",")
  .map((phone) => phone.replace(/\D/g, ""))
  .filter(Boolean);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const targetUserId = process.env.WHATSAPP_USER_ID;
const defaultAccount = process.env.WHATSAPP_DEFAULT_ACCOUNT || "Principal";
const defaultResponsible = process.env.WHATSAPP_DEFAULT_RESPONSIBLE || "";

function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function getChilePeriod() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "numeric"
  }).formatToParts(new Date());

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value)
  };
}

function parseRequestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function getMessages(payload) {
  return (payload.entry || [])
    .flatMap((entry) => entry.changes || [])
    .flatMap((change) => change.value?.messages || [])
    .filter((message) => message.type === "text" && message.text?.body);
}

function isAllowedSender(from) {
  if (!allowedFrom.length) return true;
  return allowedFrom.includes(String(from || "").replace(/\D/g, ""));
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

async function sendWhatsappMessage(to, body) {
  if (!phoneNumberId || !accessToken) {
    throw new Error("Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN.");
  }

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: false,
        body
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WhatsApp send failed: ${response.status} ${text}`);
  }
}

async function insertMessageLog(supabase, message) {
  const { data, error } = await supabase
    .from("whatsapp_message_logs")
    .insert({
      external_message_id: message.id,
      from_phone: message.from,
      body: message.text.body,
      status: "received"
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    return { duplicate: true };
  }

  if (error?.code === "42P01") {
    return { duplicate: false, logId: null };
  }

  if (error) {
    throw error;
  }

  return { duplicate: false, logId: data.id };
}

async function updateMessageLog(supabase, logId, payload) {
  if (!logId) return;
  await supabase.from("whatsapp_message_logs").update(payload).eq("id", logId);
}

async function getUserLinkForMessage(supabase, message) {
  const fromPhone = normalizePhone(message.from);

  const { data, error } = await supabase
    .from("whatsapp_user_links")
    .select("user_id, phone, default_account, responsible, active")
    .eq("phone", fromPhone)
    .eq("active", true)
    .maybeSingle();

  if (error?.code !== "42P01" && error) {
    throw error;
  }

  if (data?.user_id) {
    return data;
  }

  if (targetUserId && isAllowedSender(fromPhone)) {
    return {
      user_id: targetUserId,
      phone: fromPhone,
      default_account: defaultAccount,
      responsible: defaultResponsible,
      active: true
    };
  }

  return null;
}

function buildMovementFromMessage(message, userLink) {
  const parsed = parseQuickTextMovement(message.text.body);
  if (!parsed) return null;

  const period = getChilePeriod();
  const type = getTypeFromAmount(parsed.amount);

  return {
    user_id: userLink.user_id,
    year: period.year,
    month: period.month,
    flow: "Movimiento",
    account: userLink.default_account || defaultAccount,
    target_account: null,
    type,
    category: normalizeCategory(parsed.category, type),
    description: parsed.description,
    amount: parsed.amount,
    status: "Confirmado",
    responsible: userLink.responsible || defaultResponsible || null,
    sort_order: Date.now()
  };
}

function buildSuccessReply(movement) {
  const action = movement.type === "Ingreso" ? "ingreso" : "gasto";
  const displayAmount = movement.type === "Ingreso" ? movement.amount : Math.abs(Number(movement.amount) || 0);
  return [
    `Agregue ${action} de ${formatCurrency(displayAmount)} por '${movement.description}'.`,
    `Categoria: ${movement.category}`,
    `Cuenta: ${movement.account}`
  ].join("\n");
}

async function handleTextMessage(supabase, message) {
  const log = await insertMessageLog(supabase, message);
  if (log.duplicate) {
    return;
  }

  const userLink = await getUserLinkForMessage(supabase, message);
  if (!userLink) {
    await updateMessageLog(supabase, log.logId, { status: "ignored" });
    await sendWhatsappMessage(
      message.from,
      "Tu numero no esta habilitado en Fluxa Bot. Pide al administrador que lo agregue a whatsapp_user_links."
    );
    return;
  }

  const movement = buildMovementFromMessage(message, userLink);
  if (!movement) {
    await updateMessageLog(supabase, log.logId, { status: "ignored" });
    await sendWhatsappMessage(
      message.from,
      "No pude leer ese movimiento. Usa un formato como: 20000 farmacia, 2690 mc furry o ingreso 50000 pago cliente."
    );
    return;
  }

  const { data, error } = await supabase.from("movements").insert(movement).select().single();

  if (error) {
    await updateMessageLog(supabase, log.logId, { status: "failed", error_message: error.message });
    await sendWhatsappMessage(message.from, `No pude guardar el movimiento: ${error.message}`);
    return;
  }

  await updateMessageLog(supabase, log.logId, {
    status: "created",
    movement_id: data.id
  });
  await sendWhatsappMessage(message.from, buildSuccessReply(data));
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token && token === verifyToken) {
      res.status(200).send(challenge);
      return;
    }

    res.status(403).send("Forbidden");
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const payload = parseRequestBody(req);
    const messages = getMessages(payload);

    if (!messages.length) {
      res.status(200).json({ ok: true });
      return;
    }

    const supabase = getSupabaseAdmin();

    for (const message of messages) {
      await handleTextMessage(supabase, message);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(200).json({ ok: false });
  }
}
