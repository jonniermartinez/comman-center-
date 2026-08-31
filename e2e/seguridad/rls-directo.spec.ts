import { anotar } from "../soporte/anotaciones";
import { clienteAnonimo, empresaPorSlug, type Cliente } from "../soporte/api";
import { venta } from "../soporte/datos";
import { EMPRESA_A, EMPRESA_B } from "../soporte/entorno";
import { expect, test } from "../soporte/fixtures";

/**
 * Lo que la base le entrega a cada quien cuando pregunta por su cuenta.
 *
 * Estas son las pruebas de seguridad que valen. Las de la interfaz comprueban
 * que no se pinta un botón; estas comprueban que, aunque alguien abra las
 * herramientas del navegador y consulte a mano con su propia sesión, la base no
 * suelta el dato. Si una de estas falla, la aplicación está expuesta aunque la
 * pantalla se vea impecable.
 */

async function contextoDe(admin: Cliente, slug: string) {
  const empresa = await empresaPorSlug(admin, slug);
  if (!empresa) throw new Error(`El montaje no dejó la empresa ${slug}`);

  const { data: sede } = await admin
    .from("branches")
    .select("id")
    .eq("company_id", empresa.id)
    .eq("is_primary", true)
    .single();

  if (!sede) throw new Error(`La empresa ${slug} no tiene sede principal`);
  return { empresa, companyId: empresa.id, branchId: sede.id };
}

async function staffDe(admin: Cliente, nombre: string) {
  const { data } = await admin
    .from("staff")
    .select("id")
    .eq("full_name", nombre)
    .single();
  if (!data) throw new Error(`No existe la persona de pruebas "${nombre}"`);
  return data.id;
}

test.describe("RLS: lo que la base entrega a cada rol", () => {
  test(
    "un anónimo no lee absolutamente nada",
    anotar({
      modulo: "Acceso",
      rol: "anónimo",
      tipo: "seguridad",
      porque:
        "Sin sesión la base no puede soltar ni una fila. Es la primera línea y la que protege incluso si la aplicación entera se cayera.",
    }),
    async () => {
      const anonimo = clienteAnonimo();

      for (const tabla of [
        "companies",
        "profiles",
        "sales",
        "payments",
        "audit_log",
      ] as const) {
        const { data } = await anonimo.from(tabla).select("*").limit(1);
        // Da igual que responda "vacío" o que responda "no puedes": lo que no
        // puede pasar es que devuelva una fila.
        expect(data ?? [], `un anónimo leyó ${tabla}`).toHaveLength(0);
      }
    },
  );

  test(
    "el asesor A no ve ni una fila de la empresa B",
    anotar({
      modulo: "Acceso",
      rol: "asesor",
      tipo: "seguridad",
      porque:
        "El aislamiento entre empresas es el contrato con el cliente: cada uno paga por ver lo suyo.",
    }),
    async ({ apiAsesorA, apiSuperAdmin }) => {
      const b = await contextoDe(apiSuperAdmin, EMPRESA_B);

      const { data: empresas } = await apiAsesorA
        .from("companies")
        .select("slug");
      const slugs = (empresas ?? []).map((e) => e.slug);
      expect(slugs).toContain(EMPRESA_A);
      expect(slugs, "el asesor A alcanza la empresa B").not.toContain(
        EMPRESA_B,
      );

      // Y tampoco pidiéndola por su id, que es lo que haría alguien con la URL.
      for (const tabla of [
        "sales",
        "payments",
        "daily_activity",
        "appointments",
      ] as const) {
        const { data } = await apiAsesorA
          .from(tabla)
          .select("id")
          .eq("company_id", b.companyId);
        expect(
          data ?? [],
          `el asesor A leyó ${tabla} de la empresa B`,
        ).toHaveLength(0);
      }
    },
  );

  test(
    "el asesor A no ve nada de las empresas reales del cliente",
    anotar({
      modulo: "Acceso",
      rol: "asesor",
      tipo: "seguridad",
      porque:
        "Las cuentas de prueba viven en la misma base que los datos reales. Si alcanzaran a CEA o TTC, las pruebas serían una fuga.",
    }),
    async ({ apiAsesorA }) => {
      const { data: empresas } = await apiAsesorA
        .from("companies")
        .select("slug");
      const slugs = (empresas ?? []).map((e) => e.slug);

      for (const real of ["tramites", "ruta-segura", "lv", "ttc", "cea"]) {
        expect(slugs, `el asesor de pruebas alcanza ${real}`).not.toContain(
          real,
        );
      }

      // 16.500 ventas reales en la base; a este usuario le corresponden cero.
      const { data: ventas } = await apiAsesorA
        .from("sales")
        .select("id")
        .limit(5);
      expect(ventas ?? []).toHaveLength(0);
    },
  );

  test(
    "el asesor escribe lo suyo y solo lo suyo",
    anotar({
      modulo: "Ventas",
      rol: "asesor",
      tipo: "seguridad",
      porque:
        "El comercial registra lo suyo; poder firmar a nombre de otro rompería las comisiones y el histórico de cada quien.",
    }),
    async ({ apiAsesorA, apiSuperAdmin }) => {
      const a = await contextoDe(apiSuperAdmin, EMPRESA_A);
      const b = await contextoDe(apiSuperAdmin, EMPRESA_B);
      const miStaff = await staffDe(apiSuperAdmin, "E2E Asesor A");
      const otroStaff = await staffDe(apiSuperAdmin, "E2E Asesor B");

      // CONTROL POSITIVO: la misma fila tiene que entrar cuando sí está
      // permitida. Sin esto, los dos rechazos de abajo no demuestran nada:
      // podrían venir de un payload inválido.
      const { data: creada, error: errorPermitido } = await apiAsesorA
        .from("sales")
        .insert(venta({ ...a, staffId: miStaff }) as never)
        .select("id")
        .single();
      expect(
        errorPermitido,
        `el asesor no pudo registrar su propia venta: ${errorPermitido?.message}`,
      ).toBeNull();
      expect(creada?.id).toBeTruthy();

      // 1. La misma venta, en una empresa que no es suya.
      const { error: errorOtraEmpresa } = await apiAsesorA
        .from("sales")
        .insert(venta({ ...b, staffId: miStaff }) as never);
      expect(
        errorOtraEmpresa,
        "el asesor A escribió una venta en la empresa B",
      ).toBeTruthy();

      // 2. La misma venta, en su empresa, pero a nombre de otra persona.
      const { error: errorOtroResponsable } = await apiAsesorA
        .from("sales")
        .insert(venta({ ...a, staffId: otroStaff }) as never);
      expect(
        errorOtroResponsable,
        "un asesor registró una venta a nombre de otra persona",
      ).toBeTruthy();

      // Limpieza de la fila del control positivo.
      if (creada?.id)
        await apiSuperAdmin.from("sales").delete().eq("id", creada.id);
    },
  );

  test(
    "el coordinador sí escribe lo de cualquiera de su empresa",
    anotar({
      modulo: "Ventas",
      rol: "coordinador",
      tipo: "feature",
      porque:
        "Es la diferencia de fondo entre los dos roles: el coordinador corrige lo de todo el equipo.",
    }),
    async ({ apiCoordinador, apiSuperAdmin }) => {
      const a = await contextoDe(apiSuperAdmin, EMPRESA_A);
      const otroStaff = await staffDe(apiSuperAdmin, "E2E Asesor A");

      // Es la diferencia de fondo entre los dos roles: el comercial registra lo
      // suyo, el coordinador corrige lo de todo el equipo.
      const { data: creada, error } = await apiCoordinador
        .from("sales")
        .insert(venta({ ...a, staffId: otroStaff }) as never)
        .select("id")
        .single();

      expect(
        error,
        `el coordinador no pudo registrar por su equipo: ${error?.message}`,
      ).toBeNull();
      if (creada?.id)
        await apiSuperAdmin.from("sales").delete().eq("id", creada.id);
    },
  );

  test(
    "el coordinador de A no toca la empresa B",
    anotar({
      modulo: "Acceso",
      rol: "coordinador",
      tipo: "seguridad",
      porque: "Administrar una empresa no da permiso sobre las demás.",
    }),
    async ({ apiCoordinador, apiSuperAdmin }) => {
      const b = await contextoDe(apiSuperAdmin, EMPRESA_B);

      const { data } = await apiCoordinador
        .from("sales")
        .select("id")
        .eq("company_id", b.companyId);
      expect(data ?? [], "el coordinador de A leyó ventas de B").toHaveLength(
        0,
      );

      const { error } = await apiCoordinador
        .from("sales")
        .insert(venta(b) as never);
      expect(error, "el coordinador de A escribió en B").toBeTruthy();
    },
  );

  test(
    "nadie escribe el log de auditoría a mano",
    anotar({
      modulo: "Auditoría",
      rol: "super admin",
      tipo: "seguridad",
      porque:
        "Un log falsificable no es evidencia de nada. Ni el super admin puede insertar a mano.",
    }),
    async ({ apiAsesorA, apiSuperAdmin }) => {
      // Ni el asesor ni el propio super admin: el log solo se escribe desde
      // `log_audit`, que estampa el actor a partir del token. Si esto se pudiera,
      // el log dejaría de ser evidencia de nada.
      for (const [quien, cliente] of [
        ["asesor", apiAsesorA],
        ["super admin", apiSuperAdmin],
      ] as const) {
        const { error } = await cliente.from("audit_log").insert({
          action: "falsificado",
          entity: "companies",
          actor_name: "No fui yo",
        } as never);
        expect(
          error,
          `${quien} insertó en audit_log directamente`,
        ).toBeTruthy();
      }
    },
  );

  test(
    "el asesor no lee el log de auditoría",
    anotar({
      modulo: "Auditoría",
      rol: "asesor",
      tipo: "seguridad",
      porque:
        "El log dice quién hizo qué en toda la plataforma: solo lo ve el super admin.",
    }),
    async ({ apiAsesorA }) => {
      const { data } = await apiAsesorA.from("audit_log").select("*").limit(1);
      expect(data ?? []).toHaveLength(0);
    },
  );
});

test.describe("Escalada de privilegios", () => {
  test(
    "un asesor no puede crear cuentas",
    anotar({
      modulo: "Usuarios",
      rol: "asesor",
      tipo: "seguridad",
      porque:
        "Crear cuentas es la vía más corta a super admin. La base lo verifica por su cuenta, no la interfaz.",
    }),
    async ({ apiAsesorA }) => {
      const { error } = await apiAsesorA.rpc("admin_create_user", {
        p_email: "e2e-intruso@jonnier.com",
        p_full_name: "Intruso",
        p_role: "super_admin",
      });
      expect(error, "un asesor creó una cuenta de super admin").toBeTruthy();
    },
  );

  test(
    "un coordinador tampoco administra cuentas",
    anotar({
      modulo: "Usuarios",
      rol: "coordinador",
      tipo: "seguridad",
      porque: "Administrar una empresa no es administrar la plataforma.",
    }),
    async ({ apiCoordinador }) => {
      const { error } = await apiCoordinador.rpc("admin_create_user", {
        p_email: "e2e-intruso-coord@jonnier.com",
        p_full_name: "Intruso",
        p_role: "asesor",
      });
      expect(error, "un coordinador creó una cuenta").toBeTruthy();
    },
  );

  test(
    "un asesor no cambia la contraseña de un super admin",
    anotar({
      modulo: "Usuarios",
      rol: "asesor",
      tipo: "seguridad",
      porque: "Sería tomar el control del sistema entero con una sola llamada.",
    }),
    async ({ apiAsesorA, apiSuperAdmin }) => {
      const { data: victima } = await apiSuperAdmin
        .from("profiles")
        .select("id")
        .eq("role", "super_admin")
        .limit(1)
        .single();

      const { error } = await apiAsesorA.rpc("admin_set_password", {
        target_user: victima!.id,
        p_password: "meloquedoyo123",
      });
      expect(
        error,
        "un asesor cambió la contraseña de un super admin",
      ).toBeTruthy();
    },
  );

  test(
    "un asesor no se asciende a super admin",
    anotar({
      modulo: "Usuarios",
      rol: "asesor",
      tipo: "seguridad",
      porque:
        "Se comprueba el rol después del UPDATE, no si dio error: una política mal escrita puede aceptar la escritura y no aplicarla.",
    }),
    async ({ apiAsesorA }) => {
      const { data: yo } = await apiAsesorA.auth.getUser();
      await apiAsesorA
        .from("profiles")
        .update({ role: "super_admin" })
        .eq("id", yo.user!.id);

      // Lo que importa no es si el UPDATE devolvió error, sino si el rol cambió:
      // una política mal escrita puede aceptar la escritura y no aplicarla.
      const { data: perfil } = await apiAsesorA
        .from("profiles")
        .select("role")
        .eq("id", yo.user!.id)
        .single();
      expect(perfil?.role, "un asesor se ascendió a super admin").toBe(
        "asesor",
      );
    },
  );

  test(
    "un asesor no borra una empresa",
    anotar({
      modulo: "Empresas",
      rol: "asesor",
      tipo: "seguridad",
      porque:
        "El borrado definitivo se lleva años de registros y no tiene vuelta atrás.",
    }),
    async ({ apiAsesorA, apiSuperAdmin }) => {
      const a = await contextoDe(apiSuperAdmin, EMPRESA_A);

      const { error } = await apiAsesorA.rpc("delete_company_cascade", {
        target_company: a.companyId,
        confirm_name: a.empresa.name,
      });
      expect(error, "un asesor borró una empresa entera").toBeTruthy();

      const sigue = await empresaPorSlug(apiSuperAdmin, EMPRESA_A);
      expect(sigue, "la empresa desapareció").toBeTruthy();
    },
  );
});
