import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los comprobantes de ventas y pagos suben por server action, que corta en
  // 1 MB por defecto: una foto de celular lo pasa y la acción revienta antes
  // de llegar a validar. El tope real es el de uploadPaymentReceipt (5 MB);
  // el margen es el sobrecosto del multipart.
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
