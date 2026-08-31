/**
 * Anotaciones de las pruebas.
 *
 * Playwright las muestra en el informe HTML junto a cada prueba. Sirven para
 * responder, sin abrir el código, las tres preguntas que uno se hace cuando una
 * prueba falla en rojo a las once de la noche: qué parte del sistema toca,
 * quién la ejecuta y por qué existe.
 *
 * La última es la que más se agradece. Una prueba sin motivo escrito acaba
 * borrada por quien no entiende qué protegía, normalmente el día que falla por
 * un cambio legítimo. Con `regresion` queda dicho qué se rompió, cuándo y cómo.
 */

export type Modulo =
  | "Empresas"
  | "Sedes"
  | "Ventas"
  | "Pagos"
  | "Gestión diaria"
  | "Agendas"
  | "Caja"
  | "Objetivos"
  | "Usuarios"
  | "Configuración"
  | "Auditoría"
  | "Dashboard"
  | "Acceso"
  | "Correo"
  | "Despliegue";

export type Rol =
  "super admin" | "coordinador" | "asesor" | "anónimo" | "suspendido";

export type Tipo =
  /** Que la funcionalidad haga lo que dice. */
  | "feature"
  /** Que alguien no pueda hacer lo que no debe. */
  | "seguridad"
  /** Un fallo que ya ocurrió y no puede volver. */
  | "regresión"
  /** Que el dato quede bien guardado, no solo que la pantalla lo diga. */
  | "integridad";

export interface Ficha {
  modulo: Modulo;
  rol?: Rol | Rol[];
  tipo: Tipo;
  /** Por qué existe esta prueba. Obligatorio: sin motivo, no hay prueba. */
  porque: string;
  /** Qué se rompió, cuándo. Solo en las de tipo regresión. */
  regresion?: string;
}

/** El módulo como etiqueta filtrable: "Gestión diaria" → "@gestion-diaria". */
function etiquetaDe(texto: string): string {
  return (
    "@" +
    texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

/**
 * Convierte una ficha en anotaciones y etiquetas.
 *
 * Las anotaciones se leen en el informe; las etiquetas sirven para correr un
 * trozo concreto sin acordarse de en qué archivo cayó:
 *
 *     npx playwright test --grep @ventas
 *     npx playwright test --grep @seguridad
 */
export function anotar(ficha: Ficha) {
  const roles = ficha.rol
    ? Array.isArray(ficha.rol)
      ? ficha.rol.join(", ")
      : ficha.rol
    : "cualquiera";

  const anotaciones = [
    { type: "módulo", description: ficha.modulo },
    { type: "tipo", description: ficha.tipo },
    { type: "rol", description: roles },
    { type: "por qué", description: ficha.porque },
  ];

  if (ficha.regresion) {
    anotaciones.push({ type: "regresión", description: ficha.regresion });
  }

  const etiquetas = [etiquetaDe(ficha.modulo), etiquetaDe(ficha.tipo)];

  return { annotation: anotaciones, tag: etiquetas };
}
