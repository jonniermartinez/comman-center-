import PostalMime from "postal-mime";

/**
 * Buzón de pruebas: recibe los correos que Supabase manda a las direcciones
 * `e2e-cc-*@jonnier.com` y los deja leer por HTTP.
 *
 * Hace falta porque Email Routing de Cloudflare **solo reenvía**: no guarda
 * nada y no tiene API de lectura. Sin algo así, los dos flujos que dependen del
 * correo —invitar a alguien y recuperar la contraseña— no se pueden probar de
 * punta a punta, que es justo donde más duele que se rompan.
 *
 * No se reutiliza `gurwi-e2e-mail`, que ya existe en esta misma zona, por dos
 * motivos: solo rescata códigos de seis dígitos y tira el resto —los correos de
 * Supabase traen un enlace, no un código—, y es de otro proyecto: cambiarlo
 * para que encaje aquí rompería sus pruebas.
 */

/**
 * Buzones que este worker acepta.
 *
 * `e2e-cc-*` son los de las pruebas de correo. `e2e_*` son las cuentas de rol:
 * no se leen nunca, pero se enrutan aquí igualmente para que **nada** de las
 * pruebas acabe en el buzón personal por el catch-all de la zona.
 *
 * No se reclama `e2e-*` a secas: ese prefijo es de gurwi-e2e-mail.
 */
const DESTINATARIO = /^(e2e-cc-[a-z0-9-]+|e2e_[a-z0-9_]+)@jonnier\.com$/;
/** Un cuarto de hora: lo que puede tardar una prueba, no más. */
const TTL_SEGUNDOS = 900;
const MAX_POR_BUZON = 10;

interface Entorno {
  CORREOS: KVNamespace;
  E2E_MAIL_SECRET: string;
}

interface Mensaje {
  asunto: string;
  de: string;
  recibidoEn: string;
  texto: string;
  enlaces: string[];
  /** El token de un solo uso de Supabase, si el enlace lo trae. */
  tokenHash: string | null;
  tipo: string | null;
}

function sinHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&");
}

/**
 * Los enlaces del correo, sin repetir.
 *
 * Se miran texto y HTML porque según la plantilla el enlace vive en uno, en
 * otro o en los dos, y perderlo significa una prueba que no puede continuar.
 */
function enlacesDe(texto: string, html: string): string[] {
  const fuente = `${texto}\n${sinHtml(html)}\n${html}`;
  const encontrados = fuente.match(/https?:\/\/[^\s"'<>)\]]+/g) ?? [];
  return [
    ...new Set(
      encontrados.map((e) => e.replace(/&amp;/g, "&").replace(/[.,]+$/, "")),
    ),
  ];
}

function datosDelEnlace(enlaces: string[]): {
  tokenHash: string | null;
  tipo: string | null;
} {
  for (const enlace of enlaces) {
    try {
      const url = new URL(enlace);
      const token =
        url.searchParams.get("token_hash") ?? url.searchParams.get("token");
      if (token)
        return { tokenHash: token, tipo: url.searchParams.get("type") };
    } catch {
      // Un enlace mal formado no debe tumbar la captura del correo.
    }
  }
  return { tokenHash: null, tipo: null };
}

export default {
  async email(message: ForwardableEmailMessage, env: Entorno) {
    const para = message.to.toLowerCase();
    if (!DESTINATARIO.test(para)) {
      message.setReject("Esta dirección no es un buzón de pruebas");
      return;
    }

    const crudo = await new Response(message.raw).arrayBuffer();
    const analizado = await PostalMime.parse(crudo);

    const html = analizado.html ?? "";
    const texto = analizado.text ?? sinHtml(html);
    const enlaces = enlacesDe(texto, html);

    const mensaje: Mensaje = {
      asunto: analizado.subject ?? "",
      de: message.from,
      recibidoEn: new Date().toISOString(),
      texto: texto.slice(0, 4000),
      enlaces,
      ...datosDelEnlace(enlaces),
    };

    // Se guarda una lista, no el último: una prueba puede disparar dos correos
    // y quedarse esperando el que ya se pisó.
    const clave = `correo:${para}`;
    const previos: Mensaje[] = JSON.parse(
      (await env.CORREOS.get(clave)) ?? "[]",
    );
    previos.unshift(mensaje);

    await env.CORREOS.put(
      clave,
      JSON.stringify(previos.slice(0, MAX_POR_BUZON)),
      {
        expirationTtl: TTL_SEGUNDOS,
      },
    );
    console.log(
      `Correo guardado para ${para}: "${mensaje.asunto}" (${enlaces.length} enlaces)`,
    );
  },

  async fetch(request: Request, env: Entorno) {
    const auth = request.headers.get("authorization") ?? "";
    if (!env.E2E_MAIL_SECRET || auth !== `Bearer ${env.E2E_MAIL_SECRET}`) {
      return Response.json({ error: "no_autorizado" }, { status: 401 });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/correos") {
      return Response.json({ error: "no_encontrado" }, { status: 404 });
    }

    const email = (url.searchParams.get("email") ?? "").toLowerCase();
    if (!DESTINATARIO.test(email)) {
      return Response.json({ error: "buzon_invalido" }, { status: 400 });
    }
    const clave = `correo:${email}`;

    // Vaciar antes de disparar el correo evita leer el de la corrida anterior.
    if (request.method === "DELETE") {
      await env.CORREOS.delete(clave);
      return Response.json({ ok: true });
    }
    if (request.method !== "GET") {
      return Response.json({ error: "metodo_no_permitido" }, { status: 405 });
    }

    const guardados = await env.CORREOS.get(clave);
    return Response.json({ correos: JSON.parse(guardados ?? "[]") });
  },
};
